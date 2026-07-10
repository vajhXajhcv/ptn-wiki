# 无期迷途 Wiki 接力文档

> 本文档用于记录项目当前状态、未竟事项与下一步方向，方便后续继续推进。
> 最近更新：2026-07-10

---

## 1. 项目概况

- **仓库**：`E:\ptn-wiki`
- **框架**：Astro 6.x 静态站点
- **部署目标**：Cloudflare Pages
- **自定义域名**：https://5732.wiki/
- **联系邮箱**：ptnwiki@outlook.com
- **GitHub**：https://github.com/vajhXajhcv/ptn-wiki

当前版本构建产物为 `dist/`，共 **1056 个页面**（2026-07-10 构建）。
- **最新提交**：`e9108e6` refactor: 统一组件与页面、补全角色别名/更新摘要、新增社区页与 AGENTS.md
- **最新部署**：https://220032c0.ptn-wiki.pages.dev（Git 自动部署，状态 success，已绑定 5732.wiki）

---

## 2. 已完成内容（截至 2026-07-10）

### 2.1 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 角色图鉴 | `/characters` | 156 名角色，支持稀有度/职业/定位/关键词筛选，卡片展示官方立绘 |
| 角色详情 | `/characters/[id]` | 左图右信息，面包屑，Article JSON-LD，展示别名 |
| 关卡攻略 | `/stages` | 主线关卡，支持章节/难度/搜索筛选 |
| 玩法攻略 | `/game-modes` | 暗域、公会战、数据间隙等，支持按类型筛选 |
| 剧情故事 | `/stories` | 主线/活动/支线/角色审查/其他 |
| 全站搜索 | `/search` | 覆盖角色、关卡、玩法、更新、剧情，支持角色别名 |
| 活动日历 | `/calendar` | 按月份分组，支持分类筛选，显示进行中/即将开始/已结束 |
| 更新日志 | `/updates` | 时间线展示，单个更新详情页，已批量回填摘要 |
| 社区资源 | `/community` | 无期迷途相关 GitHub 项目、Wiki 与辅助工具整理 |
| 404 页面 | `/404` | 返回首页/角色/关卡入口 |

### 2.2 数据与素材

- **角色元数据**：`src/content/characters/*.md`
- **角色别名**：29 名角色已写入英文/社区别名（`scripts/enrich-characters-from-gchar.mjs`）
- **更新摘要**：`scripts/backfill-update-descriptions.mjs` 回填 58 条空 description
- **技能数据**：从 BWiki `scripts/enrich-character-skills.mjs` 批量抓取
- **官方立绘**：`node scripts/fetch-official-resources.mjs` 下载
- **TAG / role 清洗**：`scripts/clean-tags.mjs` 清除了 HTML 注释残留
- **默认 OG 图**：`public/og-default.png`

### 2.3 组件 / 样式统一

- `Badge.astro`：统一徽章（稀有度、标签、状态）
- `DetailHeader.astro`：详情页头部（标题、描述、徽章、封面、元信息、来源）
- `FilterBar.astro`：列表页筛选条（搜索、下拉、tabs）
- `CardGrid.astro` / `Card.astro`：统一卡片网格与卡片项
- `JsonLd.astro` / `src/lib/seo.ts`：统一 JSON-LD 生成

列表页与详情页均已统一使用以上组件。

### 2.4 SEO / 结构化数据

- `robots.txt`、sitemap
- 每页 canonical URL
- Open Graph / Twitter Card
- BreadcrumbList、Article / WebSite JSON-LD
- SearchAction 指向 `/search?q={search_term_string}`

---

## 3. 当前阻塞 / 待处理

- **已给官方发函**，等待回复。后续如需使用官方立绘、数据或获得授权，需根据回复调整声明与素材来源说明。
- **GitHub / Cloudflare Pages 关联已恢复**：`vajhXajhcv/ptn-wiki` 已连接，自动部署已启用，构建命令 `npm run build`，输出目录 `dist`。

---

## 4. 已知问题

### 4.1 角色数据缺失/不完整

- 143/156 名角色 `faction` 字段为空，已改为 optional/default 避免构建失败，但尚未批量补全。
- 少量角色独立资料页仍可能缺失或不完整。

### 4.2 网络依赖

- `enrich-characters-from-gchar.mjs` 原方案访问 HuggingFace `gchar` 数据集，曾因网络超时失败，已 fallback 到 BWiki 解析。后续可加入本地缓存与重试。

### 4.3 常量分散

- 稀有度、职业、API 地址、映射表等常量仍散落在各脚本与组件中，尚未集中到 `src/lib/constants.ts`。

---

## 5. 下一步 TODO（按优先级）

### 高优先级

1. **等待并处理官方回复**
   - 根据官方意见更新 `docs/letters/` 与站点声明
   - 如需，调整角色素材使用方式

2. **补全角色阵营数据**
   - 143 名角色 `faction` 为空，可从 BWiki 角色页批量抓取

### 中优先级

3. **集中常量**
   - 创建 `src/lib/constants.ts`，统一稀有度、职业、API 地址、映射表
   - 抽取 `scripts/lib/*.mjs` 公共脚本库（BWiki API、HTML 清洗、文件读写）

4. **补充缺失技能数据**
   - 单独为反爬失败角色写手动/慢速抓取脚本
   - 或在 BWiki 手动复制后粘贴到对应 Markdown 文件

5. **完善关卡攻略正文**
   - 当前关卡正文多为占位
   - 可参照 `scripts/enrich-character-skills.mjs` 思路，从 BWiki 抓取关卡详情

### 低优先级 / 体验优化

6. 角色详情页增加技能锚点导航
7. 全站搜索支持拼音/简繁转换
8. 图片懒加载与 WebP 转换
9. 增加 PWA / 离线缓存

---

## 6. 常用命令

```bash
# 本地预览
npm run dev

# 构建
npm run build

# 部署到 Cloudflare Pages（手动兜底）
npm run deploy
```

### 数据维护脚本

```bash
# 从 BWiki 批量生成新角色元数据（谨慎使用，会覆盖/新增 Markdown）
node scripts/fetch-bwiki.mjs

# 从 BWiki 批量抓取并填充角色技能正文
node scripts/enrich-character-skills.mjs

# 下载官网角色立绘到 public/characters，并更新 frontmatter image 字段
node scripts/fetch-official-resources.mjs

# 清洗 tags / role / 正文中的 HTML 注释残留
node scripts/clean-tags.mjs

# 从官网抓取新闻并生成 updates
node scripts/fetch-official-news.mjs

# 回填 updates 空 description
node scripts/backfill-update-descriptions.mjs

# 为角色写入别名
node scripts/enrich-characters-from-gchar.mjs
```

> ⚠️ `public/characters/*.jpg` 已加入 `.gitignore`，不要提交到 GitHub。部署前如果本地没有图片，请先运行 `fetch-official-resources.mjs`。

---

## 7. 目录速查

```
src/
  components/      # Header、Footer、Breadcrumbs、BaseHead、Badge、Card、FilterBar 等
  layouts/         # BaseLayout
  pages/           # 所有页面
  content/         # 角色、关卡、玩法、更新、剧情 Markdown
  lib/             # seo.ts、公共工具
  content.config.ts
  consts.ts        # SITE_TITLE、SITE_DESCRIPTION 等站点常量
  styles/global.css

public/
  characters/*.jpg     # 官方立绘（本地生成，不提交）
  og-default.png       # 默认 OG 图
  favicon.svg
  robots.txt

scripts/
  fetch-bwiki.mjs
  enrich-character-skills.mjs
  fetch-official-resources.mjs
  fetch-official-news.mjs
  clean-tags.mjs
  backfill-update-descriptions.mjs
  enrich-characters-from-gchar.mjs
  tmp/                 # 生成报告（不提交）

docs/
  letters/             # 对外函件
  handoff.md           # 本文档
  official-assets.md   # 官方素材使用说明
```

---

## 8. 外部依赖与限制

- **BWiki 反爬**：批量请求间隔 10–30 秒，仍可能被限流。失败角色建议手动处理或大幅增加延迟。
- **网络**：`git push` 走 `ssh.github.com:443` + Deploy Key。
- **图片版权**：角色立绘版权归自意网络所有，站点已在 Footer 与角色详情页标注来源。

---

## 9. 备忘

- 当前部署版本预览：https://220032c0.ptn-wiki.pages.dev
- 生产域名：https://5732.wiki/
- 若长时间未推进，重新接手时建议先：
  1. `npm install`
  2. `node scripts/fetch-official-resources.mjs`（恢复本地图片）
  3. `npm run build` 验证
  4. 查看本文件 TODO 列表
