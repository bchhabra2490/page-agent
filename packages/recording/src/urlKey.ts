/** Stable key for matching recordings to pages (origin + pathname). */
export function urlKeyForPage(url: string = location.href): string {
	try {
		const parsed = new URL(url)
		return `${parsed.origin}${parsed.pathname}`
	} catch {
		return url
	}
}
