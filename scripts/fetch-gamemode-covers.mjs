// 为玩法（game-modes）从《无期迷途》官网公开资讯匹配官方配图。
//
// 说明：
// - 仅读取官网对外开放的 /api/news 接口（无需登录），与 fetch-official-resources.mjs 同源。
// - 按各玩法配置的关键词匹配资讯标题，取最新一条带封面的资讯，封面为官方 CDN 直链
//   （与 updates 集合的 cover 字段同一模式，不下载、不入库）。
// - 无对应资讯的玩法，从「影像壁纸 / 壁纸」类资讯中依次选取官方壁纸兜底。
// - 已配置 image 且已标注 imageSource 的玩法自动跳过；--force 强制重跑。
// - 同步打印「推荐默认 OG 图」（最新影像壁纸），用于 BaseHead.astro 的全站默认 OG。
//
// 合规提示：封面/壁纸版权归自意网络所有。本站仅以直链方式引用并标注来源。

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MODES_DIR = join(ROOT, 'src', 'content', 'game-modes');

const API_BASE = 'https://wqmt.aisnogames.com/api';
const FORCE = process.argv.includes('--force');

// 玩法 slug -> 官网资讯标题关键词（按优先级）
// 无关键词的玩法将使用官方壁纸兜底
const MODE_KEYWORDS = {
	'an-yu': ['破碎防线·暗域', '暗域'],
	'di-si-an-ying': ['狄斯暗影'],
	'gong-hui-zhan': ['灰烬之潮'], // 公会战玩法的官方名称
	'jian-guan-yu-pai-qian': ['MBCC监管报告'], // 监管玩法衍生官方栏目
	'po-sui-fang-xian': ['破碎防线'],
	'shu-ju-jian-xi': ['数据间隙'],
	'wu-jin-meng-yan': ['无尽梦魇'],
	// 以下玩法官网暂无对应资讯，走壁纸兜底：
	// ji-yi-feng-bao 记忆风暴 / pa-er-ma-fei-xu 帕尔马废墟
	// xin-cheng-te-xun 新城特训 / zhuo-an-zhi-jing 浊暗之阱
};

const WALLPAPER_CATEGORIES = new Set(['影像壁纸', '壁纸', '无期记事']);

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

function yamlSingle(value) {
	return `'${String(value).replace(/'/g, "''")}'`;
}

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
	console.log(`   共 ${list.length} 条资讯（按发布时间倒序）`);

	const news = list
		.map((i) => ({ ...i, category: extractCategory(i.title) }))
		.filter((i) => i.cover);

	const wallpapers = news.filter((i) => WALLPAPER_CATEGORIES.has(i.category));
	console.log(`   其中壁纸类 ${wallpapers.length} 条，可作为兜底与默认 OG`);

	console.log('2. 为玩法匹配官方配图...');
	const usedIds = new Set();
	const report = [];

	const pickByKeywords = (keywords) => {
		for (const kw of keywords) {
			const hit = news.find((i) => i.title.includes(kw) && !usedIds.has(i.id));
			if (hit) return { item: hit, via: `关键词「${kw}」` };
		}
		return null;
	};
	const pickWallpaper = () => {
		const hit = wallpapers.find((i) => !usedIds.has(i.id));
		return hit ? { item: hit, via: '官方壁纸兜底' } : null;
	};

	const files = readdirSync(MODES_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

	for (const f of files) {
		const slug = f.replace(/\.(md|mdx)$/, '');
		const filePath = join(MODES_DIR, f);
		const content = readFileSync(filePath, 'utf8');

		// 幂等跳过：已有 image 且已标注来源
		if (!FORCE && /^image: .+$/m.test(content) && /^imageSource:$/m.test(content)) {
			report.push({ slug, status: 'skipped' });
			continue;
		}

		const keywords = MODE_KEYWORDS[slug] || [];
		const picked = pickByKeywords(keywords) || pickWallpaper();
		if (!picked) {
			report.push({ slug, status: 'unmatched' });
			console.warn(`   ✗ ${slug}: 无可用配图`);
			continue;
		}

		const { item, via } = picked;
		usedIds.add(item.id);

		const block = [
			`image: ${item.cover}`,
			'imageSource:',
			`  category: ${item.category}`,
			`  title: ${item.title}`,
			`  url: https://wqmt.aisnogames.com/#/news/${item.id}`,
		].join('\n');

		// 移除旧的 image / imageSource，再写入新的
		let newContent = content
			.replace(/^image: .+\n/m, '')
			.replace(/^imageSource:\n(?:  .+\n)+/m, '');
		const fmEnd = newContent.indexOf('\n---', 3);
		newContent = `${newContent.slice(0, fmEnd)}\n${block}${newContent.slice(fmEnd)}`;
		writeFileSync(filePath, newContent);

		report.push({ slug, status: 'matched', via, title: item.title });
		console.log(`   ✓ ${slug} (${via}) -> ${item.title}`);
	}

	const og = wallpapers[0];
	console.log('\n3. 汇总');
	console.log(`   matched: ${report.filter((r) => r.status === 'matched').length}`);
	console.log(`   skipped: ${report.filter((r) => r.status === 'skipped').length}`);
	console.log(`   unmatched: ${report.filter((r) => r.status === 'unmatched').length}`);
	if (og) {
		console.log(`\n推荐默认 OG 图（最新影像壁纸「${og.title}」）：`);
		console.log(`   ${og.cover}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
