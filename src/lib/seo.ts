import { SITE_TITLE } from '../consts';

export type BreadcrumbItem = { label: string; href?: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[], site: URL | undefined) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.label,
			item: item.href ? new URL(item.href, site).toString() : undefined,
		})),
	};
}

export function articleJsonLd(options: {
	title: string;
	description: string;
	url: URL;
	site: URL | undefined;
	image?: string;
	datePublished?: string;
	dateModified?: string;
}) {
	const { title, description, url, site, image, datePublished, dateModified } = options;
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: title,
		description,
		url: url.toString(),
		image: image ? new URL(image, url).toString() : undefined,
		datePublished,
		dateModified,
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': url.toString(),
		},
		publisher: {
			'@type': 'Organization',
			name: SITE_TITLE,
			url: site?.toString(),
		},
	};
}
