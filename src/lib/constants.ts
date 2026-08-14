// 项目级常量：枚举、排序、外部 API 地址与数据映射表。
// 注意：脚本如需读取此文件，请使用 ESM import，并确保运行路径兼容 Windows/CI。

export const RARITIES = ['S', 'A', 'B'] as const;
export const RARITY_ORDER: Record<string, number> = { S: 0, A: 1, B: 2 };

export const DANGER_TYPES = ['坚韧', '狂暴', '诡秘', '精准', '异能', '启迪'] as const;

// 官方阵营列表（依 BWiki 禁闭者档案模板注释的顺序）
export const FACTIONS = [
	'破坏',
	'执迷',
	'无厌',
	'背离',
	'混沌',
	'愤怒',
	'异质',
	'怠惰',
	'谵妄',
	'不朽',
	'暗潮',
	'荒竭',
	'戾刃',
	'靡音',
	'禁域',
	'无界',
] as const;

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

// 常用配队（按机制关键词聚合角色，成员由 /teams 页面从角色技能文本自动匹配）
export const TEAMS = [
	{
		slug: 'pozhan',
		name: '破绽队',
		keyword: '破绽',
		description: '围绕【破绽】标记构建的物理输出体系：由辅助位为敌人附加破绽，核心输出（如毕安卡）触发或移除破绽获得额外伤害与增益。',
	},
	{
		slug: 'canfeng',
		name: '残锋队',
		keyword: '残锋',
		description: '围绕【残锋】层数构建的真实伤害体系：奥古斯特持续积攒残锋并消耗释放涅槃港轰炸，队友配合供给残锋或增益真实伤害。',
	},
	{
		slug: 'fengshi',
		name: '风蚀队',
		keyword: '风蚀',
		description: '围绕【风蚀】标记与风蚀伤害构建的物理体系：攻击附带风蚀标记，对携带标记的敌人造成更高伤害。',
	},
	{
		slug: 'gandian',
		name: '感电队',
		keyword: '感电',
		description: '围绕【感电】标记构建的异能体系：通过高频技能触发感电连锁，造成持续的法术伤害与群体压制。',
	},
	{
		slug: 'ranshao',
		name: '燃烧队',
		keyword: '燃烧',
		description: '围绕【燃烧】持续伤害构建的体系：多名角色叠加燃烧层数，依靠持续伤害磨血并触发与燃烧联动的增伤效果。',
	},
] as const;

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
