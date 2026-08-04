// 从 BWiki 零镜系统抓取世界观设定，生成 src/content/lore/*.md
// 用法：node scripts/fetch-bwiki-lore.mjs [--force]
// 幂等：已存在且内容一致的条目跳过；--force 强制重写

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'lore');
const FORCE = process.argv.includes('--force');
const DELAY_MS = 2000;

const PAGES = ['零镜系统/入夜纪年', '零镜系统/狄斯城', '零镜系统/狂厄'];

mkdirSync(OUT_DIR, { recursive: true });

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

// 提取 {{零镜系统详情 ...}} 顶层模板块（按花括号配平）
function extractBlocks(text) {
	const blocks = [];
	const START = '{{零镜系统详情';
	let i = 0;
	while ((i = text.indexOf(START, i)) !== -1) {
		let depth = 0;
		let j = i;
		for (; j < text.length - 1; j++) {
			const two = text.slice(j, j + 2);
			if (two === '{{') depth++;
			else if (two === '}}') {
				depth--;
				if (depth === 0) {
					j += 2;
					break;
				}
			}
		}
		blocks.push(text.slice(i, j));
		i = j;
	}
	return blocks;
}

// 解析块内 |参数=值（值内部不含换行级参数边界，按 \n| 分割）
function parseParams(block) {
	const params = {};
	const body = block.replace(/^\{\{零镜系统详情/, '').replace(/\}\}$/, '');
	const parts = body.split(/\n\|/);
	for (const part of parts) {
		const m = part.match(/^\|?([^=\s]+)=([\s\S]*)$/);
		if (m) params[m[1]] = m[2].trim();
	}
	return params;
}

// 清洗条目内容为「标题 + 正文」段落序列

function toParagraphs(raw) {
	const segments = raw.split(/\{\{零镜条目标题\|([^}]+)\}\}/);
	const paragraphs = [];
	for (let i = 1; i < segments.length; i += 2) {
		const heading = segments[i].trim();
		const body = (segments[i + 1] || '')
			.replace(/\{\{零镜跳转\|([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
			.replace(/\{\{[^{}]*\}\}/g, '')
			.replace(/<[^>]+>/g, '')
			.replace(/<!--[\s\S]*?-->/g, '')
			.trim();
		if (heading && body) paragraphs.push({ heading, body });
	}
	return paragraphs;
}

// 取页面 ===xxx=== 小节顺序，用于补充 section 归属
function sectionOf(text, blockStart) {
	const before = text.slice(0, blockStart);
	const matches = [...before.matchAll(/^===([^=]+)===/gm)];
	return matches.length ? matches[matches.length - 1][1].trim() : '';
}

function slugify(code, title) {
	const base = (code || title)
		.toLowerCase()
		.replace(/[^a-z0-9一-鿿]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'entry';
}

async function main() {
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const page of PAGES) {
		console.log(`抓取 ${page} ...`);
		const text = await fetchRaw(page);
		const json = JSON.parse(text);
		const pageData = Object.values(json.query.pages)[0];
		const wikitext = pageData.revisions?.[0]?.slots?.main?.['*'] || '';

		const blocks = extractBlocks(wikitext);
		console.log(`  解析到 ${blocks.length} 个条目`);

		for (const block of blocks) {
			const params = parseParams(block);
			const title = params['标题'];
			if (!title) continue;
			const chapter = params['章节'] || page.split('/')[1];
			const section = params['从属'] || sectionOf(wikitext, wikitext.indexOf(block));
			const code = params['编号'] || '';
			const paragraphs = toParagraphs(params['条目内容'] || '');
			if (paragraphs.length === 0) continue;

			const description = paragraphs[0].body.slice(0, 80).replace(/\n/g, '');
			const slug = slugify(code, title);
			const source = `https://wiki.biligame.com/wqmt/${encodeURIComponent(page)}`;

			const body = paragraphs.map((p) => `### ${p.heading}\n\n${p.body}`).join('\n\n');
			const md = `---\ntitle: ${title}\nchapter: ${chapter}\n${section ? `section: ${section}\n` : ''}${code ? `code: ${code}\n` : ''}description: ${description}\nsource: '${source}'\ntags: ['零镜系统', '${chapter}']\n---\n\n${body}\n`;

			const outPath = join(OUT_DIR, `${slug}.md`);
			if (existsSync(outPath) && !FORCE) {
				const existing = readFileSync(outPath, 'utf8');
				if (existing === md) {
					skipped++;
					continue;
				}
				writeFileSync(outPath, md, 'utf8');
				console.log(`  ↻ ${title} (${code})`);
				updated++;
				continue;
			}
			writeFileSync(outPath, md, 'utf8');
			console.log(`  ✓ ${title} (${code})`);
			created++;
		}
		await sleep(DELAY_MS);
	}

	// 清理已不存在于 BWiki 的条目（仅 --force 时）
	if (FORCE) {
		console.log('--force 模式：请手动核对过期条目');
	}

	console.log(`\n完成。新建 ${created}，更新 ${updated}，跳过 ${skipped}。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
