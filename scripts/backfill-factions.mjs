// 从 BWiki 角色页面批量补全 characters 的 faction 字段
// 用法：node scripts/backfill-factions.mjs [--force] [--dry-run]
// 默认只处理 faction 为空的角色；--force 重新校验全部；--dry-run 只打印不写文件

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'characters');
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 2000;

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchRaw(page, attempt = 1) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvslots=main&rvprop=content&format=json`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
	});
	const text = await res.text();
	if (!text.trimStart().startsWith('{')) {
		if (attempt <= 3) {
			console.warn(`  ${page} 被限流，第 ${attempt} 次重试...`);
			await sleep(3000 * attempt);
			return fetchRaw(page, attempt + 1);
		}
		throw new Error('返回非 JSON，可能触发反爬');
	}
	return text;
}

// 从页面 wikitext 中提取 |阵营=xxx（档案区参数）
function extractFaction(content) {
	const m = content.match(/\|阵营=([^\n|]*)/);
	if (!m) return '';
	return m[1]
		.replace(/\{\{.*?\}\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<[^>]+>/g, '')
		.trim();
}

async function main() {
	const files = readdirSync(OUT_DIR).filter((f) => f.endsWith('.md'));
	const targets = [];

	for (const file of files) {
		const content = readFileSync(join(OUT_DIR, file), 'utf8');
		const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
		if (!name) continue;
		const faction = content.match(/^faction:\s*(.*)$/m)?.[1]?.trim() ?? '';
		const isEmpty = !faction || faction === "''" || faction === '""';
		if (isEmpty || FORCE) targets.push({ file, name });
	}

	console.log(`共 ${files.length} 名角色，需补全阵营 ${targets.length} 名${FORCE ? '（--force）' : ''}`);

	let updated = 0;
	let unchanged = 0;
	let missing = 0;
	let failed = 0;

	for (const { file, name } of targets) {
		try {
			const text = await fetchRaw(`禁闭者:${name}`);
			const json = JSON.parse(text);
			const pageData = Object.values(json.query.pages)[0];
			const wikitext = pageData.revisions?.[0]?.slots?.main?.['*'] || '';
			const faction = extractFaction(wikitext);
			if (!faction) {
				console.log(`- ${name}：BWiki 无阵营信息`);
				missing++;
			} else {
				const path = join(OUT_DIR, file);
				const content = readFileSync(path, 'utf8');
				const newContent = content.replace(/^faction:.*$/m, `faction: ${faction}`);
				if (newContent === content) {
					console.log(`= ${name}：阵营未变化（${faction}）`);
					unchanged++;
				} else {
					if (!DRY_RUN) writeFileSync(path, newContent, 'utf8');
					console.log(`✓ ${name} -> ${faction}`);
					updated++;
				}
			}
		} catch (err) {
			console.error(`✗ ${name}: ${err.message}`);
			failed++;
		}
		await sleep(DELAY_MS);
	}

	console.log(`\n完成。更新 ${updated}，未变化 ${unchanged}，无数据 ${missing}，失败 ${failed}${DRY_RUN ? '（dry-run）' : ''}。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
