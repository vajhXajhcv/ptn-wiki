// 参考无期迷途 BWiki 的剧情文本，生成 src/content/stories/ 下的 Markdown 页面
// 仅提取公开存档的剧情文本，并在页面显著位置标注 BWiki 来源。

import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'stories');

mkdirSync(OUT_DIR, { recursive: true });

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
	Accept: 'application/json, text/javascript, */*; q=0.01',
	'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
	Referer: 'https://wiki.biligame.com/wqmt/',
	'X-Requested-With': 'XMLHttpRequest',
};

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchRaw(page, attempt = 1) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvslots=main&rvprop=content&format=json`;
	const res = await fetch(url, { headers });
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

async function fetchPage(page) {
	const text = await fetchRaw(page);
	const json = JSON.parse(text);
	const p = Object.values(json.query.pages)[0];
	return p.revisions?.[0]?.slots?.main?.['*'] || '';
}

function extractStoryLinks(content) {
	const links = [];
	const regex = /\{\{板块\|按钮\|([^|]+)\|([^}]+)\}\}/g;
	let m;
	while ((m = regex.exec(content)) !== null) {
		const pageName = m[1].trim();
		const displayName = m[2].trim();
		if (pageName.endsWith('剧情')) {
			links.push({ page: pageName, title: displayName });
		}
	}
	return links;
}

function slugify(pageName) {
	return pageName
		.replace(/[\/\\?%*:|"<>]/g, '-')
		.replace(/\s+/g, '-')
		.toLowerCase();
}

export function cleanWikiMarkup(text) {
	if (!text) return '';
	return text
		.replace(/\{\{颜色\|([^|]+)\|([^}]+)\}\}/g, '$2')
		.replace(/\{\{[^}]+\}\}/g, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<s>([^<]*)<\/s>/g, '~~$1~~')
		.replace(/<[^>]+>/g, '')
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/''{3}([^']+)''{3}/g, '**$1**')
		.replace(/''{2}([^']+)''{2}/g, '*$1*')
		.replace(/^\s*\n/gm, '\n')
		.trim();
}

function findOuterTemplate(text, templateName) {
	const start = text.indexOf(`{{${templateName}|`);
	if (start === -1) return null;
	let depth = 0;
	let i = start;
	while (i < text.length) {
		if (text.slice(i, i + 2) === '{{') {
			depth++;
			i += 2;
		} else if (text.slice(i, i + 2) === '}}') {
			depth--;
			i += 2;
			if (depth === 0) {
				return text.slice(start, i);
			}
		} else {
			i++;
		}
	}
	return text.slice(start);
}

// 按分隔符拆分，但忽略嵌套在 {{...}} 中的分隔符
function splitTopLevel(text, separator) {
	const parts = [];
	let depth = 0;
	let current = '';
	for (let i = 0; i < text.length; i++) {
		if (text.slice(i, i + 2) === '{{') {
			depth++;
			current += text[i];
		} else if (text.slice(i, i + 2) === '}}') {
			depth--;
			current += text[i];
		} else if (text[i] === separator && depth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += text[i];
		}
	}
	parts.push(current);
	return parts.map((s) => s.trim()).filter(Boolean);
}

export function parseStory(content, pageName, displayTitle) {
	const dialogues = [];
	const characters = new Set();
	let title = displayTitle;
	let remaining = content;

	// 提取第一个大标题
	const titleMatch = content.match(/'{3,}([^'\n]+)'{3,}/);
	if (titleMatch) {
		title = cleanWikiMarkup(titleMatch[1]).trim() || displayTitle;
	}

	while (remaining.length > 0) {
		const storyTpl = findOuterTemplate(remaining, '剧情');
		if (!storyTpl) break;

		// 找到这个模板之后的位置，继续解析
		const tplEnd = remaining.indexOf(storyTpl) + storyTpl.length;
		remaining = remaining.slice(tplEnd);

		// 解析模板内部（去掉外层 {{剧情| 和 }}）
		const inner = storyTpl.slice('{{剧情|'.length, -2);
		const firstPipe = inner.indexOf('|');
		if (firstPipe === -1) continue;

		const speaker = inner.slice(0, firstPipe).trim();
		let text = inner.slice(firstPipe + 1);

		// 处理 {{剧情|选项 |选项1|回复1|选项2|回复2...}}
		// 回复可能是嵌套的 {{剧情|角色|文本}}，需要按顶层 | 拆分
		if (speaker === '选项' || speaker === '单选项') {
			const parts = splitTopLevel(text, '|').map((s) => s.trim()).filter(Boolean);
			if (speaker === '单选项' && parts.length === 1) {
				dialogues.push({ speaker: '选项', text: `**${cleanWikiMarkup(parts[0])}**` });
			} else {
				for (let i = 0; i < parts.length; i += 2) {
					const choice = cleanWikiMarkup(parts[i]);
					const replyRaw = parts[i + 1] || '';
					let reply = '';
					if (replyRaw.trim().startsWith('{{剧情|')) {
						// 回复是嵌套剧情，解析为对话
						const replyStory = parseStory(replyRaw, pageName, displayTitle);
						reply = replyStory.dialogues.map((d) => `**${d.speaker}**：${d.text}`).join('\n\n');
						replyStory.characters.forEach((c) => characters.add(c));
					} else {
						reply = cleanWikiMarkup(replyRaw);
					}
					dialogues.push({ speaker: '选项', text: `**${choice}**` + (reply ? `\n\n${reply}` : '') });
				}
			}
			continue;
		}

		text = cleanWikiMarkup(text);
		if (speaker && text) {
			dialogues.push({ speaker, text });
			if (speaker !== '旁白' && speaker !== '选项') {
				characters.add(speaker);
			}
		}
	}

	return {
		title,
		characters: Array.from(characters),
		dialogues,
	};
}

function inferType(pageName) {
	if (/^\d+-\d+剧情$/.test(pageName) || /^序章\d+剧情$/.test(pageName) || /^Re\d+/.test(pageName) || /^Sd-/.test(pageName) || /^Mz-/.test(pageName)) {
		return '主线';
	}
	return '活动';
}

function inferChapter(pageName) {
	const mainMatch = pageName.match(/^(\d+|序章)\d*剧情$/);
	if (mainMatch) {
		const prefix = mainMatch[1];
		if (prefix === '序章') return '序章·混沌彼岸';
		const num = parseInt(prefix, 10);
		if (num <= 2) return '狄斯西区·混沌彼岸';
		if (num <= 4) return '狄斯西区·无主地窟';
		if (num <= 6) return '狄斯城·奇兰广场';
		if (num <= 8) return '狄斯城·嘉年华';
		if (num <= 10) return '锈河·流民寨';
		if (num <= 12) return '内海·BR-004';
		if (num <= 14) return '上庭·地底';
		return `第${num}章`;
	}
	return '';
}

function buildFrontmatter(pageName, title, type, chapter, characters) {
	const source = `https://wiki.biligame.com/wqmt/${encodeURIComponent(pageName)}`;
	let fm = `---\ntitle: ${title.replace(/'/g, "''")}\n`;
	fm += `type: ${type}\n`;
	if (chapter) fm += `chapter: ${chapter.replace(/'/g, "''")}\n`;
	if (characters.length > 0) fm += `characters: [${characters.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')}]\n`;
	fm += `description: ${title.replace(/'/g, "''")}剧情文本。\n`;
	fm += `source: '${source}'\n`;
	fm += `tags: ['${type}', '剧情']\n`;
	fm += '---\n';
	return fm;
}

function buildBody(dialogues) {
	if (dialogues.length === 0) return '> 该剧情文本待补充。\n';
	let body = '';
	for (const { speaker, text } of dialogues) {
		if (speaker === '旁白') {
			body += `*${text}*\n\n`;
		} else if (speaker === '选项') {
			body += `> **选项**：${text}\n\n`;
		} else {
			body += `**${speaker}**：${text}\n\n`;
		}
	}
	return body.trim();
}

async function fetchIndexLinks(indexPage) {
	console.log(`读取索引页：${indexPage}`);
	const content = await fetchPage(indexPage);
	let links = extractStoryLinks(content);
	console.log(`  直接找到 ${links.length} 个剧情页面`);

	// 活动剧情页通常嵌入导航模板 {{:活动名剧情导航}}
	const navRegex = /\{\{:([^}]+剧情导航)\}\}/g;
	const navMatches = [...content.matchAll(navRegex)].map((m) => m[1].trim());
	if (navMatches.length > 0) {
		console.log(`  发现 ${navMatches.length} 个剧情导航模板`);
		for (const nav of navMatches) {
			try {
				const navContent = await fetchPage(nav);
				const navLinks = extractStoryLinks(navContent);
				console.log(`    ${nav}: ${navLinks.length} 个`);
				links.push(...navLinks);
				await sleep(500);
			} catch (err) {
				console.warn(`    ${nav} 读取失败: ${err.message}`);
			}
		}
	}

	// 去重
	const seen = new Set();
	links = links.filter((l) => {
		if (seen.has(l.page)) return false;
		seen.add(l.page);
		return true;
	});

	console.log(`  共 ${links.length} 个剧情页面`);
	return links;
}

async function main() {
	const force = process.argv.includes('--force');
	const existing = new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')));

	const allLinks = [];
	for (const indexPage of ['主线剧情', '活动剧情']) {
		const links = await fetchIndexLinks(indexPage);
		allLinks.push(...links);
		await sleep(1500);
	}

	let created = 0;
	let updated = 0;
	let skipped = 0;
	let failed = 0;

	for (const { page, title } of allLinks) {
		const slug = slugify(page);
		const outPath = join(OUT_DIR, `${slug}.md`);
		const exists = existing.has(slug);
		if (exists && !force) {
			console.log(`skip ${page}（已存在）`);
			skipped++;
			continue;
		}

		try {
			const content = await fetchPage(page);
			const story = parseStory(content, page, title);
			if (story.dialogues.length === 0) {
				console.log(`○ ${page} -> ${slug}（无剧情文本，跳过）`);
				if (exists && force) {
					// 强制模式下删除已存在的空文件
					unlinkSync(outPath);
					console.log(`  删除空文件 ${outPath}`);
				}
				continue;
			}
			const type = inferType(page);
			const chapter = inferChapter(page);
			const fm = buildFrontmatter(page, story.title || title, type, chapter, story.characters);
			const body = buildBody(story.dialogues);
			writeFileSync(outPath, `${fm}\n${body}\n`, 'utf8');
			if (exists) {
				updated++;
				console.log(`↻ ${page} -> ${slug}（${story.dialogues.length} 句对话）`);
			} else {
				created++;
				console.log(`✓ ${page} -> ${slug}（${story.dialogues.length} 句对话）`);
			}
		} catch (err) {
			console.error(`✗ ${page}: ${err.message}`);
			failed++;
		}
		await sleep(800);
	}

	console.log(`\n完成。新建 ${created} 个，更新 ${updated} 个，跳过 ${skipped} 个，失败 ${failed} 个。`);
}

const isMain = import.meta.url.startsWith('file:') && process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
