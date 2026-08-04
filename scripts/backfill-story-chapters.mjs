// 回填 stories 元数据：主线篇章（铁血/锈火/悬城/覆海篇）与活动所属活动名
// 数据来源：BWiki「主线剧情」「活动剧情」索引页与活动剧情导航模板
// 只改写本地 frontmatter 的 type/chapter，不重新抓取剧情正文
// 用法：node scripts/backfill-story-chapters.mjs [--dry-run]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inferType, inferChapter } from './fetch-bwiki-stories.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'stories');
const DRY_RUN = process.argv.includes('--dry-run');

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
	Referer: 'https://wiki.biligame.com/wqmt/',
};

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchPage(page, attempt = 1) {
	const url = `https://wiki.biligame.com/wqmt/api.php?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvslots=main&rvprop=content&format=json`;
	const res = await fetch(url, { headers });
	const text = await res.text();
	if (!text.trimStart().startsWith('{')) {
		if (attempt <= 3) {
			await sleep(3000 * attempt);
			return fetchPage(page, attempt + 1);
		}
		throw new Error('返回非 JSON，可能触发反爬');
	}
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
		if (pageName.endsWith('剧情')) links.push(pageName);
	}
	return links;
}

async function main() {
	// 1. 构建 活动页 -> 活动名 映射（来自活动剧情导航模板）
	console.log('读取活动剧情索引...');
	const indexContent = await fetchPage('活动剧情');
	// 索引未收录但已知存在的导航模板（新活动索引更新滞后时补充）
	const EXTRA_NAVS = ['溺夜誓约剧情导航'];
	const navNames = [...new Set([
		...[...indexContent.matchAll(/\{\{:([^}]+剧情导航)\}\}/g)].map((m) => m[1].trim()),
		...EXTRA_NAVS,
	])];
	console.log(`  发现 ${navNames.length} 个剧情导航模板`);

	const eventOf = new Map();
	for (const nav of navNames) {
		const eventName = nav.replace(/剧情导航$/, '');
		try {
			const navContent = await fetchPage(nav);
			for (const page of extractStoryLinks(navContent)) {
				if (!eventOf.has(page)) eventOf.set(page, eventName);
			}
		} catch (err) {
			console.warn(`  ${nav} 读取失败: ${err.message}`);
		}
		await sleep(800);
	}
	console.log(`  映射 ${eventOf.size} 个活动剧情页`);

	// 2. 本地回填
	const files = readdirSync(OUT_DIR).filter((f) => f.endsWith('.md'));
	let updated = 0;
	let unchanged = 0;

	for (const file of files) {
		const slug = file.replace(/\.md$/, '');
		const type = inferType(slug);
		let chapter = inferChapter(slug);

		if (!chapter) {
			// 活动：从导航映射中查（slug 为小写页面名，空格已转为连字符，统一规范化比较）
			for (const [key, eventName] of eventOf) {
				if (key.toLowerCase().replace(/\s+/g, '-') === slug) {
					chapter = eventName;
					break;
				}
			}
		}

		const path = join(OUT_DIR, file);
		const content = readFileSync(path, 'utf8');
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) continue;
		let fm = fmMatch[1];

		const oldType = fm.match(/^type:\s*(.+)$/m)?.[1]?.trim() || '';
		const oldChapter = fm.match(/^chapter:\s*(.+)$/m)?.[1]?.trim() || '';

		let newFm = fm;
		if (type && type !== oldType) {
			newFm = newFm.replace(/^type:.*$/m, `type: ${type}`);
		}
		if (chapter && chapter !== oldChapter) {
			if (/^chapter:.*$/m.test(newFm)) {
				newFm = newFm.replace(/^chapter:.*$/m, `chapter: ${chapter.replace(/'/g, "''")}`);
			} else {
				newFm = newFm.replace(/^type:.*$/m, (line) => `${line}\nchapter: ${chapter.replace(/'/g, "''")}`);
			}
		}

		if (newFm !== fm) {
			if (!DRY_RUN) writeFileSync(path, content.replace(fmMatch[0], `---\n${newFm}\n---`), 'utf8');
			console.log(`✓ ${slug}: type=${type}${chapter ? `, chapter=${chapter}` : ''}`);
			updated++;
		} else {
			unchanged++;
		}
	}

	console.log(`\n完成。更新 ${updated}，未变化 ${unchanged}${DRY_RUN ? '（dry-run）' : ''}。`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
