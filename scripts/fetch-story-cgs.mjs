// 枚举 BWiki「分类:留影」下的剧情 CG，生成 src/data/story-cgs.json
// 只保存 CDN 直链元数据（thumb 为 1280 宽缩略图，full 为原图），不下载图片、不提交图片文件
// 用法：node scripts/fetch-story-cgs.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'story-cgs.json');
const API = 'https://wiki.biligame.com/wqmt/api.php';
const THUMB_WIDTH = 1280;
const BATCH_SIZE = 50;

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
	Accept: 'application/json, text/javascript, */*; q=0.01',
	'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
	Referer: 'https://wiki.biligame.com/wqmt/',
	'X-Requested-With': 'XMLHttpRequest',
};

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchJson(params, attempt = 1) {
	const url = `${API}?${params}&format=json`;
	let text;
	try {
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
		text = await res.text();
	} catch (err) {
		if (attempt <= 5) {
			console.warn(`  网络错误（${err.cause?.code || err.message}），第 ${attempt} 次重试...`);
			await sleep(5000 * attempt);
			return fetchJson(params, attempt + 1);
		}
		throw err;
	}
	if (!text.trimStart().startsWith('{')) {
		if (attempt <= 5) {
			console.warn(`  被限流，第 ${attempt} 次重试...`);
			await sleep(3000 * attempt);
			return fetchJson(params, attempt + 1);
		}
		throw new Error('返回非 JSON，可能触发反爬');
	}
	return JSON.parse(text);
}

// 1. 枚举分类:留影全部成员（处理 cmcontinue 分页）
async function listCategoryMembers() {
	const titles = [];
	let cmcontinue = '';
	do {
		const params = new URLSearchParams({
			action: 'query',
			list: 'categorymembers',
			cmtitle: '分类:留影',
			cmnamespace: '6',
			cmlimit: '500',
		});
		if (cmcontinue) params.set('cmcontinue', cmcontinue);
		const json = await fetchJson(params.toString());
		for (const m of json.query?.categorymembers || []) titles.push(m.title);
		cmcontinue = json.continue?.cmcontinue || '';
		console.log(`  已枚举 ${titles.length} 个文件${cmcontinue ? '，继续翻页...' : ''}`);
		if (cmcontinue) await sleep(800);
	} while (cmcontinue);
	return titles;
}

// 2. 解析文件名：留影 {活动}-{罗马数字}(-男|-女)?.png -> 活动名
const FILE_RE = /^文件:留影\s+(.+)-([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+(?:-[男女])?)\.(?:png|jpg|jpeg|webp)$/iu;
function parseEvent(title) {
	const m = title.match(FILE_RE);
	return m ? m[1].trim() : null;
}

// 3. 批量 imageinfo 拿 thumburl / url / 尺寸
async function fetchImageInfos(titles) {
	const infos = new Map();
	for (let i = 0; i < titles.length; i += BATCH_SIZE) {
		const batch = titles.slice(i, i + BATCH_SIZE);
		const params = new URLSearchParams({
			action: 'query',
			prop: 'imageinfo',
			iiprop: 'url|size',
			iiurlwidth: String(THUMB_WIDTH),
			titles: batch.join('|'),
		});
		const json = await fetchJson(params.toString());
		for (const page of Object.values(json.query?.pages || {})) {
			const info = page.imageinfo?.[0];
			if (!info) continue;
			infos.set(page.title, {
				file: page.title.replace(/^文件:/, ''),
				thumb: info.thumburl || info.url,
				full: info.url,
				width: info.width,
				height: info.height,
			});
		}
		console.log(`  imageinfo ${Math.min(i + BATCH_SIZE, titles.length)}/${titles.length}`);
		if (i + BATCH_SIZE < titles.length) await sleep(800);
	}
	return infos;
}

async function main() {
	console.log('枚举 分类:留影 ...');
	const members = await listCategoryMembers();

	const byEvent = new Map();
	let skipped = 0;
	for (const title of members) {
		if (!title.startsWith('文件:留影')) {
			skipped++;
			continue;
		}
		const event = parseEvent(title);
		if (!event) {
			console.warn(`  无法解析文件名，跳过: ${title}`);
			skipped++;
			continue;
		}
		if (!byEvent.has(event)) byEvent.set(event, []);
		byEvent.get(event).push(title);
	}
	console.log(`共 ${members.length} 个文件，留影 CG ${members.length - skipped} 张，跳过 ${skipped} 个，涉及 ${byEvent.size} 个活动`);

	const allTitles = [...byEvent.values()].flat();
	console.log('获取图片信息...');
	const infos = await fetchImageInfos(allTitles);

	const out = {};
	for (const event of [...byEvent.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
		const items = byEvent
			.get(event)
			.map((t) => infos.get(t))
			.filter(Boolean)
			.sort((a, b) => a.file.localeCompare(b.file, 'zh-CN', { numeric: true }));
		if (items.length > 0) out[event] = items;
	}

	mkdirSync(dirname(OUT_PATH), { recursive: true });
	writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
	const total = Object.values(out).reduce((n, arr) => n + arr.length, 0);
	console.log(`\n完成。写入 ${OUT_PATH}：${Object.keys(out).length} 个活动，共 ${total} 张留影 CG。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
