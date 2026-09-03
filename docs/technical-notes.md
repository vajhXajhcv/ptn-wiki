# 技术文稿：图片数据源与构建稳定性（2026-09-03）

> 记录本轮剧情 CG / 壁纸功能涉及的数据源、接口细节与踩过的坑，供后续维护参考。

---

## 1. 数据源：官网「影像资料馆」壁纸 API

官网（wqmt.aisnogames.com）是 Next.js 站点，壁纸板块走公开 JSON API，无需登录：

```
GET /api/paperonetag                          # 一级分类：CG壁纸(10) / 影像壁纸(9) / 审查壁纸(8)
GET /api/papertwotag?paperonetag_id={id}      # 二级标签（活动/章节名），审查壁纸返回空
GET /api/paperlist?papertwotag_id={id}        # 该标签下壁纸列表
GET /api/paperlist                            # 全量 611 张（过滤参数对无标签项无效）
```

- 壁纸字段：`id` / `title` / `landscape_url`（横版）/ `portrait_url`（竖版）。
- **审查壁纸无标签**：用全量列表减去所有已归类 id 的差集获得（当前 19 张入狱照）。若官方后续给审查壁纸加标签，差集逻辑需同步调整。
- 发现路径：`_buildManifest.js` 列出全部页面路由 → `/m/archives/gallery` 页面 chunk → 接口名 `paperlist/paperonetag/papertwotag`。
- 生成脚本：`scripts/fetch-official-wallpapers.mjs` → `src/data/official-wallpapers.json`。

## 2. 数据源：BWiki 留影 CG

- 分类 `分类:留影`（500+ 文件），命名 `文件:留影 {活动/章节名}-{罗马数字}(-男|-女)?.png`。
- 图片 URL 用 `prop=imageinfo&iiprop=url|size&iiurlwidth=1280` 批量获取（每批 50 个标题），`thumburl` 为 1280 宽缩略图。
- CDN（patchwiki.biligame.com）**无 referer 校验**，可直接外链，原图约 3MB/张。
- 生成脚本：`scripts/fetch-story-cgs.mjs` → `src/data/story-cgs.json`。

## 3. 章节名匹配

剧情页 chapter 字段与图片集合名不一致（`沉溺、无忧海` vs `沉溺无忧海`、`新城·悬城篇` vs `悬城`、刹雨/繁花 共用 `刹雨·繁花`）。匹配统一走归一化：去除非标点字符后做双向包含比较。

主线章节的 chapter 字段是篇章级（铁血/锈火/悬城/覆海篇），而 CG 按章节名组织。`scripts/build-main-chapter-map.mjs` 解析 BWiki「主线剧情」索引的 tab 块结构——每块内嵌的 `[[文件:留影 XXX]]` 海报即该章 CG 合集名，表格行标题（`混沌彼岸A/B`）为章节名——生成 `src/data/main-story-chapters.json`（351 页 → 候选名数组，行名优先、海报名兜底）。残锋/绝响两个 tab 的按钮在导航模板里，需二次抓取。

## 4. 官网 CDN 缩略图

static.aisnogames.com 是阿里 OSS，支持图片处理参数：

```
{landscape_url}?x-oss-process=image/resize,w_640   # 6.8MB → ~250KB
```

所有列表/画廊缩略图必须加该参数，原图只用于点击查看。

## 5. 构建稳定性：prebuild 图片补齐的隐患

`prebuild`（`scripts/ensure-character-images.mjs`）在 CI/CF 构建前补齐 158 张角色立绘（`.gitignore` 不提交）。2026-09-03 出现 CF Pages 连续两次构建失败，GitHub Actions 同提交通过：

- CF 构建机访问 BWiki 返回 **HTTP 567**（反爬拦截）；
- 回退源官网 `wqmt.aisnogames.com` **连接超时**（CF 到国内站点网络不稳）。

**处理预案**：

1. 偶发失败 → CF 控制台 Retry deployment，或 API：
   `POST /client/v4/accounts/{account}/pages/projects/ptn-wiki/deployments/{id}/retry`
2. 查询构建日志：
   `GET .../deployments/{id}/history/logs`（用 wrangler 本地 oauth token 鉴权）。
3. 若成为常态，考虑：把立绘转存 R2 / 改用 GitHub Actions 构建后 `wrangler pages deploy` 直传（绕开 CF 构建机）。
4. 本地构建图片齐全时 prebuild 秒过；紧急时 `SKIP_IMAGE_ENSURE=1 npm run build`。

## 6. BWiki 抓取的已知坑

- **限流也返回 JSON**（error 结构），不能把「解析出 0 条对话」直接当成页面不存在——`fetch-bwiki-stories.mjs` 已加空解析重试一次。
- 网络错误（ECONNRESET/超时）要单独重试，原脚本只处理非 JSON 响应（`fetch-story-cgs.mjs` 已加 5 次指数退避）。
- 大量请求保持 ≥800ms 间隔。
- 分析用的临时文件放 `scripts/tmp/`（勿提交仓库根目录）。

## 7. 线上验证入口

- 留影画廊：https://5732.wiki/stories/fog-104剧情/
- 主线 CG：https://5732.wiki/stories/1-1剧情/
- 审查入狱照：https://5732.wiki/stories/审查-hella/
- 壁纸图鉴：https://5732.wiki/wallpapers/
