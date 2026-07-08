export type KnowledgeCategory =
	'profile' | 'experience' | 'education' | 'skills' | 'motivation' | 'other'

export interface KnowledgeEntry {
	id: string
	title: string
	category: KnowledgeCategory
	content: string
	tags: string[]
	updatedAt: number
}

export interface KnowledgeEntryInput {
	title: string
	category: KnowledgeCategory
	content: string
	tags?: string[]
}

export interface KnowledgeSearchHit {
	id: string
	title: string
	category: KnowledgeCategory
	excerpt: string
	score: number
}

export interface MemoryConfig {
	/** Storage key @default 'page-agent-knowledge-v1' */
	storageKey?: string
	/** Show the knowledge management panel @default true */
	showPanel?: boolean
	/**
	 * Share knowledge across all websites via extension storage or hub iframe.
	 * @default true
	 */
	global?: boolean
	/** Hub page URL for cross-site storage @default derived from script src or localhost:5174 */
	hubUrl?: string
}

export type MemoryOptions = boolean | MemoryConfig

export function resolveMemoryConfig(memory?: MemoryOptions): MemoryConfig | null {
	if (!memory) return null
	if (memory === true) return {}
	return memory
}
