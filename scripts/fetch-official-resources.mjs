// 访问《无期迷途》官网公开 API，抓取可用于 Wiki 的角色立绘等素材
// 说明：
// - 仅读取官网对外开放的 /api/news 接口（无需登录）。
// - 依次尝试以下官方资讯类型：禁闭者档案 > 禁闭者影像捕获 > 禁闭者装束 > MBCC生日会 > 壁纸。
// - 将匹配到的角色立绘下载到 public/characters/{slug}.jpg，并同步更新 frontmatter 的 image 字段。
// - 不会覆盖没有匹配到的角色文件。
//
// 合规提示：这些图片版权归自意网络所有。本脚本只作本地化预览/归档，正式上线前请取得官方授权
// 或改用官网 CDN 直链 + 显著署名。

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import Jimp from 'jimp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const PUBLIC_CHAR_DIR = join(ROOT, 'public', 'characters');
const TMP_DIR = join(__dirname, 'tmp');

const API_BASE = 'https://wqmt.aisnogames.com/api';
const CONCURRENCY = 5;

mkdirSync(PUBLIC_CHAR_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const CATEGORY_PRIORITY = ['禁闭者档案', '禁闭者影像捕获', '禁闭者装束', 'MBCC生日会', '壁纸'];

// ---------- helpers ----------

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function api(path) {
	const url = `${API_BASE}${path}`;
	const res = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			Accept: 'application/json',
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
	const json = await res.json();
	if (json.ret !== 0 && json.ret !== undefined) throw new Error(`API ret=${json.ret}: ${json.msg}`);
	return json.data;
}

function extractCategory(title) {
	const m = title.match(/【([^】]+)】/);
	return m ? m[1].trim() : '其他';
}

function extractSubject(title) {
	const t = title.replace(/【[^】]+】/g, '').replace(/^[丨|\s]+/, '').trim();
	// 优先取「角色名」
	const m1 = t.match(/[「『]([^」』]+)[」』]/);
	if (m1) return m1[1].trim();
	// 装束：角色名「皮肤名」
	const m2 = t.match(/^([^\s「]+)/);
	if (m2) return m2[1].trim();
	return '';
}

function normalizeName(name) {
	return name
		.replace(/[·•]/g, '')
		.replace(/[「」『』【】\[\]]/g, '')
		.trim();
}

function localChars() {
	const files = readdirSync(CHAR_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	return files.map((f) => {
		const content = readFileSync(join(CHAR_DIR, f), 'utf8');
		const nameMatch = content.match(/^name:\s*(.+)$/m);
		const imageMatch = content.match(/^image:\s*(.+)$/m);
		return {
			slug: f.replace(/\.(md|mdx)$/, ''),
			name: nameMatch ? nameMatch[1].trim() : '',
			image: imageMatch ? imageMatch[1].trim() : '',
			content,
		};
	});
}

async function fetchWithRetry(url, attempts = 3) {
	for (let i = 1; i <= attempts; i++) {
		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return Buffer.from(await res.arrayBuffer());
		} catch (e) {
			if (i === attempts) throw e;
			await sleep(500 * i);
		}
	}
}

function chooseStaticImage(html) {
	const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
	const staticImg = imgs.find((u) => !/\.gif(?:\?|$)/i.test(u));
	return staticImg || imgs[0] || null;
}

async function runInChunks(items, fn, size) {
	const results = [];
	for (let i = 0; i < items.length; i += size) {
		const chunk = items.slice(i, i + size);
		results.push(...(await Promise.all(chunk.map(fn))));
	}
	return results;
}

// ---------- main ----------

async function main() {
	console.log('1. 拉取官网资讯列表...');
	const list = [];
	let offset = 0;
	const limit = 100;
	while (true) {
		const data = await api(`/news?section=1&offset=${offset}&limit=${limit}`);
		list.push(...data.data);
		if (offset + limit >= data.total) break;
		offset += limit;
	}
	console.log(`   共 ${list.length} 条资讯`);

	const chars = localChars();

	// 分类并提取主题名
	const enriched = list
		.map((i) => ({
			...i,
			category: extractCategory(i.title),
			subject: extractSubject(i.title),
		}))
		.filter((i) => CATEGORY_PRIORITY.includes(i.category) && i.subject);

	// 按名字+类别优先级聚合
	const byName = new Map();
	for (const item of enriched) {
		const key = normalizeName(item.subject);
		if (!key) continue;
		if (!byName.has(key)) byName.set(key, []);
		byName.get(key).push(item);
	}
	for (const arr of byName.values()) {
		arr.sort((a, b) => {
			const pa = CATEGORY_PRIORITY.indexOf(a.category);
			const pb = CATEGORY_PRIORITY.indexOf(b.category);
			if (pa !== pb) return pa - pb;
			return b.id - a.id; // 同类型取新的
		});
	}

	const matched = [];
	const unmatchedSlugs = [];
	for (const c of chars) {
		const key = normalizeName(c.name);
		const candidates = byName.get(key);
		if (candidates && candidates.length > 0) {
			matched.push({ char: c, item: candidates[0] });
		} else {
			unmatchedSlugs.push(c.slug);
		}
	}
	console.log(`   找到 ${matched.length}/${chars.length} 个角色的官方资料`);
	console.log('   来源分布：');
	const dist = {};
	for (const { item } of matched) dist[item.category] = (dist[item.category] || 0) + 1;
	for (const [cat, n] of Object.entries(dist)) console.log(`     ${cat}: ${n}`);

	console.log('2. 下载匹配角色的立绘...');
	const report = [];
	await runInChunks(
		matched,
		async ({ char, item }) => {
			try {
				const detail = await api(`/news/${item.id}`);
				const html = detail[0]?.content_html || '';
				const imageUrl = chooseStaticImage(html);
				if (!imageUrl) {
					report.push({
						slug: char.slug,
						name: char.name,
						status: 'no-image',
						category: item.category,
						title: item.title,
					});
					return;
				}
				const buf = await fetchWithRetry(imageUrl);
				// 下载后用 Jimp 压缩为适合 Wiki 卡片/详情页的宽度
				const jimg = await Jimp.read(buf);
				jimg.resize(480, Jimp.AUTO).quality(85);
				const filename = `${char.slug}.jpg`;
				const localPath = join(PUBLIC_CHAR_DIR, filename);
				await jimg.writeAsync(localPath);

				const newImage = `/characters/${filename}`;
				const oldImageLine = char.content.match(/^image:\s*.+$/m)?.[0];
				if (oldImageLine) {
					const newContent = char.content.replace(oldImageLine, `image: ${newImage}`);
					if (newContent !== char.content) {
						writeFileSync(join(CHAR_DIR, `${char.slug}.md`), newContent, 'utf8');
					}
				}

				report.push({
					slug: char.slug,
					name: char.name,
					status: 'ok',
					category: item.category,
					title: item.title,
					newsId: item.id,
					imageUrl,
					localPath: `/characters/${filename}`,
					size: buf.length,
				});
				console.log(`   ✓ ${char.name} (${item.category}) -> ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);
			} catch (e) {
				report.push({
					slug: char.slug,
					name: char.name,
					status: 'error',
					category: item.category,
					title: item.title,
					error: e.message,
				});
				console.error(`   ✗ ${char.name}: ${e.message}`);
			}
		},
		CONCURRENCY
	);

	writeFileSync(
		join(TMP_DIR, 'official-character-matches.json'),
		JSON.stringify(
			{
				totalChars: chars.length,
				matched: matched.length,
				ok: report.filter((r) => r.status === 'ok').length,
				noImage: report.filter((r) => r.status === 'no-image').length,
				error: report.filter((r) => r.status === 'error').length,
				unmatchedSlugs,
				distribution: dist,
				records: report,
			},
			null,
			2
		)
	);

	console.log('3. 完成。报告已保存到 scripts/tmp/official-character-matches.json');
	console.log(`   未匹配角色: ${unmatchedSlugs.length} 个 ${unmatchedSlugs.join(', ')}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
