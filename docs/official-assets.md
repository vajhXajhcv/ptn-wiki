# 官网公开资源与合规使用说明

## 资源发现

《无期迷途》国服官网（`https://wqmt.aisnogames.com/`）对外暴露了公开 API：

```
GET https://wqmt.aisnogames.com/api/news?section=1&offset={offset}&limit={limit}
GET https://wqmt.aisnogames.com/api/news/{id}
```

无需登录即可读取。截至本次抓取，共 1646 条资讯，按类型分布如下（仅列出与 Wiki 相关的类别）：

| 类型 | 数量 | 用途 |
|------|------|------|
| 禁闭者档案 | 100+ | 角色立绘、设定、异能说明 |
| 禁闭者影像捕获 | 90+ | 角色动态展示/GIF、视频 |
| 禁闭者装束 | 160+ | 皮肤宣传图 |
| MBCC生日会 | 280+ | 角色生日贺图 |
| 壁纸 / 影像壁纸 / 无期记事 | 130+ | 壁纸、角色插画 |
| 预告 / 公告 / 活动资讯 / 游戏原声 / 表情包等 | 若干 | 版本信息、活动说明、社区内容 |

> 以上数据来自官网公开接口，版权归 **上海自意网络科技有限公司 / 自意网络** 所有。

## 已应用到 Wiki 的资源

### 1. 角色图片

脚本 `scripts/fetch-official-resources.mjs` 完成以下工作：

1. 拉取全部资讯列表。
2. 按优先级匹配角色：禁闭者档案 → 禁闭者影像捕获 → 禁闭者装束 → MBCC生日会 → 壁纸。
3. 取第一条静态图片，用 Jimp 压缩为宽 480px、JPEG 质量 85% 的卡片/详情页尺寸。
4. 保存到 `public/characters/{slug}.jpg`。
5. 同步更新对应 Markdown 的 `image` 字段，并在 `imageSource` 中记录图片来源：

```yaml
image: /characters/adela.jpg
imageSource:
  category: MBCC生日会
  title: 【MBCC生日会】丨「阿黛拉」生日快乐
  url: https://wqmt.aisnogames.com/#/news/1346
```

最近一次匹配结果：

- **成功匹配 152/156 名角色**
- 主要来源：禁闭者档案（79 名）+ MBCC生日会（70 名）+ 禁闭者影像捕获（3 名）
- **未匹配**：`奥古斯特`、`L.L.`、`希格林德`、`西涅克斯`（官网资讯中暂未出现独立图文）

详细对应关系见 `scripts/tmp/official-character-matches.json`。

### 2. 官方资讯动态

脚本 `scripts/fetch-official-news.mjs` 抓取官网非角色类资讯（公告、预告、活动、维护等），生成 `src/content/updates/{id}.md`：

```yaml
---
title: 【公告】丨「承霄」新增梦境现已更新
date: '2026-06-11'
type: '版本更新'
description: ''
source: 'https://wqmt.aisnogames.com/#/news/1971'
cover: '...'
tags: []
---

> 本文来自《无期迷途》官方网站，点击[阅读原文](https://wqmt.aisnogames.com/#/news/1971)查看详情。
```

仅保留标题、日期、类型与原文链接，正文不托管在仓库中，引导读者前往官网阅读。

## 本地使用

```sh
# 重新拉取并生成角色图片（会覆盖 public/characters/ 下已有文件）
node scripts/fetch-official-resources.mjs

# 仅同步角色 frontmatter 中的 image / imageSource，不下载图片
node scripts/fetch-official-resources.mjs --no-download

# 基于已有匹配报告，仅补全角色 Markdown 中的 imageSource 字段
node scripts/apply-image-sources.mjs

# 抓取最新官方资讯生成 updates
node scripts/fetch-official-news.mjs

# 重新从 BWiki 拉取并填充角色技能
node scripts/enrich-character-skills.mjs

# 构建站点
npm run build
```

## 角色技能数据来源

角色技能名称、效果、范围等游戏内数值信息整理自 **无期迷途 BWiki（`https://wiki.biligame.com/wqmt`）** 的公开 Wikitext 数据。

脚本 `scripts/enrich-character-skills.mjs` 的处理流程：

1. 通过 BWiki MediaWiki API 读取 `禁闭者:角色名` 页面源码。
2. 提取 `{{禁闭者图鉴}}` 模板中的特性、狂厄深化、梦魇天赋、普攻、必杀、被动等字段。
3. 将 `{{伤害文本}}`、`{{禁闭者数值}}`、`{{技能范围}}`、`{{术语查看}}` 等 Wiki 模板转换为 Markdown 可读文本。
4. 按统一格式重写角色 Markdown 的技能章节，保留原有 frontmatter 与通用使用建议。

> BWiki 内容由玩家社区维护，其原始数据亦来自游戏本身。本站仅做格式转换与精简，并在页面中保留社区贡献的参考价值。

## 合规建议

1. **版权归属**  
   所有图片、文字、角色设定的著作权均归自意网络。本站 Wiki 目前使用官网公开可访问的图片链接/文件，以及玩家社区整理的公开游戏数据，不等同于获得商业或二次传播授权。

2. **使用方式**  
   - 站点底部统一标注：角色图片素材来自《无期迷途》官方网站，版权归自意网络所有。
   - 角色详情页展示当前图片的具体来源分类与官网原文链接，便于追溯。
   - 官方资讯页仅展示标题与原文链接，正文引导回官网阅读。
   - 如官方后续要求下架，应立即移除相关图片或数据。
   - 在取得正式授权前，不建议将图片或数据用于周边售卖、广告投放或其他商业用途。

3. **文字内容**  
   角色攻略、使用建议为原创撰写；技能名称与效果等客观游戏数据参考 BWiki 进行格式整理，未做大规模原创改写。如需更严格地规避潜在争议，可进一步将效果描述用自己的语言概括，并标注 BWiki 来源。

4. **后续可替换为更高清/更合适的素材**  
   当前大多数角色使用的是生日贺图。当官网放出对应角色的“禁闭者档案”立绘后，可调整脚本优先级或手动替换为档案立绘。

5. **缺失角色处理**  
   `奥古斯特`、`L.L.`、`希格林德`、`西涅克斯` 在官网资讯中暂未找到独立图文，暂不显示官方图片。`EMP` 在 BWiki 中也未找到完整独立档案，技能章节保留通用占位。可继续观察官方与社区后续更新。
