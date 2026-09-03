// 解析 BWiki「主线剧情」索引页，生成 主线剧情页 → 章节名候选 映射 src/data/main-story-chapters.json
// 索引结构：每个章节一个 resp-tab-content 块，块内有一张「留影 XXX」海报（= CG 合集名）；
// 块内表格行标题为「混沌彼岸A / 混沌彼岸B」等（去掉 A/B 后缀即章节名）。
// 映射值形如 ["混沌彼岸", "混沌彼岸"]（行名优先，海报名兜底），页面端按顺序匹配 CG 数据。
// 用法：node scripts/build-main-chapter-map.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'main-story-chapters.json');

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
	Accept: 'application/json, text/javascript, */*; q=0.01',
	Referer: 'https://wiki.biligame.com/wqmt/',
	'X-Requested-With': 'XMLHttpRequest',
};

async function fetchPage(page, attempt = 1) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvslots=main&rvprop=content&format=json`;
	const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
	const text = await res.text();
	if (!text.trimStart().startsWith('{')) {
		if (attempt <= 3) {
			await new Promise((r) => setTimeout(r, 3000 * attempt));
			return fetchPage(page, attempt + 1);
		}
		throw new Error('返回非 JSON，可能触发反爬');
	}
	const json = JSON.parse(text);
	const p = Object.values(json.query.pages)[0];
	return p.revisions?.[0]?.slots?.main?.['*'] || '';
}

function slugify(pageName) {
	return pageName
		.replace(/[\/\\?%*:|"<>]/g, '-')
		.replace(/\s+/g, '-')
		.toLowerCase();
}

// 行标题归一化：去掉 A/B 分卷后缀与空白（混沌彼岸A → 混沌彼岸）
function normRowName(label) {
	return label.trim().replace(/[\s　]*[ABab]$/, '');
}

function parseBlock(block, map, extraName = null) {
	// 块内海报：[[文件:留影 {章节}-....png]]
	const posterMatch = block.match(/\[\[文件:留影 ([^-\]|]+?)-[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/);
	const poster = posterMatch ? posterMatch[1].trim() : null;

	// 逐行扫描：行标题（! 开头）之后出现的剧情按钮归入该行
	const lines = block.split('\n');
	let currentRow = null;
	for (const line of lines) {
		const rowMatch = line.match(/^![^|\n]*\|\s*(.+?)\s*$/);
		if (rowMatch && !rowMatch[1].includes('{{')) {
			currentRow = normRowName(rowMatch[1]);
		}
		for (const m of line.matchAll(/\{\{板块\|按钮\|([^|]+)\|[^}]+\}\}/g)) {
			const page = m[1].trim();
			if (!page.endsWith('剧情')) continue;
			const slug = slugify(page);
			// 候选：行名（若有）+ 海报名 + 导航模板名，去重
			const candidates = [...new Set([currentRow, poster, extraName].filter(Boolean))];
			if (candidates.length > 0 && !map[slug]) map[slug] = candidates;
		}
	}
}

async function main(content) {
	// 按 tab 内容块切分
	const blocks = content.split(/<div class="resp-tab-content"[^>]*>/).slice(1);
	const map = {};

	for (const block of blocks) {
		parseBlock(block, map);
		// 块内可能嵌入导航模板 {{:残锋剧情导航}}，按钮在模板里
		for (const m of block.matchAll(/\{\{:([^}]+剧情导航)\}\}/g)) {
			const navName = m[1].trim();
			const chapterName = navName.replace(/剧情导航$/, '');
			try {
				const navContent = await fetchPage(navName);
				parseBlock(navContent, map, chapterName);
				console.log(`  导航模板 ${navName} 已解析`);
			} catch (err) {
				console.warn(`  ${navName} 读取失败: ${err.message}`);
			}
			await new Promise((r) => setTimeout(r, 800));
		}
	}
	return map;
}

const content = await fetchPage('主线剧情');
if (!content) throw new Error('主线剧情索引为空');
const map = await main(content);
writeFileSync(OUT_PATH, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(`完成。${Object.keys(map).length} 个主线剧情页 -> ${OUT_PATH}`);
const chapterNames = new Set(Object.values(map).flat());
console.log(`章节名候选：${[...chapterNames].join('、')}`);
