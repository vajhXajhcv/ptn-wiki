import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const characters = defineCollection({
	loader: glob({ base: './src/content/characters', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		name: z.string(),
		title: z.string().optional(),
		rarity: z.enum(['S', 'A', 'B']).optional(),
		role: z.string().optional(),
		faction: z.string().optional(),
		danger: z.enum(['异能', '精准', '狂暴', '诡秘', '启迪', '坚韧']).optional(),
		description: z.string(),
		aliases: z.array(z.string()).optional(),
		image: z.string().optional(),
		imageSource: z
			.object({
				category: z.string(),
				title: z.string(),
				url: z.string().url(),
			})
			.optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const stages = defineCollection({
	loader: glob({ base: './src/content/stages', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		name: z.string(),
		chapter: z.string(),
		stageNumber: z.string(),
		recommendedLevel: z.number().optional(),
		difficulty: z.enum(['普通', '困难', '绝境']).optional(),
		description: z.string(),
		cost: z.number().optional(),
		sanity: z.number().optional(),
		moves: z.number().optional(),
		enemySummary: z
			.object({
				minions: z.number().optional(),
				elites: z.number().optional(),
			})
			.optional(),
		enemies: z
			.array(
				z.object({
					name: z.string(),
					count: z.number().optional(),
					elite: z.boolean().default(false),
				})
			)
			.optional(),
		objectives: z.array(z.string()).optional(),
		firstClearReward: z.string().optional(),
		sRankReward: z.string().optional(),
		stageReward: z.string().optional(),
		mechanics: z.array(z.string()).optional(),
		strategy: z.array(z.string()).optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const gameModes = defineCollection({
	loader: glob({ base: './src/content/game-modes', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		name: z.string(),
		type: z.enum([
				'暗域',
				'公会战',
				'数据间隙',
				'破碎防线',
				'狄斯暗影',
				'浊暗之阱',
				'帕尔马废墟',
				'记忆风暴',
				'新城特训',
				'监管与派遣',
				'无尽梦魇',
				'其他',
			]).optional(),
		description: z.string(),
		unlock: z.string().optional(),
		rewards: z.string().optional(),
		image: z.string().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const updates = defineCollection({
	loader: glob({ base: './src/content/updates', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		date: z.string(),
		type: z.enum(['版本更新', '活动', '维护公告', '站点公告', '其他']).default('其他'),
		description: z.string(),
		endDate: z.string().optional(),
		source: z.string().url().optional(),
		cover: z.string().url().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const stories = defineCollection({
	loader: glob({ base: './src/content/stories', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		type: z.enum(['主线', '活动', '支线', '角色审查', '其他']).default('其他'),
		chapter: z.string().optional(),
		section: z.string().optional(),
		description: z.string(),
		characters: z.array(z.string()).optional(),
		source: z.string().url().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = { characters, stages, gameModes, updates, stories };
