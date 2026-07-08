import { createKnowledgeStorage } from './storage'
import { LocalStorageAdapter } from './storage/localStorageAdapter'
import { type KnowledgeStorageAdapter, mergeEntries } from './storage/types'
import type {
	KnowledgeCategory,
	KnowledgeEntry,
	KnowledgeEntryInput,
	KnowledgeSearchHit,
	MemoryConfig,
} from './types'

const DEFAULT_STORAGE_KEY = 'page-agent-knowledge-v1'

function uid(): string {
	return crypto.randomUUID()
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[\s,./\-_]+/)
		.filter((t) => t.length > 1)
}

function scoreEntry(entry: KnowledgeEntry, queryTokens: string[]): number {
	if (queryTokens.length === 0) return 0

	const title = entry.title.toLowerCase()
	const content = entry.content.toLowerCase()
	const tags = entry.tags.map((t) => t.toLowerCase())
	const category = entry.category.toLowerCase()

	let score = 0
	for (const token of queryTokens) {
		if (title.includes(token)) score += 4
		if (tags.some((t) => t.includes(token))) score += 3
		if (category.includes(token)) score += 2
		if (content.includes(token)) score += 1
	}
	return score
}

function normalizeTags(tags?: string[]): string[] {
	if (!tags) return []
	return tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
}

export type KnowledgeStoreOptions = MemoryConfig | string

function resolveOptions(options?: KnowledgeStoreOptions): MemoryConfig {
	if (typeof options === 'string') return { storageKey: options, global: true }
	return { global: true, ...options }
}

/**
 * Persistent user knowledge store for form filling and answer generation.
 * Uses global storage (extension or hub iframe) by default, with per-site localStorage fallback.
 */
export class KnowledgeStore {
	readonly storageKey: string
	readonly ready: Promise<void>
	readonly storageLabel: Promise<string>

	#entries: KnowledgeEntry[] = []
	#listeners = new Set<() => void>()
	#adapter: KnowledgeStorageAdapter | null = null
	#localBackup: LocalStorageAdapter

	constructor(options?: KnowledgeStoreOptions) {
		const config = resolveOptions(options)
		this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY
		this.#localBackup = new LocalStorageAdapter(this.storageKey)

		this.ready = this.#init(config)
		this.storageLabel = this.ready.then(() => this.#adapter?.label ?? 'localStorage')
	}

	getAll(): KnowledgeEntry[] {
		return [...this.#entries].sort((a, b) => b.updatedAt - a.updatedAt)
	}

	size(): number {
		return this.#entries.length
	}

	get(id: string): KnowledgeEntry | undefined {
		return this.#entries.find((e) => e.id === id)
	}

	async add(input: KnowledgeEntryInput): Promise<KnowledgeEntry> {
		await this.ready
		const entry: KnowledgeEntry = {
			id: uid(),
			title: input.title.trim(),
			category: input.category,
			content: input.content.trim(),
			tags: normalizeTags(input.tags),
			updatedAt: Date.now(),
		}
		this.#entries.push(entry)
		await this.#persist()
		return entry
	}

	async update(id: string, input: Partial<KnowledgeEntryInput>): Promise<KnowledgeEntry | null> {
		await this.ready
		const index = this.#entries.findIndex((e) => e.id === id)
		if (index === -1) return null

		const current = this.#entries[index]
		const updated: KnowledgeEntry = {
			...current,
			title: input.title !== undefined ? input.title.trim() : current.title,
			category: input.category ?? current.category,
			content: input.content !== undefined ? input.content.trim() : current.content,
			tags: input.tags !== undefined ? normalizeTags(input.tags) : current.tags,
			updatedAt: Date.now(),
		}
		this.#entries[index] = updated
		await this.#persist()
		return updated
	}

	async delete(id: string): Promise<boolean> {
		await this.ready
		const before = this.#entries.length
		this.#entries = this.#entries.filter((e) => e.id !== id)
		if (this.#entries.length === before) return false
		await this.#persist()
		return true
	}

	search(query: string, limit = 5): KnowledgeSearchHit[] {
		const queryTokens = tokenize(query)
		if (queryTokens.length === 0) return []

		return this.#entries
			.map((entry) => ({
				id: entry.id,
				title: entry.title,
				category: entry.category,
				excerpt: entry.content.slice(0, 600),
				score: scoreEntry(entry, queryTokens),
			}))
			.filter((hit) => hit.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
	}

	getContextForQuestion(question: string, limit = 8): KnowledgeEntry[] {
		const hits = this.search(question, limit)
		if (hits.length > 0) {
			return hits.map((h) => this.get(h.id)).filter((e): e is KnowledgeEntry => e !== undefined)
		}
		return this.getAll().slice(0, limit)
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener)
		return () => this.#listeners.delete(listener)
	}

	async #init(config: MemoryConfig): Promise<void> {
		try {
			this.#adapter = await createKnowledgeStorage(config)
			const [globalEntries, localEntries] = await Promise.all([
				this.#adapter.load(),
				this.#localBackup.load(),
			])
			this.#entries = mergeEntries(globalEntries, localEntries)
			if (this.#entries.length > 0 && this.#adapter.label !== 'localStorage') {
				await this.#adapter.save(this.#entries)
			}
			await this.#localBackup.save(this.#entries)
			this.#notify()
		} catch (error) {
			console.error('[KnowledgeStore] Init failed, using in-memory fallback:', error)
			this.#adapter = this.#localBackup
			this.#entries = await this.#localBackup.load()
			this.#notify()
		}
	}

	async #persist(): Promise<void> {
		if (!this.#adapter) return
		try {
			await this.#adapter.save(this.#entries)
			await this.#localBackup.save(this.#entries)
		} catch (error) {
			console.error('[KnowledgeStore] Failed to persist:', error)
			throw error
		}
		this.#notify()
	}

	#notify(): void {
		this.#listeners.forEach((l) => l())
	}
}

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
	'profile',
	'experience',
	'education',
	'skills',
	'motivation',
	'other',
]
