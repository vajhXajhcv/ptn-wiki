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
		image: z.string().optional(),
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
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = { characters, stages };
