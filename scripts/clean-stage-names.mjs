// 清理从 BWiki 生成的关卡 frontmatter 中的 HTML 注释

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGES_DIR = join(__dirname, '..', 'src', 'content', 'stages');

function cleanComment(text) {
	return text.replace(/<!--.*?-->/g, '').trim();
}

let cleaned = 0;

for (const f of readdirSync(STAGES_DIR)) {
	if (!f.endsWith('.md')) continue;
	const filePath = join(STAGES_DIR, f);
	let content = readFileSync(filePath, 'utf8');

	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) continue;

	let newFm = fmMatch[1];
	let changed = false;

	for (const key of ['name', 'description']) {
		const regex = new RegExp(`^(${key}):\\s*(.+)$`, 'm');
		const match = newFm.match(regex);
		if (match) {
			const val = match[2].trim();
			const cleanVal = cleanComment(val);
			if (cleanVal !== val) {
				newFm = newFm.replace(match[0], `${key}: ${cleanVal}`);
				changed = true;
			}
		}
	}

	if (changed) {
		content = content.replace(fmMatch[0], `---\n${newFm}\n---`);
		writeFileSync(filePath, content, 'utf8');
		cleaned++;
		console.log(`   ✓ ${f}`);
	}
}

console.log(`\n完成。清理 ${cleaned} 个关卡文件。`);
