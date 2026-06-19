import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHAR_DIR = join(process.cwd(), 'src', 'content', 'characters');

function parseTags(value) {
  value = value.trim();
  if (!value.startsWith('[') || !value.endsWith(']')) return [];
  const inner = value.slice(1, -1);
  let current = '';
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    const next = inner[i + 1];
    if (ch === "'" && !inQuote) {
      inQuote = true;
    } else if (ch === "'" && inQuote) {
      if (next === "'") {
        current += "'";
        i++;
      } else {
        inQuote = false;
      }
    } else {
      current += ch;
    }
  }
  return current.split(',').map(s => s.trim());
}

function cleanTag(tag) {
  return tag
    .replace(/<!--[\s\S]*$/, '')
    .replace(/^[\s\S]*-->/, '')
    .replace(/<!--.*?-->/g, '')
    .replace(/^[,,\s]+|[,,\s]+$/g, '')
    .trim();
}

function cleanTagsLine(line) {
  const match = line.match(/^tags:\s*(.+)$/);
  if (!match) return line;
  const rawItems = parseTags(match[1]);
  const cleaned = rawItems.map(cleanTag).filter(Boolean);
  return `tags: [${cleaned.map(t => `'${t.replace(/'/g, "\\'")}'`).join(', ')}]`;
}

const files = readdirSync(CHAR_DIR).filter(f => f.endsWith('.md'));
let changedCount = 0;
for (const file of files) {
  const path = join(CHAR_DIR, file);
  const content = readFileSync(path, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) continue;
  const [, frontmatter, body] = fmMatch;
  const newFrontmatter = frontmatter.replace(/^tags:\s*.+$/gm, cleanTagsLine);
  if (newFrontmatter === frontmatter) continue;
  writeFileSync(path, `---\n${newFrontmatter}\n---\n${body}`);
  changedCount++;
  console.log('Cleaned tags in', file);
}
console.log(`Done. Cleaned ${changedCount} files.`);
