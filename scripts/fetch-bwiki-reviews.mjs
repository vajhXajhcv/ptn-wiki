// 从 BWiki 抓取角色审查剧情，生成 src/content/stories/审查-{slug}.md
// 覆盖范围：BWiki 已公开的审查页（通过 intitle:审查 枚举），目前约 10 名角色
// 用法：node scripts/fetch-bwiki-reviews.mjs [--force]

import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cleanWikiMarkup, findOuterTemplate, splitTopLevel } from './fetch-bwiki-stories.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'stories');
const CHAR_DIR = join(__dirname, '..', 'src', 'content', 'characters');
const FORCE = process.argv.includes('--force');

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
	Referer: 'https://wiki.biligame.com/wqmt/',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 1) {
	const res = await fetch(url, { headers });
	const text = await res.text();
	if (!text.trimStart().startsWith('{')) {
		if (attempt <= 4) {
			console.warn(`  被限流，第 ${attempt} 次重试...`);
			await sleep(4000 * attempt);
			return fetchJson(url, attempt + 1);
		}
		throw new Error('返回非 JSON，可能触发反爬');
	}
	return JSON.parse(text);
}

async function fetchPage(title) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvslots=main&rvprop=content&format=json`;
	const j = await fetchJson(url);
	const p = Object.values(j.query.pages)[0];
	return p.revisions?.[0]?.slots?.main?.['*'] ?? '';
}

// 枚举全部「X 审查 / X 审查01」页面
async function listReviewPages() {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&list=search&srsearch=${encodeURIComponent('intitle:审查')}&srlimit=500&srnamespace=0&format=json`;
	const j = await fetchJson(url);
	return j.query.search
		.map((s) => s.title)
		.filter((t) => /^[^:：]+ 审查\d*$/.test(t));
}

// 角色名 -> 本地角色 slug
function loadCharacterSlugs() {
	const map = new Map();
	for (const f of readdirSync(CHAR_DIR).filter((x) => x.endsWith('.md'))) {
		const c = readFileSync(join(CHAR_DIR, f), 'utf8');
		const name = c.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
		if (name) map.set(name, f.replace(/\.md$/, ''));
	}
	return map;
}

// 不作为登场角色收录的模板关键字
const NON_CHARACTER_KEYS = new Set([
	'旁白', '选项', '审查单项', '提交物证', '情报', '审查证物', '主要登场角色',
	'审查成功', '审查失败', '审查结束', '获得证物', '审查对话',
]);

// 解析 {{审查|...}} 模板序列，支持 阶段 分节
function parseReview(content) {
	const dialogues = [];
	const characters = new Set();
	const evidence = new Set();
	let info = '';

	// 按标签页注释切分阶段：<!--默认第N个标签的内容-->
	const stageParts = content.split(/<!--默认第(\d+)个标签的内容-->/);
	// stageParts: [前置, '1', 阶段1内容, '2', 阶段2内容, ...]
	const segments = [];
	if (stageParts.length > 1) {
		if (stageParts[0].trim()) segments.push({ stage: '', text: stageParts[0] });
		for (let i = 1; i < stageParts.length; i += 2) {
			segments.push({ stage: stageParts[i], text: stageParts[i + 1] || '' });
		}
	} else {
		segments.push({ stage: '', text: content });
	}

	function parseSegment(text, stage) {
		let remaining = text;
		if (stage) {
			dialogues.push({ kind: 'heading', text: `阶段${stage}` });
		}
		while (remaining.length > 0) {
			const tpl = findOuterTemplate(remaining, '审查');
			if (!tpl) break;
			const tplEnd = remaining.indexOf(tpl) + tpl.length;
			remaining = remaining.slice(tplEnd);

			const inner = tpl.slice('{{审查|'.length, -2);
			const firstPipe = inner.indexOf('|');
			const speaker = (firstPipe === -1 ? inner : inner.slice(0, firstPipe)).trim();
			const body = firstPipe === -1 ? '' : inner.slice(firstPipe + 1);

			switch (speaker) {
				case '情报':
					info = cleanWikiMarkup(body);
					break;
				case '主要登场角色': {
					const m = body.match(/主要登场角色=(.+)/);
					if (m) m[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean).forEach((c) => characters.add(c));
					break;
				}
				case '审查证物': {
					const m = body.match(/审查证物=(.+)/);
					if (m) m[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean).forEach((e) => evidence.add(e));
					break;
				}
				case '旁白':
					dialogues.push({ kind: 'narration', text: cleanWikiMarkup(body) });
					break;
				case '审查单项':
					dialogues.push({ kind: 'dialogue', speaker: '局长', text: cleanWikiMarkup(body) });
					break;
				case '提交物证': {
					const m = body.match(/提交物证=(.+)/);
					if (m) dialogues.push({ kind: 'evidence', text: m[1].trim() });
					break;
				}
				case '获得证物': {
					const m = body.match(/获得证物=(.+)/);
					dialogues.push({ kind: 'evidence', text: `获得证物：${m ? m[1].trim() : cleanWikiMarkup(body)}` });
					break;
				}
				case '审查成功':
					dialogues.push({ kind: 'marker', text: `✅ ${cleanWikiMarkup(body) || '审查成功'}` });
					break;
				case '审查失败':
					dialogues.push({ kind: 'marker', text: `❌ ${cleanWikiMarkup(body) || '审查失败'}` });
					break;
				case '审查对话': {
					const parts = splitTopLevel(body, '|');
					if (parts.length >= 2) {
						dialogues.push({ kind: 'dialogue', speaker: parts[0], text: cleanWikiMarkup(parts.slice(1).join('|')) });
					}
					break;
				}
				case '选项': {
					const parts = splitTopLevel(body, '|').map((s) => s.trim()).filter(Boolean);
					for (let i = 0; i < parts.length; i += 2) {
						const choice = cleanWikiMarkup(parts[i]);
						const replyRaw = parts[i + 1] || '';
						const replies = [];
						let rest = replyRaw;
						while (rest.includes('{{审查|')) {
							const nested = findOuterTemplate(rest, '审查');
							if (!nested) break;
							const nInner = nested.slice('{{审查|'.length, -2);
							const nPipe = nInner.indexOf('|');
							const nSpeaker = (nPipe === -1 ? nInner : nInner.slice(0, nPipe)).trim();
							const nBody = nPipe === -1 ? '' : nInner.slice(nPipe + 1);
							if (nSpeaker === '旁白') {
								replies.push(`*${cleanWikiMarkup(nBody)}*`);
							} else if (nSpeaker === '审查对话') {
								const rp = splitTopLevel(nBody, '|');
								replies.push(`**${rp[0]}**：${cleanWikiMarkup(rp.slice(1).join('|'))}`);
							} else if (nSpeaker === '审查单项') {
								replies.push(`**局长**：${cleanWikiMarkup(nBody)}`);
							} else {
								replies.push(`**${nSpeaker}**：${cleanWikiMarkup(nBody)}`);
								if (!NON_CHARACTER_KEYS.has(nSpeaker)) characters.add(nSpeaker);
							}
							rest = rest.slice(rest.indexOf(nested) + nested.length);
						}
						dialogues.push({ kind: 'choice', text: choice, replies });
					}
					break;
				}
				default:
					if (speaker && body.trim()) {
						dialogues.push({ kind: 'dialogue', speaker, text: cleanWikiMarkup(body) });
						if (!NON_CHARACTER_KEYS.has(speaker)) characters.add(speaker);
					}
			}
		}
	}

	for (const seg of segments) parseSegment(seg.text, seg.stage);
	return { dialogues, characters: [...characters], evidence: [...evidence], info };
}

function buildBody({ dialogues }) {
	const lines = [];
	for (const d of dialogues) {
		if (d.kind === 'heading') lines.push(`## ${d.text}`);
		else if (d.kind === 'marker') lines.push(`> **${d.text}**`);
		else if (d.kind === 'narration') lines.push(`*${d.text}*`);
		else if (d.kind === 'evidence') lines.push(`> 📎 提交物证：**${d.text}**`);
		else if (d.kind === 'choice') {
			lines.push(`> **选项**：${d.text}`);
			for (const r of d.replies) lines.push(`>\n> ${r.replace(/\n/g, '\n> ')}`);
		} else {
			lines.push(`**${d.speaker}**：${d.text}`);
		}
	}
	return lines.join('\n\n');
}

async function main() {
	console.log('枚举 BWiki 审查剧情页...');
	const pages = await listReviewPages();
	console.log(`  发现 ${pages.length} 个审查页面`);

	const charSlugs = loadCharacterSlugs();
	let created = 0;
	let updated = 0;
	let skipped = 0;

	for (const page of pages) {
		const name = page.replace(/ 审查\d*$/, '');
		const charSlug = charSlugs.get(name) || name;
		const slug = `审查-${charSlug}`.replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').toLowerCase();
		const outPath = join(OUT_DIR, `${slug}.md`);

		if (existsSync(outPath) && !FORCE) {
			console.log(`skip ${page}（已存在）`);
			skipped++;
			continue;
		}

		try {
			const content = await fetchPage(page);
			const parsed = parseReview(content);
			if (parsed.dialogues.length === 0) {
				console.log(`○ ${page}（无正文，跳过）`);
				continue;
			}

			const stages = parsed.dialogues.filter((d) => d.kind === 'heading').length;
			const source = `https://wiki.biligame.com/wqmt/${encodeURIComponent(page)}`;
			const esc = (s) => s.replace(/'/g, "''");
			let fm = `---\ntitle: ${esc(name)}审查\n`;
			fm += `type: 角色审查\n`;
			fm += `chapter: ${esc(name)}\n`;
			if (parsed.characters.length > 0) {
				fm += `characters: [${parsed.characters.map((c) => `'${esc(c)}'`).join(', ')}]\n`;
			}
			fm += `description: ${esc(name)}的角色审查剧情文本${stages > 0 ? `（共 ${stages} 个阶段）` : ''}。\n`;
			fm += `source: '${source}'\n`;
			fm += `tags: ['角色审查', '剧情']\n---\n`;

			let body = '';
			if (parsed.info) body += `> 审查情报：${parsed.info}\n\n`;
			if (parsed.evidence.length > 0) body += `> 审查证物：${parsed.evidence.join('、')}\n\n`;
			body += buildBody(parsed);

			writeFileSync(outPath, `${fm}\n${body}\n`, 'utf8');
			console.log(`✓ ${page} -> ${slug}（${parsed.dialogues.length} 段）`);
			if (existsSync(outPath) && FORCE) updated++;
			else created++;
		} catch (err) {
			console.error(`✗ ${page}: ${err.message}`);
		}
		await sleep(1500);
	}

	console.log(`\n完成。新建 ${created}，更新 ${updated}，跳过 ${skipped}。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
