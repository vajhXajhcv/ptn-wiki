// 将现有 BWiki 关卡文件迁移到新的结构化 schema，并清理 HTML 注释与 wiki 残留

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGES_DIR = join(__dirname, '..', 'src', 'content', 'stages');

function cleanHtmlComments(text) {
	return text.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function cleanWikiMarkup(text) {
	return text
		.replace(/\[\[[^\]|]+\|([^\]]*)\]\]/g, '$1')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/\[\[[^\]]*$/g, '')
		.replace(/\{\{[^}]+\}\}/g, '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(text) {
	if (!text) return '';
	return cleanWikiMarkup(cleanHtmlComments(text)).replace(/[、，；：\s]+$/g, '');
}

function parseScalar(value) {
	value = value.trim();
	if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
		const quote = value[0];
		return value.slice(1, -1).replace(new RegExp(`${quote}${quote}`, 'g'), quote);
	}
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (value === 'null' || value === '~') return null;
	if (/^\d+$/.test(value)) return parseInt(value, 10);
	if (/^\[.*\]$/.test(value)) {
		return value.slice(1, -1).split(',').map((s) => parseScalar(s.trim())).filter((s) => s !== '');
	}
	if (/^\{.*\}$/.test(value)) {
		const obj = {};
		const inner = value.slice(1, -1);
		const parts = inner.split(',').map((s) => s.trim());
		for (const part of parts) {
			const eq = part.indexOf(':');
			if (eq > 0) {
				obj[part.slice(0, eq).trim()] = parseScalar(part.slice(eq + 1).trim());
			}
		}
		return obj;
	}
	return value;
}

function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return { frontmatter: null, body: content };
	const rawLines = match[1].split('\n');
	const data = {};
	let i = 0;
	while (i < rawLines.length) {
		const line = rawLines[i];
		const keyMatch = line.match(/^(\w+):\s*(.*)$/);
		if (!keyMatch) {
			i++;
			continue;
		}
		const key = keyMatch[1];
		const firstValue = keyMatch[2].trim();
		i++;
		// 数组对象：key:\n  - { ... }\n  - { ... }
		// 兼容已损坏的单行格式：key: - { ... } - { ... }
		if (firstValue.startsWith('- {') || (firstValue === '' && i < rawLines.length && /^\s*-\s*\{/.test(rawLines[i]))) {
			const arr = [];
			if (firstValue.startsWith('- {')) {
				const items = firstValue.match(/-\s*\{[^}]+\}/g) || [];
				for (const item of items) {
					arr.push(parseScalar(item.replace(/^-\s*/, '').trim()));
				}
				data[key] = arr;
				continue;
			}
			while (i < rawLines.length && /^\s*-/.test(rawLines[i])) {
				const itemLine = rawLines[i].trim().replace(/^-\s*/, '').trim();
				arr.push(parseScalar(itemLine));
				i++;
			}
			data[key] = arr;
			continue;
		}
		// 多行标量（缩进续行）
		if (firstValue === '' && i < rawLines.length && (rawLines[i].startsWith(' ') || rawLines[i].startsWith('\t'))) {
			let value = '';
			while (i < rawLines.length && (rawLines[i].startsWith(' ') || rawLines[i].startsWith('\t'))) {
				value += (value ? '\n' : '') + rawLines[i];
				i++;
			}
			data[key] = value.trim();
			continue;
		}
		data[key] = parseScalar(firstValue);
	}
	return { frontmatter: data, body: content.slice(match[0].length).trim() };
}

function stringifyFrontmatter(data) {
	const keys = [
		'name',
		'chapter',
		'stageNumber',
		'difficulty',
		'recommendedLevel',
		'description',
		'cost',
		'sanity',
		'moves',
		'enemySummary',
		'enemies',
		'objectives',
		'firstClearReward',
		'sRankReward',
		'stageReward',
		'mechanics',
		'strategy',
		'tags',
	];
	let out = '---\n';
	for (const key of keys) {
		const value = data[key];
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			if (typeof value[0] === 'object') {
				out += `${key}:\n`;
				for (const item of value) {
					const entries = Object.entries(item)
						.filter(([, v]) => v !== undefined)
						.map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${escapeYaml(v)}'` : v}`)
						.join(', ');
					out += `  - { ${entries} }\n`;
				}
			} else {
				out += `${key}: [${value.map((v) => `'${escapeYaml(v)}'`).join(', ')}]\n`;
			}
		} else if (typeof value === 'object') {
			const entries = Object.entries(value)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => `${k}: ${v}`)
				.join(', ');
			if (!entries) continue;
			out += `${key}: { ${entries} }\n`;
		} else if (typeof value === 'number') {
			out += `${key}: ${value}\n`;
		} else {
			out += `${key}: ${value === '' ? "''" : value}\n`;
		}
	}
	out += '---\n';
	return out;
}

function escapeYaml(text) {
	return String(text).replace(/'/g, "''");
}

function parseEnemyList(text) {
	if (!text) return [];
	const parts = text.split('+').map((p) => p.trim()).filter(Boolean);
	const enemies = [];
	for (const part of parts) {
		const match = part.match(/^(.+?)\*(\d+)$/);
		if (match) {
			const rawName = match[1].trim();
			const count = parseInt(match[2], 10);
			const elite = rawName.includes('·精英') || rawName.includes('·精英');
			const name = rawName.replace(/·精英/g, '').trim();
			enemies.push({ name, count, elite });
		} else {
			enemies.push({ name: part, elite: false });
		}
	}
	return enemies;
}

function extractInfoItem(body, label) {
	const regex = new RegExp(`- \\*\\*${label}\\*\\*：(.*?)\\n`, 'i');
	const match = body.match(regex);
	return match ? cleanText(match[1]) : '';
}

function migrateFile(file) {
	const path = join(STAGES_DIR, file);
	const content = readFileSync(path, 'utf8');
	const { frontmatter: fm, body } = parseFrontmatter(content);
	if (!fm) return false;

	// 清理 frontmatter
	const newFm = { ...fm };
	for (const key of Object.keys(newFm)) {
		if (typeof newFm[key] === 'string') {
			newFm[key] = cleanText(newFm[key]);
		}
	}

	// 从正文中提取结构化字段（仅当 frontmatter 中不存在时）
	if (newFm.cost === undefined) {
		const costStr = extractInfoItem(body, '消耗体力');
		if (costStr) newFm.cost = parseInt(costStr, 10);
	}
	if (newFm.sanity === undefined) {
		const sanityStr = extractInfoItem(body, '神智值');
		if (sanityStr) newFm.sanity = parseInt(sanityStr, 10);
	}
	if (newFm.moves === undefined) {
		const movesStr = extractInfoItem(body, '移动次数');
		if (movesStr) newFm.moves = parseInt(movesStr, 10);
	}

	if (!newFm.enemySummary) {
		const minionsStr = extractInfoItem(body, '小怪数量');
		const elitesStr = extractInfoItem(body, '精英数量');
		if (minionsStr || elitesStr) {
			newFm.enemySummary = {};
			if (minionsStr) newFm.enemySummary.minions = parseInt(minionsStr, 10);
			if (elitesStr) newFm.enemySummary.elites = parseInt(elitesStr, 10);
		}
	}

	if (!newFm.enemies) {
		const monsters = extractInfoItem(body, '怪物信息');
		if (monsters) {
			const enemies = parseEnemyList(monsters);
			if (enemies.length > 0) newFm.enemies = enemies;
		}
	}

	if (!newFm.objectives) {
		const sTask = extractInfoItem(body, 'S级任务');
		if (sTask) {
			newFm.objectives = sTask.split(/；|;|\n/).map((s) => s.trim()).filter(Boolean);
		}
	}

	if (newFm.firstClearReward === undefined) {
		const firstReward = cleanWikiMarkup(extractInfoItem(body, '首通奖励'));
		if (firstReward) newFm.firstClearReward = firstReward;
	}
	if (newFm.sRankReward === undefined) {
		const sReward = cleanWikiMarkup(extractInfoItem(body, 'S级奖励'));
		if (sReward) newFm.sRankReward = sReward;
	}
	if (newFm.stageReward === undefined) {
		const stageReward = cleanWikiMarkup(extractInfoItem(body, '关卡奖励'));
		if (stageReward) newFm.stageReward = stageReward;
	}

	// 清理为空或只剩标点的奖励字段
	for (const key of ['firstClearReward', 'sRankReward', 'stageReward']) {
		if (newFm[key] && !String(newFm[key]).replace(/[、，；：\s]+$/g, '')) {
			delete newFm[key];
		}
	}

	// 推荐等级数值化
	if (newFm.recommendedLevel && typeof newFm.recommendedLevel === 'string') {
		const lvl = parseInt(newFm.recommendedLevel, 10);
		if (!Number.isNaN(lvl)) newFm.recommendedLevel = lvl;
		else delete newFm.recommendedLevel;
	}

	// stageNumber 规范化：若 chapter 可提取数字且 stageNumber 不含 -，则补全章节前缀
	if (newFm.chapter && newFm.stageNumber && !String(newFm.stageNumber).includes('-')) {
		const chapterNum = String(newFm.chapter).replace(/[^\d]/g, '');
		if (chapterNum) newFm.stageNumber = `${chapterNum}-${newFm.stageNumber}`;
	}

	// 清理正文：移除 HTML 注释和 wiki 残留
	let newBody = body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\[\[[^\]]+\]\]/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	// 移除迁移到 frontmatter 的"关卡信息"区块，保留攻略正文
	newBody = newBody.replace(/## 关卡信息[\s\S]*?(?=\n## |\Z)/, '');

	// 清理空标题
	newBody = newBody.replace(/## [^\n]+\n\n*(?=## |\Z)/g, '');
	newBody = newBody.replace(/\n{3,}/g, '\n\n').trim();

	// 保留通用占位提示，但提示待补充
	if (newBody.includes('根据敌人配置选择物理或法术输出核心')) {
		newBody = newBody.replace(
			/## 通关思路\n\n1\. 根据敌人配置选择物理或法术输出核心。\n2\. 坚韧职业前排承伤，启迪职业保证续航。\n3\. 合理利用地形与权能，优先击破精英敌人核心。/,
			'## 通关思路\n\n> 该关卡攻略待补充，欢迎参考 BWiki 或社区攻略进行完善。\n\n1. 根据敌人配置选择物理或法术输出核心。\n2. 坚韧职业前排承伤，启迪职业保证续航。\n3. 合理利用地形与权能，优先击破精英敌人核心。'
		);
	}

	writeFileSync(path, stringifyFrontmatter(newFm) + '\n' + newBody + '\n', 'utf8');
	return true;
}

let migrated = 0;
for (const file of readdirSync(STAGES_DIR)) {
	if (!file.endsWith('.md')) continue;
	if (migrateFile(file)) {
		migrated++;
		console.log(`✓ ${file}`);
	}
}
console.log(`\n完成。迁移 ${migrated} 个关卡文件。`);
