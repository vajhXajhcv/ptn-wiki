// 参考无期迷途 BWiki 的角色信息，生成原创 Markdown 角色页面
// 仅提取元数据（称号、职业、稀有度、TAG 等），正文内容会重新组织，不直接复制 BWiki

import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'characters');

const RARITY_MAP = { 狂: 'S', 危: 'A', 普: 'B' };
const DANGER_SET = new Set(['坚韧', '狂暴', '诡秘', '精准', '异能', '启迪']);

const SLUG_MAP = {
	夏音: 'xiayin',
	观星者: 'guanxingzhe',
	黛伦: 'dailun',
	娜恰: 'naqia',
	嗷呜: 'aowu',
	罗睺: 'luohou',
	温蒂: 'wendi',
	九十九: 'jiushijiu',
	帕加茜: 'pajiaqian',
	赫罗: 'heluo',
	露莉艾卡: 'luliaika',
	普希拉: 'puxila',
	狼獾: 'langhuan',
	伊格尼: 'yigeni',
	'露薇娅·蕾': 'luweiyalei',
	维多利亚: 'weiduoliya',
	安: 'an',
	卡米利安: 'kamilian',
	福克斯先生: 'fox',
	雷比尼斯: 'leibinisi',
	堇: 'jin',
	泰特拉: 'taitela',
	艾恩: 'aien',
	昙: 'tan',
	芙洛拉: 'fuluola',
	'K.K.': 'kk',
	德莫莉: 'demoli',
	佩姬: 'peiji',
	蔻蔻: 'koukou',
	辰砂: 'chensha',
	卡瓦卡瓦: 'kawakawa',
	切尔西伯爵: 'chelsea',
	瑟琳: 'seren',
	可可莉克: 'kokolic',
	阿黛拉: 'adela',
	橡木匣: 'oakcasket',
	渡鸦: 'raven',
};

const TARGETS = Object.keys(SLUG_MAP);

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

function slugify(name) {
	return SLUG_MAP[name] || name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractTemplate(text) {
	const match = text.match(/\{\{禁闭者图鉴[\s\S]*?\}\}/);
	if (!match) return null;
	const raw = match[0];
	const params = {};
	const regex = /\|([^=\s]+)=([^\n|]*)/g;
	let m;
	while ((m = regex.exec(raw)) !== null) {
		params[m[1]] = m[2].trim();
	}
	return params;
}

function cleanTitle(title) {
	if (!title) return '';
	return title.replace(/<br\s*\/?>/gi, ' / ').replace(/\{\{.*?\}\}/g, '').trim();
}

function cleanTags(tagText) {
	if (!tagText) return [];
	return tagText
		.replace(/<!--[\s\S]*?-->/g, '')
		.split(/[,，、]/)
		.map((t) => t.trim())
		.filter(Boolean)
		.slice(0, 4);
}

function buildContent(name, title, rarity, danger, roleTag, feature) {
	const dangerDesc = {
		坚韧: '前排承伤，利用阻挡与护盾保护队友',
		狂暴: '近战物理输出，负责清理敌人与站桩输出',
		诡秘: '高机动刺客，擅长破核与切入后排',
		精准: '远程物理输出，依靠射程优势进行打击',
		异能: '法术伤害输出，通常兼具破核或控场能力',
		启迪: '治疗与增益辅助，为队伍提供续航与加成',
	}[danger] || '多功能定位';

	const tags = cleanTags(roleTag);
	const cleanFeature = (feature || '').replace(/\{\{.*?\}\}/g, '').replace(/<!--.*?-->/g, '').trim();
	const description = cleanFeature
		? `${name}是${rarity}级${danger}禁闭者，${cleanFeature}`
		: `${name}是${rarity}级${danger}禁闭者，${dangerDesc}。`;

	return `---\nname: ${name}\ntitle: ${title}\nrarity: ${rarity}\ndanger: ${danger}\nrole: ${tags[0] || ''}\nfaction: ''\ndescription: ${description}\ntags: [${tags.map((t) => `'${t}'`).join(', ')}]\nimage: /characters/${slugify(name)}.png\n---\n\n## 基础信息\n\n${name}是一名${rarity}级${danger}禁闭者，${dangerDesc}。${cleanFeature ? `其核心机制可以概括为：${cleanFeature}` : ''}\n\n## 技能要点\n\n- **必杀**：提供${danger === '启迪' ? '治疗或增益效果' : danger === '坚韧' ? '护盾或减伤效果' : '关键伤害或控制效果'}。\n- **被动**：增强自身${danger === '启迪' ? '治疗能力或提供额外辅助' : '输出或生存能力'}。\n- **特性**：${cleanFeature || dangerDesc}。\n\n## 使用建议\n\n1. 根据关卡需求安排站位，充分发挥${danger}职业的优势。\n2. 优先提升与核心机制相关的技能等级。\n3. 搭配合适的队友与烙印，能在主线与破碎防线中稳定发挥。\n\n## 烙印推荐\n\n- 通用向：亡者之河 + 重逢之日\n- 功能向：回廊空响 + 辛迪加·荣耀\n`;
}

async function fetchRaw(name, attempt = 1) {
	const page = `禁闭者:${name}`;
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvslots=main&rvprop=content&format=json`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
	});
	const text = await res.text();
	if (!text.trimStart().startsWith('{')) {
		if (attempt <= 3) {
			console.warn(`  ${name} 被限流，第 ${attempt} 次重试...`);
			await sleep(3000 * attempt);
			return fetchRaw(name, attempt + 1);
		}
		throw new Error('返回非 JSON，可能触发反爬');
	}
	return text;
}

async function fetchParams(name) {
	const text = await fetchRaw(name);
	const json = JSON.parse(text);
	const pages = json.query.pages;
	const pageData = Object.values(pages)[0];
	const content = pageData.revisions?.[0]?.slots?.main?.['*'] || '';
	return extractTemplate(content);
}

async function main() {
	for (const name of TARGETS) {
		const fileName = `${slugify(name)}.md`;
		const outPath = join(OUT_DIR, fileName);
		if (existsSync(outPath)) {
			console.log(`skip ${name}（已存在）`);
			continue;
		}
		try {
			const params = await fetchParams(name);
			if (!params) {
				console.warn(`未找到模板: ${name}`);
				continue;
			}
			const rarity = RARITY_MAP[params['稀有度']] || 'B';
			const danger = DANGER_SET.has(params['职业']) ? params['职业'] : '狂暴';
			const title = cleanTitle(params['头衔']);
			const roleTag = params['角色TAG'] || params['伤害类型'] || '';
			const feature = params['特性'] || '';
			const md = buildContent(name, title, rarity, danger, roleTag, feature);
			writeFileSync(outPath, md, 'utf8');
			console.log(`✓ ${name} (${rarity} ${danger})`);
		} catch (err) {
			console.error(`✗ ${name}: ${err.message}`);
		}
		await sleep(2500);
	}
}

main();
