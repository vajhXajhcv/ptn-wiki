// 剧情详情页「官方壁纸」与「活动留影」跨区块去重：
// 官网影像资料馆的 CG 壁纸与 BWiki 留影 CG 大量是同一张图（不同 CDN），
// 剧情页两个区块同时渲染会出现重复。本脚本用感知哈希（16x16 aHash）比对，
// 生成 src/data/official-cg-duplicates.json：{ 官方标签: { 留影事件: [重复的官方壁纸 id] } }，
// 页面渲染官方区块时按当前剧情的 (officialEvent, cgEvent) 过滤。
// 哈希结果缓存在 scripts/tmp/phash-cache.json（不提交），重复运行只增量请求。
// 用法：node scripts/dedupe-official-cgs.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STORY_CGS_PATH = join(ROOT, 'src', 'data', 'story-cgs.json');
const WALLPAPERS_PATH = join(ROOT, 'src', 'data', 'official-wallpapers.json');
const OUT_PATH = join(ROOT, 'src', 'data', 'official-cg-duplicates.json');
const CACHE_PATH = join(ROOT, 'scripts', 'tmp', 'phash-cache.json');

// 与 src/pages/stories/[id].astro 的 normName / matchByNorm 保持一致
const normName = (s) => s.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '');
const normMatch = (a, b) => {
	const na = normName(a);
	const nb = normName(b);
	return na === nb || na.includes(nb) || nb.includes(na);
};

const HAMMING_THRESHOLD = 20; // 256 位 aHash，实测重复对距离 5~19
const CONCURRENCY = 8;

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

const hashCache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
let cacheDirty = false;

async function ahash(url, attempt = 1) {
	if (hashCache[url]) return hashCache[url];
	try {
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		const raw = await sharp(buf).resize(16, 16, { fit: 'fill' }).grayscale().raw().toBuffer();
		const avg = raw.reduce((a, b) => a + b, 0) / raw.length;
		let bits = '';
		for (const v of raw) bits += v >= avg ? '1' : '0';
		hashCache[url] = bits;
		cacheDirty = true;
		return bits;
	} catch (err) {
		if (attempt <= 4) {
			await sleep(3000 * attempt);
			return ahash(url, attempt + 1);
		}
		console.warn(`  哈希失败，跳过: ${url}（${err.message}）`);
		return null;
	}
}

const hamming = (a, b) => {
	let d = 0;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
	return d;
};

async function mapLimit(items, fn) {
	const results = new Array(items.length);
	let i = 0;
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (i < items.length) {
				const idx = i++;
				results[idx] = await fn(items[idx]);
			}
		}),
	);
	return results;
}

async function main() {
	const storyCgs = JSON.parse(readFileSync(STORY_CGS_PATH, 'utf8'));
	const wallpapers = JSON.parse(readFileSync(WALLPAPERS_PATH, 'utf8'));
	const cgByTag = wallpapers['CG壁纸'] || {};

	const out = {};
	let totalDup = 0;
	for (const [tag, list] of Object.entries(cgByTag)) {
		const matchedEvents = Object.keys(storyCgs).filter((ev) => normMatch(ev, tag));
		if (matchedEvents.length === 0 || list.length === 0) continue;
		console.log(`${tag}：官方 ${list.length} 张，比对留影事件 [${matchedEvents.join('、')}]`);

		const official = await mapLimit(list, async (w) => ({
			id: w.id,
			hash: await ahash(`${w.landscape}?x-oss-process=image/resize,w_640`),
		}));

		for (const ev of matchedEvents) {
			const cgs = storyCgs[ev];
			const cgHashes = await mapLimit(cgs, async (c) => ({ file: c.file, hash: await ahash(c.thumb) }));
			const dupIds = [];
			for (const o of official) {
				if (!o.hash) continue;
				let best = null;
				for (const c of cgHashes) {
					if (!c.hash) continue;
					const d = hamming(o.hash, c.hash);
					if (d <= HAMMING_THRESHOLD && (!best || d < best.dist)) best = { file: c.file, dist: d };
				}
				if (best) {
					dupIds.push(o.id);
					console.log(`  重复: 官方 id=${o.id} <-> ${best.file}（距离 ${best.dist}）`);
				}
			}
			if (dupIds.length > 0) {
				(out[tag] ||= {})[ev] = dupIds;
				totalDup += dupIds.length;
				console.log(`  ${tag} × ${ev}：${dupIds.length}/${list.length} 张官方壁纸与留影重复`);
			}
		}
	}

	mkdirSync(dirname(OUT_PATH), { recursive: true });
	writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
	if (cacheDirty) {
		mkdirSync(dirname(CACHE_PATH), { recursive: true });
		writeFileSync(CACHE_PATH, JSON.stringify(hashCache), 'utf8');
	}
	console.log(`\n完成。写入 ${OUT_PATH}，共标记 ${totalDup} 张重复官方壁纸。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
