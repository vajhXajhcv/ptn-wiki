// 抓取《无期迷途》官网公开资讯，生成 src/content/updates/ 下的站点动态。
// 仅读取官网 /api/news 公开接口，不登录、不破解。
// 生成内容只保留标题、日期、类型与原文链接；正文不在仓库中托管，引导用户到官网阅读。

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UPDATES_DIR = join(ROOT, 'src', 'content', 'updates');

const API_BASE = 'https://wqmt.aisnogames.com/api';

mkdirSync(UPDATES_DIR, { recursive: true });

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

function inferType(title, category) {
	const t = title.toLowerCase();
	if (t.includes('维护') || t.includes('停服') || t.includes('修复')) return '维护公告';
	if (t.includes('更新') || t.includes('版本') || t.includes('优化')) return '版本更新';
	if (t.includes('活动') || category.includes('活动')) return '活动';
	return '其他';
}

function formatDate(iso) {
	const d = new Date(iso);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function sanitizeFilename(id) {
	return String(id);
}

function existingUpdateIds() {
	try {
		return readdirSync(UPDATES_DIR)
			.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
			.map((f) => f.replace(/\.(md|mdx)$/, ''));
	} catch {
		return [];
	}
}

// 角色相关类别已在角色图鉴中处理，这里跳过，避免重复
const CHARACTER_CATEGORIES = new Set([
	'禁闭者档案',
	'禁闭者影像捕获',
	'禁闭者装束',
	'MBCC生日会',
	'壁纸',
	'影像壁纸',
	'无期记事',
]);

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

	const existingIds = new Set(existingUpdateIds());

	// 取最近 60 条非角色资讯；若已存在则跳过，保留人工撰写的 updates
	const candidates = list
		.map((i) => ({ ...i, category: extractCategory(i.title) }))
		.filter((i) => !CHARACTER_CATEGORIES.has(i.category))
		.slice(0, 60);

	console.log(`2. 生成 updates（最近 ${candidates.length} 条非角色资讯）...`);
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const item of candidates) {
		const id = sanitizeFilename(item.id);
		const type = inferType(item.title, item.category);
		const date = formatDate(item.publish_time);
		const url = `https://wqmt.aisnogames.com/#/news/${item.id}`;
		const coverLine = item.cover ? `cover: ${item.cover}` : '';

		if (existingIds.has(id)) {
			// 已存在则仅更新元数据，保留可能的人工编辑内容
			const filePath = join(UPDATES_DIR, `${id}.md`);
			const oldContent = readFileSync(filePath, 'utf8');

			let newContent = oldContent;
			newContent = newContent.replace(/^title: .+$/m, `title: ${item.title.replace(/'/g, "''")}`);
			newContent = newContent.replace(/^date: .+$/m, `date: '${date}'`);
			newContent = newContent.replace(/^type: .+$/m, `type: '${type}'`);
			newContent = newContent.replace(/^source: .+$/m, `source: '${url}'`);
			if (coverLine) {
				if (/^cover: .+$/m.test(newContent)) {
					newContent = newContent.replace(/^cover: .+$/m, coverLine);
				} else {
					newContent = newContent.replace(/^source: '.*?'$/m, `source: '${url}'\n${coverLine}`);
				}
			}

			if (newContent !== oldContent) {
				writeFileSync(filePath, newContent, 'utf8');
				updated++;
				console.log(`   ↻ [${type}] ${date} - ${item.title}`);
			} else {
				skipped++;
			}
			continue;
		}

		const frontmatter = `---
title: ${item.title.replace(/'/g, "''")}
date: '${date}'
type: '${type}'
description: ''
source: '${url}'${coverLine ? '\n' + coverLine : ''}
tags: []
---

> 本文来自《无期迷途》官方网站，点击[阅读原文](${url})查看详情。
`;

		writeFileSync(join(UPDATES_DIR, `${id}.md`), frontmatter, 'utf8');
		created++;
		console.log(`   ✓ [${type}] ${date} - ${item.title}`);
	}

	console.log(`\n完成。新建 ${created} 条，更新 ${updated} 条，跳过 ${skipped} 条。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
