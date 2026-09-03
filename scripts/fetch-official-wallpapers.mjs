// 抓取官网「影像资料馆-壁纸」公开接口，生成 src/data/official-wallpapers.json
// 接口（无需登录）：/api/paperonetag → 一级分类；/api/papertwotag?paperonetag_id=N → 二级标签（活动名）；/api/paperlist?papertwotag_id=M → 壁纸列表
// 只存 CDN 直链元数据（横版 landscape + 竖版 portrait），不下载图片、不提交图片文件。
// 用法：node scripts/fetch-official-wallpapers.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'official-wallpapers.json');
const API = 'https://wqmt.aisnogames.com/api';

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
	Accept: 'application/json',
	Referer: 'https://wqmt.aisnogames.com/m/archives/gallery',
};

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchJson(path, params = {}, attempt = 1) {
	const qs = new URLSearchParams(params).toString();
	const url = `${API}/${path}${qs ? `?${qs}` : ''}`;
	let text;
	try {
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
		text = await res.text();
	} catch (err) {
		if (attempt <= 5) {
			console.warn(`  网络错误（${err.cause?.code || err.message}），第 ${attempt} 次重试...`);
			await sleep(5000 * attempt);
			return fetchJson(path, params, attempt + 1);
		}
		throw err;
	}
	const json = JSON.parse(text);
	if (json.ret !== 0) {
		if (attempt <= 3) {
			await sleep(3000 * attempt);
			return fetchJson(path, params, attempt + 1);
		}
		throw new Error(`${path} 返回错误: ${json.msg}`);
	}
	return json.data;
}

async function main() {
	console.log('获取壁纸一级分类...');
	const oneTags = (await fetchJson('paperonetag')).data;
	console.log(`  ${oneTags.length} 个分类：${oneTags.map((t) => `${t.title.trim()}(${t.id})`).join('、')}`);

	const out = {};
	for (const one of oneTags) {
		const category = one.title.trim();
		await sleep(600);
		const twoTags = (await fetchJson('papertwotag', { paperonetag_id: one.id })).data;
		console.log(`${category}：${twoTags.length} 个标签`);
		out[category] = {};
		for (const two of twoTags) {
			const tag = two.title.trim();
			await sleep(600);
			const list = (await fetchJson('paperlist', { papertwotag_id: two.id })).data;
			out[category][tag] = list.map((w) => ({
				id: w.id,
				title: w.title.trim(),
				landscape: w.landscape_url,
				portrait: w.portrait_url,
			}));
			console.log(`  ${tag}: ${list.length} 张`);
		}
	}

	mkdirSync(dirname(OUT_PATH), { recursive: true });
	writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
	const total = Object.values(out)
		.flatMap((tags) => Object.values(tags))
		.reduce((n, arr) => n + arr.length, 0);
	console.log(`\n完成。写入 ${OUT_PATH}，共 ${total} 张壁纸。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
