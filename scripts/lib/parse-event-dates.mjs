// 从公告正文解析「开始 ~ 结束」活动时间区间（供 updates 的 startDate / endDate 使用）。
// 只接受明确的区间写法（08月13日 05:00 ~ 09月10日 04:59、8.13~9.10 等）；
// 单日期、图片公告、模糊表述一律不猜，宁可缺省也不写错。

// 中文格式：08月13日 05:00 ~ 09月10日 04:59（年份、时刻可省略，分隔符支持 ~ ～ — – - 至）
const CN_RANGE =
	/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?(?:\s*\d{1,2}[:：]\d{2})?\s*[~～—–\-至]\s*(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?/;
// 点分格式：2026.08.13 ~ 09.10（同样要求两端都是 月.日）
const DOT_RANGE =
	/(?:(\d{4})\s*\.\s*)?(\d{1,2})\.(\d{1,2})(?:\s*\d{1,2}[:：]\d{2})?\s*[~～—–\-至]\s*(?:(\d{4})\s*\.\s*)?(\d{1,2})\.(\d{1,2})/;

const DAY_MS = 86400000;

function pad(n) {
	return String(n).padStart(2, '0');
}

/**
 * @param {string} text 公告正文纯文本
 * @param {string|Date} publishDate 公告发布时间（用于推断省略的年份）
 * @returns {{ start: string, end: string } | null} YYYY-MM-DD 区间，无法确定时返回 null
 */
export function parseEventRange(text, publishDate) {
	if (!text) return null;
	const pub = publishDate ? new Date(publishDate) : new Date();

	const m = text.match(CN_RANGE) || text.match(DOT_RANGE);
	if (!m) return null;

	const y1 = m[1] ? Number(m[1]) : null;
	const mo1 = Number(m[2]);
	const d1 = Number(m[3]);
	const y2 = m[4] ? Number(m[4]) : null;
	const mo2 = Number(m[5]);
	const d2 = Number(m[6]);

	if (mo1 < 1 || mo1 > 12 || mo2 < 1 || mo2 > 12) return null;
	if (d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) return null;

	const startYear = y1 ?? pub.getFullYear();
	// 结束月份小于开始月份时视为跨年（如 12月25日 ~ 01月08日）
	const endYear = y2 ?? (mo2 < mo1 || (mo2 === mo1 && d2 < d1) ? startYear + 1 : startYear);

	const startMs = Date.UTC(startYear, mo1 - 1, d1);
	const endMs = Date.UTC(endYear, mo2 - 1, d2);
	const days = (endMs - startMs) / DAY_MS;

	//  sanity：活动区间 0–120 天，且开始时间与发布时间相差不超过一年，否则视为误匹配
	if (days < 0 || days > 120) return null;
	if (Math.abs(startMs - pub.getTime()) > 366 * DAY_MS) return null;

	return {
		start: `${startYear}-${pad(mo1)}-${pad(d1)}`,
		end: `${endYear}-${pad(mo2)}-${pad(d2)}`,
	};
}
