# 无期迷途 Wiki

无期迷途玩家攻略站点，基于 Astro 构建的静态 wiki。

线上地址：https://5732.wiki  
GitHub 仓库：https://github.com/vajhXajhcv/ptn-wiki

## 技术栈

- **框架**: Astro 6.x
- **部署**: Cloudflare Pages
- **域名**: 5732.wiki

## 本地开发

```sh
npm install
npm run dev
```

## 获取角色图片

角色立绘来自《无期迷途》官方网站公开接口。出于版权合规考虑，这些图片**不会提交到 GitHub**，需要本地生成：

```sh
node scripts/fetch-official-resources.mjs
```

脚本会：

1. 读取官网 `/api/news` 接口。
2. 按 `禁闭者档案 → 影像捕获 → 装束 → MBCC生日会 → 壁纸` 的优先级匹配角色。
3. 将图片压缩到 480px 宽后保存到 `public/characters/{slug}.jpg`。
4. 自动更新 `src/content/characters/*.md` 中的 `image` 字段。

> 这些图片版权归自意网络所有。本站仅作展示，若官方要求请立即下架。

## 添加角色

在 `src/content/characters/` 目录下新建 `.md` 文件：

```markdown
---
name: 角色名
title: 称号
rarity: S
danger: 狂暴
role: 物理输出
faction: 所属阵营
description: 角色简介
tags: ['狂暴', '输出']
image: /characters/role-name.jpg
---

## 技能介绍

正文内容...
```

## 添加关卡

在 `src/content/stages/` 目录下新建 `.md` 文件：

```markdown
---
name: 关卡名
chapter: 第1章
stageNumber: '1'
difficulty: 普通
recommendedLevel: 1
description: 关卡简介
---

## 通关思路

正文内容...
```

## 构建与部署

```sh
npm run build
npm run deploy
```

`npm run deploy` 会先执行 `astro build`，再通过 Wrangler 部署到 Cloudflare Pages。

## 开源说明

- 本站代码与原创攻略文本可开源。
- 角色图片素材来自官网，**不包含在本仓库中**，请运行上方脚本本地生成。
- 更多合规细节见 [`docs/official-assets.md`](./docs/official-assets.md)。
