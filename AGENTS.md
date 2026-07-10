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
- `gameModes`：`name`, `type`, `description`, `unlock`, `rewards`, `image`, `tags`
- `updates`：`title`, `date`, `type`, `description`, `source`, `cover`, `tags`
- `stories`：`title`, `type`, `chapter`, `section`, `description`, `characters`, `source`, `tags`

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
node scripts/fetch-official-resources.mjs       # 下载官网角色立绘
node scripts/fetch-official-resources.mjs --no-download
node scripts/apply-image-sources.mjs
node scripts/fetch-official-news.mjs            # 抓取官网资讯
```

### 6.2 BWiki 数据

```sh
node scripts/fetch-bwiki.mjs              # 角色
node scripts/fetch-bwiki-stages.mjs       # 关卡
node scripts/fetch-bwiki-stories.mjs      # 剧情（默认跳过已存在）
node scripts/fetch-bwiki-stories.mjs --force
```

### 6.3 清洗与补全

```sh
node scripts/clean-tags.mjs                       # 清洗 HTML 注释残留
node scripts/backfill-update-descriptions.mjs     # 回填 updates 空 description
node scripts/enrich-characters-from-gchar.mjs     # 写入角色别名
```

---

## 7. 版权与合规（必须遵守）

- **角色图片**来自《无期迷途》官方网站，**不提交到 GitHub**。本地生成后仅用于预览与部署。
- **剧情文本**来自无期迷途 BWiki，页面必须保留来源链接或声明。
- **社区资源页**仅链接到外部 GitHub / Wiki 项目，不直接托管解密资源或第三方正文。
- 若官方提出下架/修改要求，优先处理 `public/characters/` 与详情页数据来源声明。

---

## 8. 构建与部署

```sh
npm run build     # 生成 dist/
npm run deploy    # build + wrangler pages deploy
```

### 已知部署问题

- Cloudflare Pages 项目 `ptn-wiki` 的 Git Provider 当前为 `No`，GitHub push 不会自动触发部署。
- 当前需要手动执行 `npm run deploy` 发布。
- 如需恢复自动部署，请在 Cloudflare 控制台重新连接 GitHub 仓库。

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
- `docs/official-assets.md` — 官方素材合规说明
- `docs/letters/to-official.md` — 致官方沟通函模板
- `docs/letters/to-bwiki.md` — 致 BWiki 维护团队协作函
