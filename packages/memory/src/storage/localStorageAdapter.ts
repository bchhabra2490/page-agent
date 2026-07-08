import type { KnowledgeEntry } from '../types'
import type { KnowledgeStorageAdapter } from './types'
import { parseEntries } from './types'

export class LocalStorageAdapter implements KnowledgeStorageAdapter {
	readonly label = 'localStorage'
	readonly storageKey: string

	constructor(storageKey: string) {
		this.storageKey = storageKey
	}

	async load(): Promise<KnowledgeEntry[]> {
		if (typeof localStorage === 'undefined') return []
		try {
			const raw = localStorage.getItem(this.storageKey)
			if (!raw) return []
			return parseEntries(JSON.parse(raw))
		} catch {
			return []
		}
	}

	async save(entries: KnowledgeEntry[]): Promise<void> {
		if (typeof localStorage === 'undefined') return
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(entries))
		} catch (error) {
			console.error('[KnowledgeStore] localStorage save failed:', error)
			throw error
		}
	}
}
