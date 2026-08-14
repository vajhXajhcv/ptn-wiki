// 从无期迷途 BWiki 抓取角色「升阶装束」（三阶立绘），统一角色主图风格。
//
// 背景：官网资讯只发布初始立绘与生日贺图等，三阶立绘（升阶装束）仅 BWiki 有收录。
// 流程：
//   1. 遍历 src/content/characters/*.md，取 name。
//   2. 查询 BWiki「禁闭者:{name}」页面的图片列表（prop=images），找标题含「升阶装束」的文件。
//   3. prop=imageinfo 取 patchwiki 直链，下载后用 Jimp 压成宽 600px、JPEG q85，
//      覆盖 public/characters/{slug}.jpg（沿用 gitignore 规则，不提交）。
//   4. frontmatter 的 imageSource 标注为 BWiki 来源（含文件页链接，可追溯）。
//
// 幂等：imageSource 已标注「BWiki」且本地文件存在则跳过；--force 强制重跑。
// 限速 2s/角色（对齐 backfill-factions.mjs），失败指数退避重试 3 次。
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
const SLEEP_MS = 2000;
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
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} catch (e) {
		if (attempt >= 3) throw e;
		await sleep(SLEEP_MS * attempt * 2);
		return api(params, attempt + 1);
	}
}

async function download(url, attempt = 1) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return Buffer.from(await res.arrayBuffer());
	} catch (e) {
		if (attempt >= 3) throw e;
		await sleep(1000 * attempt);
		return download(url, attempt + 1);
	}
}

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
			content,
			path: join(CHAR_DIR, f),
		};
	});
}

// BWiki 页面名与站内角色名不一致时的映射
const BWIKI_NAME_MAP = {
	EMP: '艾米潘',
	'K.K.': '蔻蔻',
};

// 更新 frontmatter 的 image / imageSource（兼容 CRLF）
function updateFrontmatter(content, slug, fileTitle, filePageUrl) {
	const sourceYaml = `imageSource:\n  category: BWiki 升阶装束\n  title: ${fileTitle}\n  url: ${filePageUrl}`;
	let out = content;

	const oldImageLine = out.match(/^image:\s*.+$/m)?.[0];
	if (oldImageLine) {
		out = out.replace(oldImageLine, `image: /characters/${slug}.jpg`);
	} else {
		// 无 image 字段则补在 tags 前
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

async function findAscendedArt(name) {
	const wikiName = BWIKI_NAME_MAP[name] || name;
	// 1. 角色页图片列表
	const imgData = await api({
		action: 'query',
		prop: 'images',
		titles: `禁闭者:${wikiName}`,
		imlimit: '100',
		redirects: '1',
	});
	const pages = imgData?.query?.pages || {};
	const images = Object.values(pages)[0]?.images || [];
	// 需同时包含角色名，避免命中「升阶装束bg.png」这类通用模板图
	const hit = images.find((i) => i.title.includes('升阶装束') && (i.title.includes(name) || i.title.includes(wikiName)));
	if (!hit) return null;

	// 2. 文件直链
	const infoData = await api({
		action: 'query',
		titles: hit.title,
		prop: 'imageinfo',
		iiprop: 'url',
		redirects: '1',
	});
	const infoPages = infoData?.query?.pages || {};
	const info = Object.values(infoPages)[0]?.imageinfo?.[0];
	if (!info?.url) return null;
	return { fileTitle: hit.title.replace(/^文件:/, ''), url: info.url, pageUrl: info.descriptionurl };
}

async function main() {
	const chars = localChars().filter((c) => c.name && (!ONLY || c.slug === ONLY));
	console.log(`共 ${chars.length} 名角色，限速 ${SLEEP_MS}ms/个${FORCE ? '（--force 全量重跑）' : ''}`);

	const report = [];
	let done = 0;

	for (const c of chars) {
		const localFile = join(PUBLIC_CHAR_DIR, `${c.slug}.jpg`);
		const alreadyBwiki = c.content.includes('category: BWiki 升阶装束');
		if (!FORCE && alreadyBwiki && existsSync(localFile)) {
			report.push({ slug: c.slug, name: c.name, status: 'skipped' });
			done++;
			continue;
		}

		try {
			const art = await findAscendedArt(c.name);
			if (!art) {
				report.push({ slug: c.slug, name: c.name, status: 'not-found' });
				console.log(`   ✗ ${c.name}: BWiki 无升阶装束，保留现有图`);
			} else {
				const buf = await download(art.url);
				const jimg = await Jimp.read(buf);
				jimg.resize(600, Jimp.AUTO).quality(85);
				await jimg.writeAsync(localFile);

				const newContent = updateFrontmatter(c.content, c.slug, art.fileTitle, art.pageUrl);
				writeFileSync(c.path, newContent);
				report.push({ slug: c.slug, name: c.name, status: 'ok', file: art.fileTitle });
			}
		} catch (e) {
			report.push({ slug: c.slug, name: c.name, status: 'error', error: e.message });
			console.warn(`   ! ${c.name}: ${e.message}`);
		}

		done++;
		if (done % 20 === 0) console.log(`   进度 ${done}/${chars.length}`);
		await sleep(SLEEP_MS);
	}

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
