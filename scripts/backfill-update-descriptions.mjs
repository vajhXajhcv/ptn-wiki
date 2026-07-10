// 一次性回填：为 src/content/updates/ 下 description 为空的文件从官网拉取摘要。
// 运行方式：node scripts/backfill-update-descriptions.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UPDATES_DIR = join(ROOT, 'src', 'content', 'updates');

const API_BASE = 'https://wqmt.aisnogames.com/api';

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

function stripHtml(html) {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[\n\r]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function truncateDescription(text, maxLength = 120) {
	if (!text) return '';
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength);
	const lastPunct = Math.max(truncated.lastIndexOf('。'), truncated.lastIndexOf('，'), truncated.lastIndexOf(' '));
	return (lastPunct > maxLength * 0.6 ? truncated.slice(0, lastPunct + 1) : truncated) + '……';
}

async function main() {
	const files = readdirSync(UPDATES_DIR).filter((f) => f.endsWith('.md'));
	let filled = 0;
	let skipped = 0;
	let failed = 0;

	for (const file of files) {
		const filePath = join(UPDATES_DIR, file);
		const content = readFileSync(filePath, 'utf8');
		const descMatch = content.match(/^description:\s*(.*)$/m);
		const currentDesc = descMatch ? descMatch[1].trim() : '';

		if (currentDesc && currentDesc !== "''") {
			skipped++;
			continue;
		}

		const id = file.replace(/\.md$/, '');
		try {
			const detail = await api(`/news/${id}`);
			const html = detail?.[0]?.content_html || '';
			const text = stripHtml(html);
			const description = truncateDescription(text);
			if (description) {
				const newContent = content.replace(/^description:.*$/m, `description: ${description.replace(/'/g, "''")}`);
				writeFileSync(filePath, newContent, 'utf8');
				filled++;
				console.log(`✓ ${id}: ${description.slice(0, 60)}...`);
			} else {
				skipped++;
				console.log(`○ ${id}: 无正文`);
			}
		} catch (err) {
			failed++;
			console.warn(`✗ ${id}: ${err.message}`);
		}
		await sleep(300);
	}

	console.log(`\n完成。回填 ${filled} 条，跳过 ${skipped} 条，失败 ${failed} 条。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
