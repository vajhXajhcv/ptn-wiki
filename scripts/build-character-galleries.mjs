// 生成禁闭者画廊数据：为每个角色收集官网公开资讯中的全部相关图片。
//
// 说明：
// - 仅读取官网对外开放的 /api/news 列表接口（每条资讯自带 cover 封面，无需逐条抓详情页）。
// - 匹配逻辑与 fetch-official-resources.mjs 一致（角色名提取、归一化、绰号映射）。
// - 覆盖类别：禁闭者档案 / 禁闭者影像捕获 / 禁闭者装束 / MBCC生日会 / 壁纸 / 影像壁纸 / 无期记事。
// - 输出 src/data/galleries.json（纯元数据：cover CDN 直链 + 分类 + 标题 + 官网链接），提交进 git。
// - 角色详情页据此渲染「禁闭者画廊」区块；主图（三阶立绘）不在画廊内。
//
// 合规提示：封面版权归自意网络所有，本站仅以直链方式引用并标注来源。

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const DATA_DIR = join(ROOT, 'src', 'data');

const API_BASE = 'https://wqmt.aisnogames.com/api';

const GALLERY_CATEGORIES = ['禁闭者档案', '禁闭者影像捕获', '禁闭者装束', 'MBCC生日会', '壁纸', '影像壁纸', '无期记事'];

// 与 fetch-official-resources.mjs 保持一致
const NICKNAME_MAP = {
	'EMP': '艾米潘',
	'K.K.': '蔻蔻',
	'KK': '蔻蔻',
};

mkdirSync(DATA_DIR, { recursive: true });

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
	const m1 = t.match(/[「『]([^」』]+)[」』]/);
	if (m1) return m1[1].trim();
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
		return { slug: f.replace(/\.(md|mdx)$/, ''), name: nameMatch ? nameMatch[1].trim() : '' };
	});
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
	console.log(`   共 ${list.length} 条资讯`);

	// 按角色名归聚官方资讯
	const byName = new Map();
	for (const item of list) {
		const category = extractCategory(item.title);
		if (!GALLERY_CATEGORIES.includes(category) || !item.cover) continue;
		const key = normalizeName(extractSubject(item.title));
		if (!key) continue;
		if (!byName.has(key)) byName.set(key, []);
		byName.get(key).push({
			cover: item.cover,
			category,
			title: item.title,
			url: `https://wqmt.aisnogames.com/#/news/${item.id}`,
			id: item.id,
		});
	}

	console.log('2. 为角色聚合画廊条目...');
	const galleries = {};
	let total = 0;
	for (const c of localChars()) {
		const key = NICKNAME_MAP[c.name] ? normalizeName(NICKNAME_MAP[c.name]) : normalizeName(c.name);
		const items = byName.get(key);
		if (!items || items.length === 0) continue;
		// 按资讯 id 倒序（新的在前），去重
		const seen = new Set();
		galleries[c.slug] = items
			.sort((a, b) => b.id - a.id)
			.filter((i) => {
				if (seen.has(i.id)) return false;
				seen.add(i.id);
				return true;
			})
			.map(({ cover, category, title, url }) => ({ cover, category, title, url }));
		total += galleries[c.slug].length;
	}

	writeFileSync(join(DATA_DIR, 'galleries.json'), JSON.stringify(galleries, null, 2));
	console.log(`3. 完成。${Object.keys(galleries).length} 名角色，共 ${total} 条画廊条目 -> src/data/galleries.json`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
