// 为角色 frontmatter 追加 aliases（别名/昵称）。
// 设计为可消费外部 JSON（如 gchar / Hugging Face game_characters / BWiki 重定向导出），
// 同时内置一份常见别名字典作为 fallback，确保开箱即用。
//
// 用法：
//   node scripts/enrich-characters-from-gchar.mjs
//   node scripts/enrich-characters-from-gchar.mjs --dry-run
//   node scripts/enrich-characters-from-gchar.mjs --input scripts/tmp/character-aliases.json
//
// 外部 JSON 格式：
//   {
//     "蔻蔻": ["K.K.", "kk", "Koukou"],
//     "艾米潘": ["EMP"]
//   }

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const ALIASES_FILE = join(__dirname, 'tmp', 'character-aliases.json');

const DRY_RUN = process.argv.includes('--dry-run');
const INPUT_ARG = process.argv.find((arg, i) => i > 0 && process.argv[i - 1] === '--input');

// 常见社区别名 / 戏称 / 英文昵称（持续维护）
const CURATED_ALIASES = {
	蔻蔻: ['K.K.', 'KK', 'koukou'],
	艾米潘: ['EMP'],
	零: ['000'],
	露薇娅·蕾: ['露薇娅'],
	赫卡蒂: ['Hecate'],
	海拉: ['Hella'],
	夜莺: ['Nightingale'],
	白逸: ['Bai Yi'],
	卓娅: ['Zoya'],
	兰利: ['Langley'],
	哈梅尔: ['Hamel'],
	迪蒙: ['Demolition'],
	伊琳娜: ['Eirene'],
	观星者: ['Stargazer'],
	娜恰: ['Nacha'],
	恩菲尔: ['Enfer'],
	爱缇: ['Ariel'],
	渡鸦: ['Raven'],
	雷温: ['Luvia Ray'],
	可可莉克: ['Coco'],
	瑟琳: ['Serpent'],
	曜: ['Yao'],
	杜若: ['Duru'],
	安吉尔: ['Angell'],
	毕安卡: ['Bianca'],
	肖恩: ['Shawn'],
	戈蓝: ['Golan'],
	珀尔夫人: ['Lady Pearl'],
	萦萦: ['Yingying'],
	玉骨: ['Yugu'],
	无患子: ['Wuhuanzi'],
	局长: ['Chief', '玩家'],
};

function loadExternalAliases() {
	const inputFile = INPUT_ARG || ALIASES_FILE;
	if (!existsSync(inputFile)) return {};
	try {
		return JSON.parse(readFileSync(inputFile, 'utf8'));
	} catch (err) {
		console.warn(`读取外部别名文件失败 ${inputFile}: ${err.message}`);
		return {};
	}
}

function mergeAliases(maps) {
	const merged = {};
	for (const map of maps) {
		for (const [name, aliases] of Object.entries(map)) {
			if (!merged[name]) merged[name] = new Set();
			for (const alias of aliases) {
				if (alias && alias.trim() && alias.trim() !== name) {
					merged[name].add(alias.trim());
				}
			}
		}
	}
	return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, [...v]]));
}

function escapeYamlString(value) {
	return String(value).replace(/'/g, "''");
}

function updateAliases(content, aliases) {
	if (aliases.length === 0) return { content, changed: false };

	// 检查是否已有 aliases 字段
	const aliasesMatch = content.match(/^(aliases:\s*)\[([^\]]*)\]/m);
	if (aliasesMatch) {
		const existingStr = aliasesMatch[2];
		const existing = existingStr
			.split(/,\s*/)
			.map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
			.filter(Boolean);
		const combined = [...new Set([...existing, ...aliases])];
		if (combined.length === existing.length) return { content, changed: false };
		const newAliasesLine = `aliases: [${combined.map((a) => `'${escapeYamlString(a)}'`).join(', ')}]`;
		const newContent = content.replace(/^aliases:\s*\[[^\]]*\]/m, newAliasesLine);
		return { content: newContent, changed: true };
	}

	// 没有则插入到 description 行之后
	const descMatch = content.match(/^(description:\s*.+)$/m);
	if (descMatch) {
		const aliasesLine = `aliases: [${aliases.map((a) => `'${escapeYamlString(a)}'`).join(', ')}]`;
		const newContent = content.replace(descMatch[0], `${descMatch[0]}\n${aliasesLine}`);
		return { content: newContent, changed: true };
	}

	return { content, changed: false };
}

function main() {
	const external = loadExternalAliases();
	const aliases = mergeAliases([CURATED_ALIASES, external]);

	const files = readdirSync(CHAR_DIR).filter((f) => f.endsWith('.md'));
	let enriched = 0;
	let skipped = 0;

	for (const file of files) {
		const filePath = join(CHAR_DIR, file);
		const content = readFileSync(filePath, 'utf8');
		const nameMatch = content.match(/^name:\s*(.+)$/m);
		const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
		if (!name) continue;

		const newAliases = aliases[name] || [];
		const { content: newContent, changed } = updateAliases(content, newAliases);

		if (!changed) {
			skipped++;
			continue;
		}

		if (DRY_RUN) {
			console.log(`[dry-run] ${file}: ${newAliases.join(', ')}`);
		} else {
			writeFileSync(filePath, newContent, 'utf8');
			console.log(`✓ ${file}: ${newAliases.join(', ')}`);
		}
		enriched++;
	}

	console.log(`\n完成。${DRY_RUN ? '模拟' : '实际'} 更新 ${enriched} 个角色，跳过 ${skipped} 个。`);
}

main();
