# 无期迷途 Wiki 接力文档

> 本文档用于记录项目当前状态、未竟事项与下一步方向，方便后续继续推进。
> 最近更新：2026-06-20

---

## 1. 项目概况

- **仓库**：`E:\ptn-wiki`
- **框架**：Astro 6.x 静态站点
- **部署目标**：Cloudflare Pages
- **自定义域名**：https://5732.wiki/
- **联系邮箱**：ptnwiki@outlook.com
- **GitHub**：https://github.com/vajhXajhcv/ptn-wiki

当前版本已部署，构建产物为 `dist/`，共 **78 个页面**。

---

## 2. 已完成内容（截至 2026-06-20）

### 2.1 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 角色图鉴 | `/characters` | 60 名角色，支持稀有度/职业/定位/关键词筛选，卡片展示官方立绘 |
| 角色详情 | `/characters/[id]` | 左图右信息，面包屑，Article JSON-LD |
| 关卡攻略 | `/stages` | 8 个主线关卡，支持章节/难度/搜索筛选 |
| 玩法攻略 | `/game-modes` | 暗域、公会战、数据间隙 |
| 全站搜索 | `/search` | 覆盖角色、关卡、玩法、更新 |
| 活动日历 | `/calendar` | 按月份分组，支持分类筛选，显示进行中/即将开始/已结束 |
| 更新日志 | `/updates` | 时间线展示，单个更新详情页 |
| 404 页面 | `/404` | 返回首页/角色/关卡入口 |

### 2.2 数据与素材

- **角色元数据**：`src/content/characters/*.md`
- **技能数据**：从 BWiki `scripts/enrich-character-skills.mjs` 批量抓取，已覆盖 **51/60** 名角色
- **官方立绘**：`node scripts/fetch-official-resources.mjs` 下载，已匹配 **58/60** 名角色
- **TAG / role 清洗**：`scripts/clean-tags.mjs` 清除了 HTML 注释残留
- **默认 OG 图**：`public/og-default.png`

### 2.3 SEO / 结构化数据

- `robots.txt`、sitemap
- 每页 canonical URL
- Open Graph / Twitter Card
- BreadcrumbList、Article / WebSite JSON-LD
- SearchAction 指向 `/search?q={search_term_string}`

---

## 3. 当前阻塞 / 待官方确认

- **已给官方发函**，等待回复。后续如需使用官方立绘、数据或获得授权，需根据回复调整声明与素材来源说明。
- 若官方要求下架/修改某些素材，优先处理 `public/characters/*.jpg` 与角色详情页的数据来源声明。

---

## 4. 已知问题

### 4.1 角色数据缺失

以下角色在官网 / BWiki 均无完整独立资料，目前保留占位：

- EMP
- K.K.

### 4.2 技能数据抓取失败

BWiki 反爬严格，批量脚本会返回 HTTP 567 或非 JSON。以下 7 名角色技能数据未成功写入，可后续手动补充或单独重试：

- 阿黛拉
- 艾瑞尔
- 白逸
- 毕安卡
- 澈
- 切尔西伯爵
- 辰砂

### 4.3 生成新角色时的注意事项

`scripts/fetch-bwiki.mjs` 生成角色时，`role` 字段可能为空，会导致构建失败。生成后务必检查并补全 `role`。

---

## 5. 下一步 TODO（按优先级）

### 高优先级

1. **等待并处理官方回复**
   - 根据官方意见更新 `docs/letters/` 与站点声明
   - 如需，调整角色素材使用方式

2. **补充缺失技能数据**
   - 单独为 7 名反爬失败角色写手动/慢速抓取脚本
   - 或在 BWiki 手动复制后粘贴到对应 Markdown 文件

3. **补充 EMP / K.K. 资料**
   - 若官方/BWiki 后续上线独立页面，重新运行抓取脚本
   - 否则考虑合并为通用说明页或隐藏入口

### 中优先级

4. **补充更新 / 活动条目**
   - 在 `src/content/updates/` 添加真实版本更新、活动、维护公告
   - 日历页面内容会随之丰富

5. **完善关卡攻略**
   - 当前关卡正文多为占位
   - 可参照 `scripts/enrich-character-skills.mjs` 思路，从 BWiki 抓取关卡详情

6. **玩法攻略正文**
   - 暗域、公会战、数据间隙的详细机制与阵容建议

### 低优先级 / 体验优化

7. 角色详情页增加技能锚点导航
8. 全站搜索支持拼音/简繁转换
9. 图片懒加载与 WebP 转换
10. 增加 PWA / 离线缓存

---

## 6. 常用命令

```bash
# 本地预览
npm run dev

# 构建
npm run build

# 部署到 Cloudflare Pages（会重新构建）
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
```

> ⚠️ `public/characters/*.jpg` 已加入 `.gitignore`，不要提交到 GitHub。部署前如果本地没有图片，请先运行 `fetch-official-resources.mjs`。

---

## 7. 目录速查

```
src/
  components/      # Header、Footer、Breadcrumbs、BaseHead
  layouts/         # BaseLayout
  pages/           # 所有页面
  content/         # 角色、关卡、玩法、更新 Markdown
  content.config.ts
  consts.ts
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
  clean-tags.mjs
  tmp/                 # 生成报告（不提交）

docs/
  letters/             # 对外函件
  handoff.md           # 本文档
```

---

## 8. 外部依赖与限制

- **BWiki 反爬**：批量请求间隔 10–30 秒，仍可能被限流。失败角色建议手动处理或大幅增加延迟。
- **网络**：`git push` 走 `ssh.github.com:443` + Deploy Key。
- **图片版权**：角色立绘版权归自意网络所有，站点已在 Footer 与角色详情页标注来源。

---

## 9. 备忘

- 当前部署版本预览：https://e2f6405f.ptn-wiki.pages.dev
- 生产域名：https://5732.wiki/
- 若长时间未推进，重新接手时建议先：
  1. `npm install`
  2. `node scripts/fetch-official-resources.mjs`（恢复本地图片）
  3. `npm run build` 验证
  4. 查看本文件 TODO 列表
