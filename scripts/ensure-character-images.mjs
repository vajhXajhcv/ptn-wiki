// 构建前检查：确保 frontmatter 中引用的角色立绘在 public/ 下真实存在。
//
// 背景：public/characters/*.jpg 不提交 Git（版权合规），CI 从仓库构建时没有图片，
// 直接部署会导致线上立绘全部 404（2026-08-14 实际发生）。
//
// 行为：
// - 所有被引用的图片都在 → 直接通过（本地日常构建走这里，零网络开销）。
// - 有缺失 → 自动运行 fetch-official-resources.mjs 从官网补齐（CI 场景）。
// - 补齐后仍一张都没有（官网接口故障等）→ 退出码 1，让构建失败，避免发布无图站点。
// - 个别角色实装前本就无图（如丽奎安），只警告不阻断。
//
// 可用 SKIP_IMAGE_ENSURE=1 跳过检查。

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAR_DIR = join(ROOT, 'src', 'content', 'characters');
const PUBLIC_DIR = join(ROOT, 'public');

if (process.env.SKIP_IMAGE_ENSURE === '1') {
	console.log('[ensure-images] SKIP_IMAGE_ENSURE=1，跳过检查');
	process.exit(0);
}

function missingImages() {
	const files = readdirSync(CHAR_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	const missing = [];
	for (const f of files) {
		const content = readFileSync(join(CHAR_DIR, f), 'utf8');
		const m = content.match(/^image:\s*(.+)$/m);
		if (!m) continue;
		const image = m[1].trim();
		if (!image.startsWith('/')) continue; // 外链不检查
		if (!existsSync(join(PUBLIC_DIR, image))) {
			missing.push({ slug: f.replace(/\.(md|mdx)$/, ''), image });
		}
	}
	return missing;
}

let missing = missingImages();

if (missing.length > 0) {
	console.log(`[ensure-images] 缺失 ${missing.length} 张角色立绘，运行 fetch-official-resources.mjs 补齐...`);
	const res = spawnSync(process.execPath, [join(__dirname, 'fetch-official-resources.mjs')], {
		stdio: 'inherit',
		cwd: ROOT,
	});
	if (res.status !== 0) {
		console.warn(`[ensure-images] 取图脚本退出码 ${res.status}，继续检查剩余缺失`);
	}
	missing = missingImages();
}

if (missing.length === 0) {
	console.log('[ensure-images] 角色立绘齐全');
	process.exit(0);
}

const referenced = readdirSync(CHAR_DIR)
	.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
	.filter((f) => /^image:\s*\//m.test(readFileSync(join(CHAR_DIR, f), 'utf8'))).length;
const present = referenced - missing.length;

if (present === 0) {
	console.error('[ensure-images] 一张立绘都没能下载，构建中止以避免发布无图站点。');
	console.error('[ensure-images] 请检查官网接口可用性或网络后重试；确认要跳过可用 SKIP_IMAGE_ENSURE=1。');
	process.exit(1);
}

console.warn(`[ensure-images] 仍有 ${missing.length} 张立绘缺失（多为未实装角色，继续构建）：`);
for (const m of missing) console.warn(`  - ${m.slug} -> ${m.image}`);
