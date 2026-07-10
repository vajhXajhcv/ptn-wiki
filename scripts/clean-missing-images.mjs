// 清理角色 frontmatter 中指向不存在的本地图片的 image / imageSource 字段
// 这样页面不会显示 broken image，等官网放出素材后再次运行 fetch-official-resources 即可恢复

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const PUBLIC_CHAR_DIR = join(ROOT, 'public', 'characters');

const images = new Set(readdirSync(PUBLIC_CHAR_DIR).filter((f) => f.endsWith('.jpg')));

let cleaned = 0;

for (const f of readdirSync(CHAR_DIR)) {
	if (!f.endsWith('.md')) continue;
	const filePath = join(CHAR_DIR, f);
	let content = readFileSync(filePath, 'utf8');

	const imageMatch = content.match(/^image:\s*(.+)$/m);
	if (!imageMatch) continue;

	const imagePath = imageMatch[1].trim();
	const filename = imagePath.replace(/^\/characters\//, '');
	if (!filename || images.has(filename)) continue;

	// 删除 image 行和 imageSource 块
	let newContent = content.replace(/^image:\s*.+\n/m, '');
	newContent = newContent.replace(/^imageSource:\n(?:[ \t]+[^\n]*\n)+/m, '');
	// 清理连续空行
	newContent = newContent.replace(/\n{3,}/g, '\n\n');

	if (newContent !== content) {
		writeFileSync(filePath, newContent, 'utf8');
		cleaned++;
		console.log(`   ✓ ${f}：移除缺失图片 ${filename}`);
	}
}

console.log(`\n完成。清理 ${cleaned} 个角色的缺失图片引用。`);
