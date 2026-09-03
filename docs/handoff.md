# 无期迷途 Wiki 接力文档

> 本文档用于记录项目当前状态、未竟事项与下一步方向，方便后续继续推进。
> 最近更新：2026-08-04

---

## 1. 项目概况

- **仓库**：`E:\ptn-wiki`
- **框架**：Astro 6.x 静态站点
- **部署目标**：Cloudflare Pages
- **自定义域名**：https://5732.wiki/
- **联系邮箱**：ptnwiki@outlook.com
- **GitHub**：https://github.com/vajhXajhcv/ptn-wiki

当前版本构建产物为 `dist/`，共 **1139 个页面**（2026-08-04 构建）。
- **最新提交**：`e9108e6` refactor: 统一组件与页面、补全角色别名/更新摘要、新增社区页与 AGENTS.md（2026-08-04 的变更待提交）
- **最新部署**：https://e805ef44.ptn-wiki.pages.dev（2026-08-14 本地 `npm run deploy` 手动部署，恢复角色立绘）
- **注意**：`public/characters/*.jpg` 不提交 Git，CI 构建前由 `prebuild` 钩子（`scripts/ensure-character-images.mjs`）自动从官网补齐立绘，自动部署不再丢图（2026-08-14 修复）。
- **2026-09-03 修复**：同步工作流曾把 updates 空 description 写成 YAML null，导致 Cloudflare Pages 连续 3 次构建失败、线上冻结在 08-14。已在 `fetch-official-news.mjs` 中用标题兜底并兼容空值回填；同时移除了同步工作流中会把 imageSource 从「BWiki 升阶装束」改写回官网来源的 `fetch-official-resources.mjs --no-download` 步骤；抓取脚本统一加了 30s 请求超时与 5 分钟整体预算（`FETCH_TIME_BUDGET_MS` 可调）。
- **2026-09-03 新增**：updates 支持 `startDate` / `endDate` 活动时间区间（`scripts/lib/parse-event-dates.mjs` 从正文解析「开始 ~ 结束」，存量由 `scripts/backfill-update-enddates.mjs` 回填，增量由 `fetch-official-news.mjs` 自动写入）；活动日历与首页「近期活动」据此判定进行中/即将开始。首页精简为 搜索 + 4 个快速入口 + 最新动态 + 近期活动；顶部导航收敛为 角色/关卡/玩法/剧情/日历 + 「更多」下拉 + 搜索。
- **2026-09-03 剧情扩容**：补抓雾巷诡影 6 段（累计 10 段）；`fetch-bwiki-stories.mjs` 增加「空解析重试一次」（BWiki 限流错误也返回 JSON，原逻辑会把临时失败当成空页面跳过）与 `审查-` 前缀的类型识别（修复 backfill-story-chapters 把审查剧情误改 type=活动 的问题）。确认 BWiki 红链（无文本）：龙与天空岛、沉溺无忧海、绿窗窥景、完美投票（除 1 段）、瑰异奇妙夜及新主线 N9-N12 大部分页面——这些活动的文本 BWiki 未收录，微博/语雀有玩家手工整理（更新至第 25 章绝响），如需补录需另写语雀抓取。
- **2026-09-03 留影 CG**：新增 `scripts/fetch-story-cgs.mjs` 枚举 BWiki「分类：留影」，生成 `src/data/story-cgs.json`（55 个活动/篇章、596 张剧情 CG 的 CDN 直链元数据，不下载图片）。剧情详情页按 chapter 名归一化匹配（去标点、双向包含，如 刹雨/繁花 ↔ 刹雨·繁花、新城·悬城篇 ↔ 悬城）展示「活动留影」画廊，455 个剧情页有图。待办：主线早期章节（混沌彼岸/无主地窟/奇兰广场等）CG key 是章节名而非篇章名，需建立章节号→章节名映射后才能匹配。
- **2026-09-03 官网壁纸**：发现官网「影像资料馆」公开 API（`/api/paperonetag` → `/api/papertwotag` → `/api/paperlist`，共 611 张壁纸，CG壁纸按活动/主线章节分标签，覆盖绝响、龙与天空岛等 BWiki 无文本的新内容）。新增 `scripts/fetch-official-wallpapers.mjs` 生成 `src/data/official-wallpapers.json`（611 张；审查壁纸无标签，用全量差集得到 19 张入狱照）；剧情详情页新增「官方壁纸」区块（与留影画廊并存），缩略图走 OSS `?x-oss-process=image/resize,w_640`。新增独立壁纸页 `/wallpapers`（分类/标签/搜索筛选，导航「更多」内）。待办：官方标签含主线章节名，已借此建映射（见下条）。
- **2026-09-03 主线章节映射**：新增 `scripts/build-main-chapter-map.mjs`，解析 BWiki「主线剧情」索引的 tab 块结构（块内留影海报 = CG 合集名，表格行标题 = 章节名），生成 `src/data/main-story-chapters.json`（351 个主线页 → 章节名候选）。剧情详情页据此匹配主线 CG：664/685 个剧情页有画廊；角色审查页匹配同名入狱照（如 海拉）。

---

## 2. 已完成内容（截至 2026-07-10）

### 2.1 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 角色图鉴 | `/characters` | 159 名角色，支持稀有度/职业/定位/阵营/关键词筛选，卡片展示官方立绘与阵营徽章 |
| 角色详情 | `/characters/[id]` | 左图右信息，面包屑，Article JSON-LD，展示别名与阵营 |
| 阵营图鉴 | `/factions` | 十六大狂厄阵营成员总览（数据驱动，2026-08-04 新增） |
| 常用配队 | `/teams` | 破绽/残锋/风蚀/感电/燃烧五队，成员按技能机制关键词自动归纳（2026-08-14 新增） |
| 世界观 | `/lore` | 零镜系统设定档案 61 条：入夜纪年/狄斯城/狂厄（2026-08-04 新增） |
| 关卡攻略 | `/stages` | 主线关卡，支持章节/难度/搜索筛选 |
| 玩法攻略 | `/game-modes` | 暗域、公会战、数据间隙等，支持按类型筛选 |
| 剧情故事 | `/stories` | 主线 258 段（铁血/锈火/悬城/覆海四篇）+ 活动 412 段 + 角色审查 9 篇，按篇章/活动筛选 |
| 全站搜索 | `/search` | 覆盖角色、关卡、玩法、更新、剧情、世界观，支持角色别名 |
| 活动日历 | `/calendar` | 按月份分组，支持分类筛选，显示进行中/即将开始/已结束 |
| 更新日志 | `/updates` | 时间线展示，单个更新详情页，已批量回填摘要 |
| 社区资源 | `/community` | 无期迷途相关 GitHub 项目、Wiki 与辅助工具整理 |
| 404 页面 | `/404` | 返回首页/角色/关卡入口 |

### 2.2 数据与素材

- **角色元数据**：`src/content/characters/*.md`
- **角色别名**：29 名角色已写入英文/社区别名（`scripts/enrich-characters-from-gchar.mjs`）
- **更新摘要**：`scripts/backfill-update-descriptions.mjs` 回填 58 条空 description
- **技能数据**：从 BWiki `scripts/enrich-character-skills.mjs` 批量抓取
- **角色主图（三阶立绘）**：`node scripts/fetch-bwiki-ascended-art.mjs` 从 BWiki 抓「升阶装束」，159/159 覆盖（2026-08-14 起取代官网图为默认主图）
- **禁闭者画廊**：`node scripts/build-character-galleries.mjs` 生成 `src/data/galleries.json`，详情页底部展示官网贺图/装束/壁纸（2026-08-14 新增）
- **官方立绘（兜底）**：`node scripts/fetch-official-resources.mjs` 下载
- **玩法配图 / 默认 OG**：`node scripts/fetch-gamemode-covers.mjs` 匹配官网封面，官方 CDN 直链（2026-08-14 新增）
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

- ~~143/156 名角色 `faction` 字段为空~~ **已解决（2026-08-04）**：`scripts/backfill-factions.mjs` 从 BWiki 批量回填，158/159 名角色已确认官方阵营；仅「丽奎安」（四周年预告角色，未实装）暂缺。
- 8 名角色原先手工填写的是剧情组织（如辛迪加、军团），已按 BWiki 档案统一修正为官方狂厄阵营（破坏/背离/混沌/执迷等）。
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

2. **补全「丽奎安」数据**
   - 四周年预告角色（档案编号 MBCC-S-???），8 月 6 日「绝响」主线活动开启后：
     `node scripts/fetch-bwiki.mjs`（更新头衔/特性）、`node scripts/backfill-factions.mjs`（阵营）、
     `node scripts/enrich-character-skills.mjs likuian`（技能）、`node scripts/fetch-official-resources.mjs`（立绘）

3. **四周年后数据巡检**
   - `node scripts/fetch-official-news.mjs` 同步周年庆活动公告
   - `node scripts/fetch-bwiki-stories.mjs` 同步「绝响」主线剧情文本（N10 章与绝响活动页 BWiki 目前还是空链，需等社区补写）
   - 同步后跑 `node scripts/backfill-story-chapters.mjs` 让新剧情自动归入篇章/活动

### 中优先级

4. **集中常量（部分完成）**
   - `src/lib/constants.ts` 已建立（稀有度、职业、玩法类型、阵营 `FACTIONS` 等），但各脚本仍各自持有映射表，尚未统一到 `scripts/lib/*.mjs` 公共库（BWiki API、HTML 清洗、文件读写）

5. **补充缺失技能数据**
   - 单独为反爬失败角色写手动/慢速抓取脚本
   - 或在 BWiki 手动复制后粘贴到对应 Markdown 文件

6. **完善关卡攻略正文**
   - 当前关卡正文多为占位
   - 可参照 `scripts/enrich-character-skills.mjs` 思路，从 BWiki 抓取关卡详情

### 低优先级 / 体验优化

7. 角色详情页增加技能锚点导航
8. 全站搜索支持拼音/简繁转换
9. 图片懒加载与 WebP 转换
10. 增加 PWA / 离线缓存
11. lore 条目间内链（如「狂厄」词条引用「黑环」「禁闭者」时互相跳转）
12. 角色审查剧情目前仅 9 篇（安/海拉/迪蒙/黛伦/诺克斯/九十九/帕加茜/维多利亚/伊琳娜）——BWiki 只公开了这些；待社区补写更多角色审查页后重跑 `fetch-bwiki-reviews.mjs`

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

# 从 BWiki 批量回填角色阵营（faction）
node scripts/backfill-factions.mjs

# 从 BWiki 零镜系统抓取世界观设定（lore 集合）
node scripts/fetch-bwiki-lore.mjs

# 下载官网角色立绘到 public/characters，并更新 frontmatter image 字段
# 已存在且已标注来源的自动跳过；--force 强制全量重跑
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
  backfill-factions.mjs
  fetch-bwiki-lore.mjs
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
