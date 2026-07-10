// 基于已有的 official-character-matches.json，给每个角色 Markdown 补上 imageSource 字段。
// 不会重新下载图片，只更新 frontmatter 中的来源标注。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const REPORT = join(__dirname, 'tmp', 'official-character-matches.json');

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
let updated = 0;
let skipped = 0;

for (const record of report.records || []) {
	if (record.status !== 'ok') {
		skipped++;
		continue;
	}

	const filePath = join(CHAR_DIR, `${record.slug}.md`);
	let content;
	try {
		content = readFileSync(filePath, 'utf8');
	} catch {
		console.log(`   跳过（文件不存在）: ${record.slug}`);
		skipped++;
		continue;
	}

	const newsUrl = `https://wqmt.aisnogames.com/#/news/${record.newsId}`;
	const sourceYaml = `imageSource:\n  category: ${record.category}\n  title: ${record.title}\n  url: ${newsUrl}`;

	let newContent = content;
	const oldSourceBlock = content.match(/^imageSource:\n(?:[ \t]+[^\n]*\n)+/m)?.[0];
	if (oldSourceBlock) {
		newContent = newContent.replace(oldSourceBlock, sourceYaml + '\n');
	} else {
		const imageLine = content.match(/^image:\s*.+$/m)?.[0];
		if (imageLine) {
			newContent = newContent.replace(imageLine, `${imageLine}\n${sourceYaml}`);
		}
	}

	if (newContent !== content) {
		writeFileSync(filePath, newContent, 'utf8');
		updated++;
		console.log(`   ✓ ${record.name} <- ${record.category}`);
	} else {
		skipped++;
	}
}

console.log(`\n完成。更新 ${updated} 个角色，跳过 ${skipped} 个。`);
