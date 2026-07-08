import type { KnowledgeEntry } from '../types'

export interface KnowledgeStorageAdapter {
	readonly label: string
	load(): Promise<KnowledgeEntry[]>
	save(entries: KnowledgeEntry[]): Promise<void>
}

export const KNOWLEDGE_MESSAGE_CHANNEL = 'PAGE_AGENT_KNOWLEDGE'

export interface KnowledgeMessage {
	channel: typeof KNOWLEDGE_MESSAGE_CHANNEL
	id: string
	action: 'load' | 'save'
	payload?: KnowledgeEntry[]
}

export interface KnowledgeResponse {
	channel: typeof KNOWLEDGE_MESSAGE_CHANNEL
	id: string
	action: 'load_result' | 'save_result'
	payload?: KnowledgeEntry[]
	error?: string
}

export function isValidEntry(entry: unknown): entry is KnowledgeEntry {
	if (!entry || typeof entry !== 'object') return false
	const e = entry as KnowledgeEntry
	return (
		typeof e.id === 'string' &&
		typeof e.title === 'string' &&
		typeof e.content === 'string' &&
		typeof e.updatedAt === 'number' &&
		typeof e.category === 'string'
	)
}

export function parseEntries(raw: unknown): KnowledgeEntry[] {
	if (!Array.isArray(raw)) return []
	return raw.filter(isValidEntry)
}

export function mergeEntries(...lists: KnowledgeEntry[][]): KnowledgeEntry[] {
	const byId = new Map<string, KnowledgeEntry>()
	for (const list of lists) {
		for (const entry of list) {
			const existing = byId.get(entry.id)
			if (!existing || entry.updatedAt > existing.updatedAt) {
				byId.set(entry.id, entry)
			}
		}
	}
	return Array.from(byId.values())
}
