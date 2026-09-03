// 清除关卡 Markdown 中的模板占位正文（「通关思路」「三星要点」通用套话，与具体关卡无关，
// 属于误导性内容）。关卡的真实信息由 frontmatter 结构化字段（敌人/目标/奖励）承载，
// 详情页「关卡情报」区块渲染。幂等：正文为空的文件自动跳过。

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGES_DIR = join(__dirname, '..', 'src', 'content', 'stages');

let cleaned = 0;
let skipped = 0;

for (const file of readdirSync(STAGES_DIR).filter((f) => f.endsWith('.md'))) {
	const path = join(STAGES_DIR, file);
	const content = readFileSync(path, 'utf8');
	const parts = content.split(/^---$/m);
	if (parts.length < 3) {
		skipped++;
		continue;
	}
	const body = parts.slice(2).join('---').trim();
	if (!body) {
		skipped++;
		continue;
	}
	// 只删模板套话；若某关未来写入了真实攻略正文，不在这里处理
	if (!body.includes('通关思路')) {
		skipped++;
		console.warn(`   跳过（非模板正文，请人工确认）: ${file}`);
		continue;
	}
	writeFileSync(path, parts[0] + '---' + parts[1] + '---\n', 'utf8');
	cleaned++;
}

console.log(`完成。清除模板正文 ${cleaned} 篇，跳过 ${skipped} 篇。`);
