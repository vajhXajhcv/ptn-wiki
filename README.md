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

## 参与贡献

欢迎局长们一起完善 Wiki！你可以通过以下方式参与：

1. **提交 Pull Request**（推荐）
   - Fork 仓库：[https://github.com/vajhXajhcv/ptn-wiki](https://github.com/vajhXajhcv/ptn-wiki)
   - 修改 `src/content/characters/` 或 `src/content/stages/` 下的内容
   - 运行 `npm run build` 确保构建通过
   - 提交 PR 并简要说明改动依据

2. **提交 Issue**
   - 发现错别字、数值错误、失效链接？
   - 想新增角色、关卡或功能？
   - 直接到 [GitHub Issues](https://github.com/vajhXajhcv/ptn-wiki/issues) 反馈即可。

3. **加入讨论**
   - 如有关于 Wiki 规范、工具改进或内容方向的建议，欢迎在 Issues 中开启讨论。

详细贡献规范与社区倡议书见 [`docs/letters/to-community.md`](./docs/letters/to-community.md)。

## 官方沟通与授权

本站为非官方、非营利的玩家公益站点。若《无期迷途》官方团队对内容引用、素材使用有任何意见，或希望建立正式沟通渠道，可联系维护团队。

相关函件模板：

- [`docs/letters/to-official.md`](./docs/letters/to-official.md) — 致官方团队的沟通/授权申请函
- [`docs/letters/to-bwiki.md`](./docs/letters/to-bwiki.md) — 致 BWiki 维护团队的致谢与协作函

## 构建与部署

```sh
npm run build
npm run deploy
```

`npm run deploy` 会先执行 `astro build`，再通过 Wrangler 部署到 Cloudflare Pages。

## 开源说明

- 本站代码与原创攻略文本可开源。
- 角色图片素材来自官网，**不包含在本仓库中**，请运行上方脚本本地生成。
- 技能数据等客观游戏信息参考无期迷途 BWiki 进行格式转换。
- 更多合规细节见 [`docs/official-assets.md`](./docs/official-assets.md)。
