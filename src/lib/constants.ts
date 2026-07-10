// 项目级常量：枚举、排序、外部 API 地址与数据映射表。
// 注意：脚本如需读取此文件，请使用 ESM import，并确保运行路径兼容 Windows/CI。

export const RARITIES = ['S', 'A', 'B'] as const;
export const RARITY_ORDER: Record<string, number> = { S: 0, A: 1, B: 2 };

export const DANGER_TYPES = ['坚韧', '狂暴', '诡秘', '精准', '异能', '启迪'] as const;

export const GAME_MODE_TYPES = [
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
] as const;

export const UPDATE_TYPES = ['版本更新', '活动', '维护公告', '站点公告', '其他'] as const;

export const STORY_TYPES = ['主线', '活动', '支线', '角色审查', '其他'] as const;

export const OFFICIAL_API_BASE = 'https://wqmt.aisnogames.com/api';
export const OFFICIAL_SITE_BASE = 'https://wqmt.aisnogames.com';
export const BWIKI_BASE = 'https://wiki.biligame.com/wqmt';

// 官方资源抓取映射
export const OFFICIAL_CATEGORY_PRIORITY = [
	'禁闭者档案',
	'禁闭者影像捕获',
	'禁闭者装束',
	'MBCC生日会',
	'壁纸',
	'影像壁纸',
	'无期记事',
];

export const OFFICIAL_NICKNAME_MAP: Record<string, string> = {
	EMP: '艾米潘',
	'K.K.': '蔻蔻',
	KK: '蔻蔻',
};

// BWiki 抓取映射
export const BWIKI_RARITY_MAP: Record<string, 'S' | 'A' | 'B'> = { 狂: 'S', 危: 'A', 普: 'B' };
export const BWIKI_DANGER_SET = new Set(DANGER_TYPES);

// 特殊 slug 覆盖表：别名、数字名、多音字等
export const CHARACTER_SLUG_MAP: Record<string, string> = {
	'000': 'ling',
	安: 'an',
	'K.K.': 'kk',
	'露薇娅·蕾': 'luweiyalei',
	EMP: 'emp',
};
