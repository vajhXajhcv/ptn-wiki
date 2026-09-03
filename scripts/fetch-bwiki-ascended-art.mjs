// 从无期迷途 BWiki 抓取角色「升阶装束」（三阶立绘），统一角色主图风格。
//
// 背景：官网资讯只发布初始立绘与生日贺图等，三阶立绘（升阶装束）仅 BWiki 有收录。
// 流程（批量模式，CI 友好）：
//   1. 遍历 src/content/characters/*.md，取 name。
//   2. MediaWiki API 支持一次查 50 个页面：分块查询「禁闭者:{name}」的图片列表（prop=images），
//      从中找标题含「升阶装束」且含角色名的文件；再分块批量取 patchwiki 直链（prop=imageinfo）。
//      全部 API 请求约 8 次（避免逐角色请求触发反爬，也把 CI 构建时间压到几分钟内）。
//   3. 图片下载并发 5，Jimp 压成宽 600px、JPEG q85，覆盖 public/characters/{slug}.jpg
//     （沿用 gitignore 规则，不提交）。
//   4. frontmatter 的 imageSource 标注为 BWiki 来源（含文件页链接，可追溯）。
//
// 幂等：imageSource 已标注「BWiki」且本地文件存在则跳过；--force 强制重跑。
// 可只跑单个角色：node scripts/fetch-bwiki-ascended-art.mjs zoya
// 找不到升阶装束的角色保留现有官网图，输出到报告。
//
// 合规提示：图片版权归自意网络所有，BWiki 为社区转载。页面须保留来源标注。

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import Jimp from 'jimp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const PUBLIC_CHAR_DIR = join(ROOT, 'public', 'characters');
const TMP_DIR = join(__dirname, 'tmp');

const API_BASE = 'https://wiki.biligame.com/wqmt/api.php';
// prop=images 批量时每页图片会受响应上限截断（不处理 continuation），故单次只查 10 个页面；
// imageinfo 每个文件只返回 1 条，可以 50 个一批。
const IMAGES_BATCH_SIZE = 10;
const INFO_BATCH_SIZE = 50; // MediaWiki API 单次 titles 上限
const BATCH_DELAY_MS = 1000;
const DOWNLOAD_CONCURRENCY = 5;
// 单个请求超时与脚本整体时间预算：防止 CI 构建环境网络受限时请求挂起，
// 拖过 Cloudflare Pages 的构建时限（2026-09 曾因此连续部署失败）。
const REQUEST_TIMEOUT_MS = 30_000;
const TIME_BUDGET_MS = Number(process.env.FETCH_TIME_BUDGET_MS) || 5 * 60 * 1000;
const deadline = Date.now() + TIME_BUDGET_MS;
const FORCE = process.argv.includes('--force');
// 可选：只跑单个角色，如 node scripts/fetch-bwiki-ascended-art.mjs zoya
const ONLY = process.argv.slice(2).find((a) => !a.startsWith('--')) || null;

mkdirSync(PUBLIC_CHAR_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function api(params, attempt = 1) {
	const qs = new URLSearchParams({ ...params, format: 'json' });
	const url = `${API_BASE}?${qs}`;
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} catch (e) {
		if (attempt >= 4) throw e;
		await sleep(2000 * attempt);
		return api(params, attempt + 1);
	}
}

async function download(url, attempt = 1) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return Buffer.from(await res.arrayBuffer());
	} catch (e) {
		if (attempt >= 3) throw e;
		await sleep(1000 * attempt);
		return download(url, attempt + 1);
	}
}

async function runInChunks(items, fn, size) {
	for (let i = 0; i < items.length; i += size) {
		if (Date.now() > deadline) {
			console.warn(`   ! 超出时间预算（${TIME_BUDGET_MS / 60000} 分钟），剩余 ${items.length - i} 项跳过`);
			break;
		}
		const chunk = items.slice(i, i + size);
		await Promise.all(chunk.map(fn));
	}
}

// BWiki 页面名与站内角色名不一致时的映射
const BWIKI_NAME_MAP = {
	EMP: '艾米潘',
	'K.K.': '蔻蔻',
};

function localChars() {
	const files = readdirSync(CHAR_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	return files.map((f) => {
		const content = readFileSync(join(CHAR_DIR, f), 'utf8');
		const nameMatch = content.match(/^name:\s*(.+)$/m);
		// 去掉 YAML 引号（如 name: '000'）
		const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
		return {
			slug: f.replace(/\.(md|mdx)$/, ''),
			name,
			wikiName: BWIKI_NAME_MAP[name] || name,
			content,
			path: join(CHAR_DIR, f),
		};
	});
}

// 更新 frontmatter 的 image / imageSource（兼容 CRLF）
function updateFrontmatter(content, slug, fileTitle, filePageUrl) {
	const sourceYaml = `imageSource:\n  category: BWiki 升阶装束\n  title: ${fileTitle}\n  url: ${filePageUrl}`;
	let out = content;

	const oldImageLine = out.match(/^image:\s*.+$/m)?.[0];
	if (oldImageLine) {
		out = out.replace(oldImageLine, `image: /characters/${slug}.jpg`);
	} else {
		out = out.replace(/^tags:.*$/m, `image: /characters/${slug}.jpg\n$&`);
	}

	const oldSourceBlock = out.match(/^imageSource:[ \t]*\r?\n(?:[ \t]+[^\n]*\r?\n?)+/m)?.[0];
	if (oldSourceBlock) {
		out = out.replace(oldSourceBlock, sourceYaml + '\n');
	} else {
		out = out.replace(/^image:\s*.+$/m, `$&\n${sourceYaml}`);
	}
	return out;
}

// 批量取角色页图片列表：pageTitle -> images[]
async function batchPageImages(chars) {
	const result = new Map();
	for (let i = 0; i < chars.length; i += IMAGES_BATCH_SIZE) {
		if (Date.now() > deadline) {
			console.warn('   ! 超出时间预算，剩余角色页图片列表跳过');
			break;
		}
		const chunk = chars.slice(i, i + IMAGES_BATCH_SIZE);
		const data = await api({
			action: 'query',
			prop: 'images',
			titles: chunk.map((c) => `禁闭者:${c.wikiName}`).join('|'),
			imlimit: '500',
			redirects: '1',
		});
		// redirects 后 title 可能被规范化，按 normalized/redirects 映射回请求的 wikiName
		const normalizeMap = new Map();
		for (const n of data?.query?.normalized || []) normalizeMap.set(n.to, n.from);
		for (const r of data?.query?.redirects || []) normalizeMap.set(r.to, normalizeMap.get(r.from) || r.from);

		for (const page of Object.values(data?.query?.pages || {})) {
			const from = normalizeMap.get(page.title) || page.title.replace(/^禁闭者:/, '');
			result.set(from, page.images || []);
		}
		if (i + IMAGES_BATCH_SIZE < chars.length) await sleep(BATCH_DELAY_MS);
	}
	return result;
}

// 批量取文件直链：fileTitle -> { url, pageUrl }
async function batchImageInfo(fileTitles) {
	const result = new Map();
	for (let i = 0; i < fileTitles.length; i += INFO_BATCH_SIZE) {
		if (Date.now() > deadline) {
			console.warn('   ! 超出时间预算，剩余文件直链查询跳过');
			break;
		}
		const chunk = fileTitles.slice(i, i + INFO_BATCH_SIZE);
		const data = await api({
			action: 'query',
			titles: chunk.join('|'),
			prop: 'imageinfo',
			iiprop: 'url',
			redirects: '1',
		});
		for (const page of Object.values(data?.query?.pages || {})) {
			const info = page.imageinfo?.[0];
			if (info?.url) result.set(page.title, { url: info.url, pageUrl: info.descriptionurl });
		}
		if (i + INFO_BATCH_SIZE < fileTitles.length) await sleep(BATCH_DELAY_MS);
	}
	return result;
}

async function main() {
	const chars = localChars().filter((c) => c.name && (!ONLY || c.slug === ONLY));
	console.log(`共 ${chars.length} 名角色（批量模式）${FORCE ? '（--force 全量重跑）' : ''}`);

	const report = [];
	const pending = [];
	for (const c of chars) {
		const localFile = join(PUBLIC_CHAR_DIR, `${c.slug}.jpg`);
		if (!FORCE && c.content.includes('category: BWiki 升阶装束') && existsSync(localFile)) {
			report.push({ slug: c.slug, name: c.name, status: 'skipped' });
		} else {
			pending.push(c);
		}
	}
	console.log(`   跳过 ${report.length}，待抓取 ${pending.length}`);
	if (pending.length === 0) return summary(report);

	console.log('1. 批量查询角色页图片列表...');
	const pageImages = await batchPageImages(pending);

	// 匹配升阶装束文件（需同时包含角色名，避免命中「升阶装束bg.png」这类通用模板图）
	// 注意：同一文件可能服务多个条目（如 艾米潘 与 EMP 指向同一角色页），故映射为数组
	const fileToChars = new Map();
	for (const c of pending) {
		const images = pageImages.get(c.wikiName) || [];
		const hit = images.find((i) => i.title.includes('升阶装束') && (i.title.includes(c.name) || i.title.includes(c.wikiName)));
		if (hit) {
			if (!fileToChars.has(hit.title)) fileToChars.set(hit.title, []);
			fileToChars.get(hit.title).push(c);
		} else {
			report.push({ slug: c.slug, name: c.name, status: 'not-found' });
		}
	}
	console.log(`   匹配到升阶装束 ${fileToChars.size} 个`);

	console.log('2. 批量取文件直链...');
	const infoMap = await batchImageInfo([...fileToChars.keys()]);

	console.log(`3. 下载并压缩（并发 ${DOWNLOAD_CONCURRENCY}）...`);
	let done = 0;
	await runInChunks(
		[...fileToChars.entries()],
		async ([fileTitle, charsForFile]) => {
			const info = infoMap.get(fileTitle);
			if (!info) {
				for (const c of charsForFile) report.push({ slug: c.slug, name: c.name, status: 'error', error: 'imageinfo 缺失' });
				return;
			}
			try {
				const buf = await download(info.url);
				const jimg = await Jimp.read(buf);
				jimg.resize(600, Jimp.AUTO).quality(85);
				for (const c of charsForFile) {
					await jimg.writeAsync(join(PUBLIC_CHAR_DIR, `${c.slug}.jpg`));
					const newContent = updateFrontmatter(c.content, c.slug, fileTitle.replace(/^文件:/, ''), info.pageUrl);
					writeFileSync(c.path, newContent);
					report.push({ slug: c.slug, name: c.name, status: 'ok', file: fileTitle });
				}
			} catch (e) {
				for (const c of charsForFile) report.push({ slug: c.slug, name: c.name, status: 'error', error: e.message });
				console.warn(`   ! ${fileTitle}: ${e.message}`);
			}
			done++;
			if (done % 20 === 0) console.log(`   进度 ${done}/${fileToChars.size}`);
		},
		DOWNLOAD_CONCURRENCY
	);

	summary(report);
}

function summary(report) {
	writeFileSync(join(TMP_DIR, 'bwiki-ascended-art.json'), JSON.stringify(report, null, 2));
	const ok = report.filter((r) => r.status === 'ok').length;
	const skipped = report.filter((r) => r.status === 'skipped').length;
	const notFound = report.filter((r) => r.status === 'not-found').map((r) => r.name);
	const errors = report.filter((r) => r.status === 'error').map((r) => `${r.name}(${r.error})`);
	console.log(`\n完成。成功 ${ok}，跳过 ${skipped}，无图 ${notFound.length}，失败 ${errors.length}`);
	if (notFound.length) console.log(`无升阶装束: ${notFound.join('、')}`);
	if (errors.length) console.log(`失败: ${errors.join('、')}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
