// 将自动生成的角色描述替换为原创描述，避免直接沿用 BWiki 的原文
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAR_DIR = join(__dirname, '..', 'src', 'content', 'characters');

const SLUGS = [
	'xiayin', 'guanxingzhe', 'dailun', 'naqia', 'aowu', 'luohou',
	'wendi', 'jiushijiu', 'pajiaqian', 'heluo', 'luliaika', 'puxila', 'langhuan',
	'yigeni', 'luweiyalei', 'weiduoliya', 'an', 'kamilian', 'fox',
	'leibinisi', 'jin', 'taitela', 'aien', 'tan',
	'fuluola', 'kk', 'demoli', 'peiji', 'koukou', 'chensha', 'kawakawa', 'chelsea',
];

function rewriteDescription(filePath) {
	let text = readFileSync(filePath, 'utf8');
	const frontMatch = text.match(/^---\n([\s\S]*?)\n---/);
	if (!frontMatch) return;

	const fm = frontMatch[1];
	const name = (fm.match(/name:\s*(.*)/) || [])[1]?.trim() || '';
	const rarity = (fm.match(/rarity:\s*(.*)/) || [])[1]?.trim() || '';
	const danger = (fm.match(/danger:\s*(.*)/) || [])[1]?.trim() || '';
	const role = (fm.match(/role:\s*(.*)/) || [])[1]?.trim() || '';

	const dangerDesc = {
		坚韧: '前排承伤与保护队友',
		狂暴: '近战物理输出与清理敌人',
		诡秘: '破核与切入后排',
		精准: '远程物理输出与打击关键目标',
		异能: '法术伤害与控场',
		启迪: '治疗与增益辅助',
	}[danger] || '多功能作战';

	let newDesc = `${name}是一名${rarity}级${danger}禁闭者，主要负责${dangerDesc}。`;
	if (role) newDesc += `在队伍中常担任${role}位置。`;

	const newFm = fm.replace(/description:\s*.*/, `description: ${newDesc}`);
	text = text.replace(frontMatch[0], `---\n${newFm}\n---`);

	// 同时把正文里直接引用特性的那一句去掉，换成通用描述
	text = text.replace(
		/其核心机制可以概括为：.*/,
		`是一名值得培养的${rarity}级${danger}角色。`
	);

	writeFileSync(filePath, text, 'utf8');
}

for (const slug of SLUGS) {
	const path = join(CHAR_DIR, `${slug}.md`);
	try {
		rewriteDescription(path);
		console.log(`✓ ${slug}`);
	} catch (err) {
		console.error(`✗ ${slug}: ${err.message}`);
	}
}
