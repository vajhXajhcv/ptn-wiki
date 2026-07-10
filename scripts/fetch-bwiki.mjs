// 参考无期迷途 BWiki 的角色信息，生成/补全 Markdown 角色页面
// 仅提取元数据（称号、职业、稀有度、TAG 等），正文内容会重新组织，不直接复制 BWiki

import { writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pinyin } from 'pinyin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'characters');

const RARITY_MAP = { 狂: 'S', 危: 'A', 普: 'B' };
const DANGER_SET = new Set(['坚韧', '狂暴', '诡秘', '精准', '异能', '启迪']);

// 特殊 slug 覆盖表：已有的别名、数字名、多音字等
const SLUG_MAP = {
	'000': 'ling',
	安: 'an',
	'K.K.': 'kk',
	'露薇娅·蕾': 'luweiyalei',
	EMP: 'emp',
};

const usedSlugs = new Set();
const existingNames = new Set();

function slugify(name) {
	if (SLUG_MAP[name]) return SLUG_MAP[name];
	// 先尝试纯拼音
	const py = pinyin(name, { style: pinyin.STYLE_NORMAL, heteronym: false })
		.map((arr) => arr[0])
		.join('')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
	let slug = py || name.toLowerCase().replace(/[^a-z0-9]/g, '');
	// 避免 slug 冲突
	let uniqueSlug = slug;
	let suffix = 2;
	while (usedSlugs.has(uniqueSlug)) {
		uniqueSlug = `${slug}${suffix}`;
		suffix++;
	}
	usedSlugs.add(uniqueSlug);
	return uniqueSlug;
}

function loadExistingSlugs() {
	for (const f of readdirSync(OUT_DIR)) {
		if (!f.endsWith('.md')) continue;
		const slug = f.replace(/\.md$/, '');
		usedSlugs.add(slug);
		const content = readFileSync(join(OUT_DIR, f), 'utf8');
		const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim();
		if (name) existingNames.add(name);
	}
}

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
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

	return `---\nname: ${name}\ntitle: ${title}\nrarity: ${rarity}\ndanger: ${danger}\nrole: ${tags[0] || ''}\nfaction: ''\ndescription: ${description}\ntags: [${tags.map((t) => `'${t}'`).join(', ')}]\nimage: /characters/${slugify(name)}.jpg\n---\n\n## 基础信息\n\n${name}是一名${rarity}级${danger}禁闭者，${dangerDesc}。${cleanFeature ? `其核心机制可以概括为：${cleanFeature}` : ''}\n\n## 技能要点\n\n- **必杀**：提供${danger === '启迪' ? '治疗或增益效果' : danger === '坚韧' ? '护盾或减伤效果' : '关键伤害或控制效果'}。\n- **被动**：增强自身${danger === '启迪' ? '治疗能力或提供额外辅助' : '输出或生存能力'}。\n- **特性**：${cleanFeature || dangerDesc}。\n\n## 使用建议\n\n1. 根据关卡需求安排站位，充分发挥${danger}职业的优势。\n2. 优先提升与核心机制相关的技能等级。\n3. 搭配合适的队友与烙印，能在主线与破碎防线中稳定发挥。\n\n## 烙印推荐\n\n- 通用向：亡者之河 + 重逢之日\n- 功能向：回廊空响 + 辛迪加·荣耀\n`;
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

async function fetchParams(name) {
	const page = `禁闭者:${name}`;
	const text = await fetchRaw(page);
	const json = JSON.parse(text);
	const pages = json.query.pages;
	const pageData = Object.values(pages)[0];
	const content = pageData.revisions?.[0]?.slots?.main?.['*'] || '';
	return extractTemplate(content);
}

async function fetchCharacterList(limit = 500) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:禁闭者')}&cmlimit=${limit}&format=json`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
	});
	const json = await res.json();
	return json.query.categorymembers
		.map((m) => m.title.replace(/^禁闭者:/, ''))
		.filter((n) => n && !n.startsWith('Template:'));
}

async function main() {
	loadExistingSlugs();

	console.log('1. 从 BWiki 获取角色列表...');
	const names = await fetchCharacterList();
	console.log(`   共 ${names.length} 名角色`);

	const existing = new Set(
		readdirSync(OUT_DIR)
			.filter((f) => f.endsWith('.md'))
			.map((f) => f.replace(/\.md$/, ''))
	);

	let created = 0;
	let skipped = 0;
	let failed = 0;

	for (const name of names) {
		if (existingNames.has(name)) {
			console.log(`skip ${name}（已存在）`);
			skipped++;
			continue;
		}

		const slug = slugify(name);
		const outPath = join(OUT_DIR, `${slug}.md`);
		if (existsSync(outPath)) {
			// 如果文件已存在但 name 不同（如 K.K. 和 蔻蔻 分别存在），跳过
			const content = readFileSync(outPath, 'utf8');
			const existingName = content.match(/^name:\s*(.+)$/m)?.[1]?.trim();
			if (existingName && existingName !== name) {
				console.log(`skip ${name}（slug ${slug} 已被 ${existingName} 占用）`);
				skipped++;
				continue;
			}
			console.log(`skip ${name}（已存在）`);
			skipped++;
			continue;
		}
		try {
			const params = await fetchParams(name);
			if (!params) {
				console.warn(`未找到模板: ${name}`);
				failed++;
				continue;
			}
			const rarity = RARITY_MAP[params['稀有度']] || 'B';
			const danger = DANGER_SET.has(params['职业']) ? params['职业'] : '狂暴';
			const title = cleanTitle(params['头衔']);
			const roleTag = params['角色TAG'] || params['伤害类型'] || '';
			const feature = params['特性'] || '';
			const md = buildContent(name, title, rarity, danger, roleTag, feature);
			writeFileSync(outPath, md, 'utf8');
			created++;
			console.log(`✓ ${name} (${rarity} ${danger}) -> ${slug}`);
		} catch (err) {
			console.error(`✗ ${name}: ${err.message}`);
			failed++;
		}
		await sleep(1500);
	}

	console.log(`\n完成。新建 ${created} 个，跳过 ${skipped} 个，失败 ${failed} 个。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
