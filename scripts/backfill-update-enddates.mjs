// 为 src/content/updates/ 下的存量公告回填活动时间区间（startDate / endDate）。
// 解析规则见 scripts/lib/parse-event-dates.mjs：只接受明确的「开始 ~ 结束」区间，
// 解析不出时不写入任何字段。幂等：已有 startDate/endDate 的文件默认跳过，--force 强制重跑。

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEventRange } from './lib/parse-event-dates.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UPDATES_DIR = join(ROOT, 'src', 'content', 'updates');

const API_BASE = 'https://wqmt.aisnogames.com/api';
const FORCE = process.argv.includes('--force');
const DELAY_MS = 400;

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchDetailText(id) {
	const res = await fetch(`${API_BASE}/news/${id}`, {
		headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
		signal: AbortSignal.timeout(30_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = await res.json();
	const html = json.data?.[0]?.content_html || '';
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

async function main() {
	const files = readdirSync(UPDATES_DIR).filter((f) => /^\d+\.md$/.test(f));
	console.log(`共 ${files.length} 条公告${FORCE ? '（--force 全量重跑）' : ''}`);

	let written = 0;
	let noRange = 0;
	let skipped = 0;
	let failed = 0;

	for (const file of files) {
		const id = file.replace(/\.md$/, '');
		const path = join(UPDATES_DIR, file);
		const content = readFileSync(path, 'utf8');

		if (!FORCE && /^startDate:/m.test(content)) {
			skipped++;
			continue;
		}

		const publishDate = content.match(/^date:\s*'([^']+)'/m)?.[1];
		try {
			const text = await fetchDetailText(id);
			const range = parseEventRange(text, publishDate);

			let next = content.replace(/^startDate:.*\r?\n?/m, '').replace(/^endDate:.*\r?\n?/m, '');
			if (range) {
				next = next.replace(/^date: .+$/m, `$&\nstartDate: '${range.start}'\nendDate: '${range.end}'`);
				written++;
				console.log(`   ✓ ${id} ${range.start} ~ ${range.end}`);
			} else {
				noRange++;
			}
			if (next !== content) writeFileSync(path, next, 'utf8');
		} catch (err) {
			failed++;
			console.warn(`   ✗ ${id}: ${err.message}`);
		}
		await sleep(DELAY_MS);
	}

	console.log(`\n完成。写入区间 ${written} 条，无可解析区间 ${noRange} 条，跳过 ${skipped} 条，失败 ${failed} 条。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
