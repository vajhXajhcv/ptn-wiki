// 参考无期迷途 BWiki 的角色技能信息，更新角色 Markdown 的技能章节
// 仅提取公开的游戏数据（技能名称、效果、范围等），并以简洁格式重新组织
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const CHAR_DIR = join(process.cwd(), 'src', 'content', 'characters');
const API_BASE = 'https://wiki.biligame.com/wqmt/api.php';

const SLEEP_MS = 2500;
const RETRIES = 3;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchRaw(name, attempt = 1) {
  const page = `禁闭者:${name}`;
  const url = `${API_BASE}?action=query&prop=revisions&titles=${encodeURIComponent(page)}&rvslots=main&rvprop=content&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const text = await res.text();
  if (!text.trimStart().startsWith('{')) {
    if (attempt <= RETRIES) {
      console.warn(`  ${name} 返回非 JSON，第 ${attempt} 次重试...`);
      await sleep(SLEEP_MS * attempt);
      return fetchRaw(name, attempt + 1);
    }
    throw new Error('可能触发反爬');
  }
  return text;
}

async function fetchParams(name) {
  const text = await fetchRaw(name);
  const json = JSON.parse(text);
  const pages = json.query.pages;
  const pageData = Object.values(pages)[0];
  const content = pageData.revisions?.[0]?.slots?.main?.['*'] || '';
  return extractParams(content);
}

function findOuterTemplate(content, templateName) {
  const startIdx = content.indexOf(`{{${templateName}`);
  if (startIdx === -1) return null;
  let depth = 0;
  let i = startIdx;
  while (i < content.length - 1) {
    if (content.slice(i, i + 2) === '{{') {
      depth++;
      i += 2;
    } else if (content.slice(i, i + 2) === '}}') {
      depth--;
      i += 2;
      if (depth === 0) {
        return content.slice(startIdx, i);
      }
    } else {
      i++;
    }
  }
  return null;
}

function cleanTemplate(raw) {
  const inner = raw.slice(2, -2).trim();
  const parts = inner.split('|').map((p) => p.trim());
  const name = parts[0];
  const arg = parts[parts.length - 1];
  if (name === '伤害文本') return arg;
  if (name === '禁闭者数值') return arg;
  if (name === '技能范围') return arg;
  if (name === '术语查看' || name === '禁闭者查看') return `【${arg.replace(/[【】]/g, '')}】`;
  return arg;
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\{\{[\s\S]*?\}\}/g, cleanTemplate)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractParams(content) {
  const rawTemplate = findOuterTemplate(content, '禁闭者图鉴');
  if (!rawTemplate) return null;
  let inner = rawTemplate.slice(2, -2);
  // 先清理嵌套模板，避免其中的 | 干扰外层参数解析
  inner = inner.replace(/\{\{[^{}]*?\}\}/g, cleanTemplate);
  const params = {};
  const regex = /^\|([^=\s]+)=(.*)$/gm;
  let m;
  while ((m = regex.exec(inner)) !== null) {
    const key = m[1].trim();
    const value = m[2].trim();
    params[key] = value;
  }
  return params;
}

function section(title, body) {
  if (!body || body === '无') return '';
  return `### ${title}\n\n${body}\n\n`;
}

function buildBody(name, params) {
  const feature = cleanText(params['特性']);
  const deepenName = cleanText(params['狂厄深化']);
  const deepenEffect = cleanText(params['狂厄深化效果']);
  const nightmare = cleanText(params['梦魇天赋']);
  const brokenBuff = cleanText(params['破碎防线buff']);

  const normalRange = cleanText(params['普攻范围']);
  const normalEffect = cleanText(params['普攻效果']);
  const ultCost = cleanText(params['必杀能量消耗']);
  const ultCore = cleanText(params['必杀核心伤害']);
  const ultRange = cleanText(params['必杀范围']);
  const ultEffect = cleanText(params['必杀效果']);
  const p1Name = cleanText(params['被动1']);
  const p1Effect = cleanText(params['被动1效果']);
  const p2Name = cleanText(params['被动2']);
  const p2Effect = cleanText(params['被动2效果']);

  let basics = `## 基础信息\n\n${name}`;
  if (feature) {
    const featureSentence = feature.replace(/[。！？]$/, '');
    basics += `，${featureSentence}`;
  }
  basics += '。\n\n';

  let featureSection = '## 特性与机制\n\n';
  if (feature) featureSection += `- **特性**：${feature}\n`;
  if (deepenName) featureSection += `- **狂厄深化 · ${deepenName}**：${deepenEffect || '待补充'}\n`;
  if (nightmare) featureSection += `- **梦魇天赋**：${nightmare}\n`;
  if (brokenBuff) featureSection += `- **破碎防线加成**：${brokenBuff}\n`;
  featureSection += '\n';
  if (featureSection === '## 特性与机制\n\n\n') featureSection = '';

  let skillSection = '## 技能\n\n';
  if (params['普攻']) {
    skillSection += section(`普攻：${cleanText(params['普攻'])}`, [normalRange && `**范围**：${normalRange}`, normalEffect && `**效果**：${normalEffect}`].filter(Boolean).join('\n\n'));
  }
  if (params['必杀']) {
    skillSection += section(`必杀：${cleanText(params['必杀'])}`, [ultCost && `**能量消耗**：${ultCost}`, ultCore && `**核心伤害**：${ultCore}`, ultRange && `**范围**：${ultRange}`, ultEffect && `**效果**：${ultEffect}`].filter(Boolean).join('\n\n'));
  }
  if (p1Name) {
    skillSection += section(`被动1：${p1Name}`, p1Effect);
  }
  if (p2Name) {
    skillSection += section(`被动2：${p2Name}`, p2Effect);
  }
  skillSection += '\n';

  const usage = `## 使用建议\n\n1. 根据关卡需求安排站位，充分发挥职业与技能机制的优势。\n2. 优先提升与核心机制相关的技能等级。\n3. 搭配合适的队友与烙印，能在主线与破碎防线中稳定发挥。\n\n`;
  const brands = `## 烙印推荐\n\n- 通用向：亡者之河 + 重逢之日\n- 功能向：回廊空响 + 辛迪加·荣耀\n`;

  return basics + featureSection + skillSection + usage + brands;
}

function updateCharacterFile(filePath, params) {
  const content = readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return false;
  const [, frontmatter] = fmMatch;
  const nameMatch = frontmatter.match(/^name:\s*(.*)$/m);
  const name = nameMatch ? nameMatch[1].trim() : basename(filePath, '.md');
  const newBody = buildBody(name, params);
  writeFileSync(filePath, `---\n${frontmatter}\n---\n\n${newBody}`);
  return true;
}

async function main() {
  const target = process.argv[2];
  const files = readdirSync(CHAR_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !target || f === `${target}.md`);
  if (target && files.length === 0) {
    console.error(`未找到角色文件：${target}.md`);
    process.exit(1);
  }
  let updated = 0;
  let skipped = 0;
  for (const file of files) {
    const path = join(CHAR_DIR, file);
    const name = basename(file, '.md');
    const content = readFileSync(path, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    const displayName = fmMatch ? (fmMatch[1].match(/^name:\s*(.*)$/m) || [])[1]?.trim() : name;
    try {
      const params = await fetchParams(displayName);
      if (!params || !params['普攻']) {
        console.warn(`✗ ${displayName}：未找到完整技能数据，跳过`);
        skipped++;
        continue;
      }
      if (updateCharacterFile(path, params)) {
        console.log(`✓ ${displayName}`);
        updated++;
      }
    } catch (err) {
      console.error(`✗ ${displayName}: ${err.message}`);
      skipped++;
    }
    await sleep(SLEEP_MS);
  }
  console.log(`\n完成：更新 ${updated} 个角色，跳过 ${skipped} 个。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
