# 无期迷途 Wiki

无期迷途玩家攻略站点，基于 Astro 构建的静态 wiki。

## 技术栈

- **框架**: Astro 6.x
- **部署**: Cloudflare Pages
- **域名**: 5732.wiki

## 本地开发

```sh
npm install
npm run dev
```

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

## 部署

```sh
npm run build
```

将 `dist/` 目录部署到 Cloudflare Pages 并绑定域名。
