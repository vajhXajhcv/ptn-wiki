// 参考无期迷途 BWiki 的关卡信息，生成/补全 Markdown 关卡页面
// 仅提取公开数据（关卡名称、描述、推荐等级、怪物等），攻略正文保留通用模板

import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'stages');

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

function cleanHtmlComments(text) {
	return text.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function cleanWikiMarkup(text) {
	return text
		.replace(/\[\[[^\]|]+\|?([^\]]*)\]\]/g, '$1')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/\{\{[^}]+\}\}/g, '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(text) {
	if (!text) return '';
	return cleanWikiMarkup(cleanHtmlComments(text));
}

function parseTemplate(text) {
	const match = text.match(/\{\{关卡图鉴[\s\S]*?\}\}/);
	if (!match) return null;
	const raw = match[0];
	const params = {};
	const regex = /\|([^=\s]+)=([^\n|]*)/g;
	let m;
	while ((m = regex.exec(raw)) !== null) {
		params[m[1]] = m[2];
	}
	return params;
}

function inferDifficulty(type) {
	if (type?.includes('困难')) return '困难';
	if (type?.includes('绝境')) return '绝境';
	return '普通';
}

function inferChapter(id, type) {
	const chapterMatch = id.match(/^(\d+)-/);
	if (!chapterMatch) return type || '其他';
	return `第${chapterMatch[1]}章`;
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
			const elite = rawName.includes('·精英');
			const name = rawName.replace(/·精英/g, '').trim();
			enemies.push({ name, count, elite });
		} else {
			enemies.push({ name: part, elite: false });
		}
	}
	return enemies;
}

function escapeYaml(text) {
	return String(text).replace(/'/g, "''");
}

function buildFrontmatter(params) {
	const id = params['关卡编号'] || '';
	const name = cleanText(params['关卡名称']) || id;
	const description = cleanText(params['关卡描述']) || `${name}关卡。`;
	const type = cleanText(params['关卡类型']) || '主线';
	const difficulty = inferDifficulty(type);
	const chapter = inferChapter(id, type);
	const level = parseInt(params['推荐等级'], 10) || undefined;
	const cost = parseInt(params['消耗体力'], 10) || undefined;
	const sanity = parseInt(params['神智值'], 10) || undefined;
	const moves = parseInt(params['移动次数'], 10) || undefined;
	const minions = parseInt(params['小怪数量'], 10) || undefined;
	const elites = parseInt(params['精英数量'], 10) || undefined;
	const sTask = cleanText(params['S级任务']);
	const firstReward = cleanText(params['首通奖励']);
	const sReward = cleanText(params['S级奖励']);
	const stageReward = cleanText(params['关卡奖励']);
	const monsters = cleanText(params['怪物信息']);
	const enemies = parseEnemyList(monsters);

	const tags = ['主线'];
	if (difficulty !== '普通') tags.push(difficulty);

	let fm = `---\nname: ${escapeYaml(name)}\nchapter: ${chapter}\nstageNumber: '${id}'\n`;
	if (level) fm += `recommendedLevel: ${level}\n`;
	fm += `difficulty: ${difficulty}\ndescription: ${escapeYaml(description)}\n`;
	if (cost) fm += `cost: ${cost}\n`;
	if (sanity) fm += `sanity: ${sanity}\n`;
	if (moves) fm += `moves: ${moves}\n`;
	if (minions !== undefined || elites !== undefined) {
		fm += `enemySummary: { `;
		const parts = [];
		if (minions !== undefined) parts.push(`minions: ${minions}`);
		if (elites !== undefined) parts.push(`elites: ${elites}`);
		fm += parts.join(', ') + ' }\n';
	}
	if (enemies.length > 0) {
		fm += 'enemies:\n';
		for (const e of enemies) {
			fm += `  - { name: '${escapeYaml(e.name)}', count: ${e.count}, elite: ${e.elite} }\n`;
		}
	}
	if (sTask) {
		const objectives = sTask.split(/；|;|\n/).map((s) => s.trim()).filter(Boolean);
		fm += `objectives: [${objectives.map((o) => `'${escapeYaml(o)}'`).join(', ')}]\n`;
	}
	if (firstReward) fm += `firstClearReward: '${escapeYaml(firstReward)}'\n`;
	if (sReward) fm += `sRankReward: '${escapeYaml(sReward)}'\n`;
	if (stageReward) fm += `stageReward: '${escapeYaml(stageReward)}'\n`;
	fm += `tags: [${tags.map((t) => `'${t}'`).join(', ')}]\n`;
	fm += '---\n';
	return fm;
}

function buildBody(params) {
	const id = params['关卡编号'] || '';
	const name = cleanText(params['关卡名称']) || id;
	const cost = params['消耗体力'];
	const mobs = params['小怪数量'];
	const elites = params['精英数量'];
	const sanity = params['神智值'];
	const moves = params['移动次数'];
	const sTask = cleanText(params['S级任务']);
	const firstReward = cleanText(params['首通奖励']);
	const sReward = cleanText(params['S级奖励']);
	const stageReward = cleanText(params['关卡奖励']);
	const monsters = cleanText(params['怪物信息']);

	let body = `## 关卡信息\n\n`;
	if (cost) body += `- **消耗体力**：${cost}\n`;
	if (mobs) body += `- **小怪数量**：${mobs}\n`;
	if (elites) body += `- **精英数量**：${elites}\n`;
	if (sanity) body += `- **神智值**：${sanity}\n`;
	if (moves) body += `- **移动次数**：${moves}\n`;
	if (sTask) body += `- **S级任务**：${sTask}\n`;
	if (firstReward) body += `- **首通奖励**：${firstReward}\n`;
	if (sReward) body += `- **S级奖励**：${sReward}\n`;
	if (stageReward) body += `- **关卡奖励**：${stageReward}\n`;
	if (monsters) body += `- **怪物信息**：${monsters}\n`;

	body += `\n## 通关思路\n\n> 该关卡攻略待补充，欢迎参考 BWiki 或社区攻略进行完善。\n\n1. 根据敌人配置选择物理或法术输出核心。\n2. 坚韧职业前排承伤，启迪职业保证续航。\n3. 合理利用地形与权能，优先击破精英敌人核心。\n\n## 三星要点\n\n- 无角色阵亡\n- 完成 S 级任务目标\n- 在推荐等级附近通关会更轻松\n`;
	return body;
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

async function fetchStageList(limit = 500) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:关卡')}&cmlimit=${limit}&format=json`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
	});
	const json = await res.json();
	return json.query.categorymembers
		.map((m) => m.title)
		.filter((t) => /^\d+-\d+$/.test(t));
}

async function main() {
	console.log('1. 从 BWiki 获取关卡列表...');
	const ids = await fetchStageList();
	console.log(`   共 ${ids.length} 个关卡`);

	const existing = new Set(
		readdirSync(OUT_DIR)
			.filter((f) => f.endsWith('.md'))
			.map((f) => f.replace(/\.md$/, ''))
	);

	let created = 0;
	let skipped = 0;
	let failed = 0;

	for (const id of ids) {
		const outPath = join(OUT_DIR, `${id}.md`);
		if (existing.has(id)) {
			console.log(`skip ${id}（已存在）`);
			skipped++;
			continue;
		}
		try {
			const text = await fetchRaw(id);
			const json = JSON.parse(text);
			const page = Object.values(json.query.pages)[0];
			const content = page.revisions?.[0]?.slots?.main?.['*'] || '';
			const params = parseTemplate(content);
			if (!params || !params['关卡编号']) {
				console.warn(`未找到关卡模板: ${id}`);
				failed++;
				continue;
			}
			const md = buildFrontmatter(params) + '\n' + buildBody(params);
			writeFileSync(outPath, md, 'utf8');
			created++;
			console.log(`✓ ${id} ${params['关卡名称'] || ''}`);
		} catch (err) {
			console.error(`✗ ${id}: ${err.message}`);
			failed++;
		}
		await sleep(800);
	}

	console.log(`\n完成。新建 ${created} 个，跳过 ${skipped} 个，失败 ${failed} 个。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
