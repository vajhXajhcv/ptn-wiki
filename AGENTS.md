# AGENTS.md — 无期迷途 Wiki 开发指南

> 面向 AI coding agents 的项目约定、关键代码路径与合规注意。

---

## 1. 项目概览

- **名称**：无期迷途 Wiki
- **技术栈**：Astro 6.x 静态站点，部署到 Cloudflare Pages
- **域名**：https://5732.wiki
- **页面规模**：约 1000+ 静态页面
- **工作目录**：`E:\ptn-wiki`

---

## 2. 目录约定

```
src/
  components/    # 可复用组件：Badge、Card、CardGrid、DetailHeader、FilterBar、JsonLd 等
  layouts/       # BaseLayout
  pages/         # 所有路由页面
  content/       # Markdown 内容集合：characters / stages / game-modes / updates / stories
  lib/           # 工具函数：seo.ts
  content.config.ts
  consts.ts      # SITE_TITLE、SITE_DESCRIPTION 等站点常量
  styles/global.css

scripts/         # 数据维护脚本
public/          # 静态资源（角色图片本地生成，不提交）
docs/            # 项目文档与对外函件
```

---

## 3. 内容集合 Schema

主要集合定义在 `src/content.config.ts`：

- `characters`：`name`, `title`, `rarity` (S/A/B), `role`, `faction`, `danger`, `description`, `image`, `imageSource`, `tags`, `aliases`
- `stages`：`name`, `chapter`, `stageNumber`, `difficulty`, `recommendedLevel`, `description`, `tags`
- `gameModes`：`name`, `type`, `description`, `unlock`, `rewards`, `image`, `imageSource`, `tags`
- `updates`：`title`, `date`, `type`, `description`, `startDate`, `endDate`（活动时间区间，由公告正文解析，可空）, `source`, `cover`, `tags`
- `stories`：`title`, `type`, `chapter`, `section`, `description`, `characters`, `source`, `tags`
- `lore`：`title`, `chapter` (入夜纪年/狄斯城/狂厄), `section`, `code`, `description`, `source`, `tags`

其他数据文件：

- `src/data/galleries.json`：禁闭者画廊元数据（角色 → 官网资讯图片列表），由 `scripts/build-character-galleries.mjs` 生成，提交进 git。
- `src/data/story-cgs.json`：剧情留影 CG 元数据（活动/篇章名 → BWiki CDN 直链列表，含 1280 宽缩略图与原图地址），由 `scripts/fetch-story-cgs.mjs` 生成，提交进 git；图片本体不下载。BWiki 缩略图仅 800/1280 两档，剧情页展示用 800px 档并带 onerror 回退 1280px。
- `src/data/official-wallpapers.json`：官网「影像资料馆」壁纸元数据（分类 → 活动标签 → 横/竖版图直链），由 `scripts/fetch-official-wallpapers.mjs` 生成，提交进 git；展示用缩略图加 `?x-oss-process=image/resize,w_640` 缩放参数。审查壁纸无标签，脚本用全量列表减已归类项的差集生成。
- `src/data/main-story-chapters.json`：主线剧情页 → 章节名候选（行名/海报名），由 `scripts/build-main-chapter-map.mjs` 解析 BWiki「主线剧情」索引生成，用于主线剧情页匹配留影 CG 与官方 CG 壁纸。
- `src/data/official-cg-duplicates.json`：剧情页「官方壁纸」×「活动留影」跨区块去重表（官方标签 → 留影事件 → 重复的官方壁纸 id），由 `scripts/dedupe-official-cgs.mjs` 用感知哈希（aHash）比对生成，提交进 git；感知哈希缓存在 `scripts/tmp/phash-cache.json`（不提交）。
- 配队页（`/teams`）为数据驱动页面，队伍定义在 `src/lib/constants.ts` 的 `TEAMS`，成员按关键词从角色技能正文自动匹配，无独立内容集合。

修改 schema 后，必须同时更新 `scripts/` 中生成对应 Markdown 的脚本。

---

## 4. 组件使用规范

### 4.1 列表页统一结构

- 使用 `FilterBar.astro` 提供搜索 / 下拉 / tab 筛选。
- 使用 `CardGrid.astro` + `Card.astro` 展示条目。
- 筛选脚本写在页面内联 `<script>` 中，依赖 `data-filter` 与 `data-filter-group` 属性。

### 4.2 详情页统一结构

- 使用 `Breadcrumbs.astro` 生成面包屑。
- 使用 `DetailHeader.astro` 展示标题、描述、徽章、封面图、元信息、来源。
- 使用 `JsonLd.astro` 输出 `breadcrumbJsonLd()` 与 `articleJsonLd()`。

### 4.3 徽章与卡片

- 稀有度徽章使用 `variant="rarity-s"` / `rarity-a` / `rarity-b`。
- 标签类徽章使用 `variant="tag"`。
- 状态徽章使用 `variant="status-ongoing"` / `status-upcoming` / `status-past`。

---

## 5. SEO / 结构化数据

所有详情页应输出：

1. Open Graph：`BaseLayout` 已自动处理 `title`、`description`、`image`。
2. BreadcrumbList JSON-LD：通过 `breadcrumbJsonLd(breadcrumbItems, Astro.site)`。
3. Article JSON-LD：通过 `articleJsonLd({ title, description, url, site, image, datePublished })`。

新增页面类型时，在 `src/lib/seo.ts` 中增加对应的 JSON-LD 生成函数。

---

## 6. 数据维护脚本

所有脚本均位于 `scripts/`，使用 ES Module。运行前确认 Node >=22.12。

### 6.1 角色图片与资讯（官网）

```sh
node scripts/fetch-official-resources.mjs       # 下载官网角色立绘（现为兜底来源）
node scripts/fetch-official-resources.mjs --no-download
node scripts/apply-image-sources.mjs
node scripts/fetch-official-news.mjs            # 抓取官网资讯
node scripts/fetch-gamemode-covers.mjs          # 为玩法匹配官网封面/壁纸（CDN 直链）
node scripts/fetch-official-wallpapers.mjs      # 官网影像资料馆壁纸元数据（CG壁纸/影像壁纸）→ src/data/official-wallpapers.json
node scripts/build-character-galleries.mjs      # 生成禁闭者画廊元数据 src/data/galleries.json
```

> 角色主图统一为 BWiki「升阶装束」（三阶立绘），见 6.2 的 `fetch-bwiki-ascended-art.mjs`；官网脚本保留为缺图兜底。

### 6.2 BWiki 数据

```sh
node scripts/fetch-bwiki.mjs              # 角色
node scripts/fetch-bwiki-stages.mjs       # 关卡
node scripts/fetch-bwiki-stories.mjs      # 剧情（默认跳过已存在）
node scripts/fetch-bwiki-stories.mjs --force
node scripts/fetch-bwiki-reviews.mjs      # 角色审查剧情（intitle:审查 枚举，约 10 篇）
node scripts/fetch-bwiki-ascended-art.mjs # 角色三阶立绘（升阶装束），主图来源
node scripts/backfill-story-chapters.mjs  # 回填剧情篇章/活动名（主线四篇 + 活动归属）
node scripts/fetch-story-cgs.mjs          # 剧情留影 CG 元数据（分类:留影 → src/data/story-cgs.json，CDN 直链不下载）
node scripts/dedupe-official-cgs.mjs      # 剧情页官方壁纸 × 留影跨区块去重（aHash 比对 → src/data/official-cg-duplicates.json）
node scripts/build-main-chapter-map.mjs   # 主线剧情页 → 章节名映射（解析「主线剧情」索引结构）
node scripts/fetch-bwiki-lore.mjs         # 世界观（零镜系统）
node scripts/backfill-factions.mjs        # 角色阵营回填
```

### 6.3 清洗与补全

```sh
node scripts/clean-tags.mjs                       # 清洗 HTML 注释残留
node scripts/backfill-update-descriptions.mjs     # 回填 updates 空 description
node scripts/backfill-update-enddates.mjs         # 从公告正文解析活动时间区间（startDate/endDate）
node scripts/enrich-characters-from-gchar.mjs     # 写入角色别名
```

---

## 7. 版权与合规（必须遵守）

- **角色图片**（三阶立绘）来自无期迷途 **BWiki** 的「升阶装束」文件，官网资讯图片（生日贺图/装束/壁纸等）仅用于详情页画廊区块（CDN 直链）。图片均**不提交到 GitHub**，本地生成后仅用于预览与部署。
- **剧情文本**来自无期迷途 BWiki，页面必须保留来源链接或声明。
- **社区资源页**仅链接到外部 GitHub / Wiki 项目，不直接托管解密资源或第三方正文。
- 若官方提出下架/修改要求，优先处理 `public/characters/` 与详情页数据来源声明。

---

## 8. 构建与部署

```sh
npm run build     # 生成 dist/
npm run deploy    # build + wrangler pages deploy
```

### 已知部署问题（重要）

- Cloudflare Pages 已连接 GitHub 仓库，push 会自动触发部署（CI 构建命令 `npm run build`）。
- `.github/workflows/sync-official.yml` 每周一/周四定时同步：官网资讯（updates）、官网壁纸、BWiki 留影 CG、角色画廊，最后重跑 `dedupe-official-cgs.mjs` 更新去重表并自动提交。
- `public/characters/*.jpg` 在 `.gitignore` 中，CI 检出里没有立绘——曾导致自动部署后线上图片全部 404（2026-08-14）。
- **已修复（2026-08-14）**：`package.json` 增加 `prebuild` 钩子 `scripts/ensure-character-images.mjs`，构建前自动检查立绘引用、缺失时调用 `fetch-official-resources.mjs` 从官网补齐，一张都下载不到则中止构建。CI 与本地 `npm run build` / `npm run deploy` 都会经过该检查。
- 如需跳过检查（如官网接口临时故障）：`SKIP_IMAGE_ENSURE=1 npm run build`。

---

## 9. 常见注意事项

- 修改 `src/content.config.ts` 后运行 `npm run build` 验证。
- 新增列表页或详情页时，优先复用 `DetailHeader`、`FilterBar`、`CardGrid`、`Card`、`JsonLd`。
- 脚本大量请求 BWiki 时，注意增加延迟，避免触发反爬。
- 不要修改 `.gitignore` 中 `public/characters/*.jpg` 的忽略规则。
- 新增脚本建议写为幂等：已存在文件默认跳过，除非显式加 `--force`。

---

## 10. 推荐阅读

- `docs/handoff.md` — 当前状态、TODO、接力说明
- `docs/technical-notes.md` — 图片数据源（官网壁纸 API / BWiki 留影）与构建稳定性技术说明
- `docs/official-assets.md` — 官方素材合规说明
- `docs/letters/to-official.md` — 致官方沟通函模板
- `docs/letters/to-bwiki.md` — 致 BWiki 维护团队协作函
