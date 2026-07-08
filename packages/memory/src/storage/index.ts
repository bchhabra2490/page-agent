import type { MemoryConfig } from '../types'
import { ExtensionStorageAdapter } from './extensionAdapter'
import { HubStorageAdapter, resolveHubUrl } from './hubAdapter'
import { LocalStorageAdapter } from './localStorageAdapter'
import type { KnowledgeStorageAdapter } from './types'

const DEFAULT_STORAGE_KEY = 'page-agent-knowledge-v1'

export async function createKnowledgeStorage(
	config: Pick<MemoryConfig, 'storageKey' | 'global' | 'hubUrl'> = {}
): Promise<KnowledgeStorageAdapter> {
	const storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY
	const useGlobal = config.global !== false

	if (!useGlobal) {
		return new LocalStorageAdapter(storageKey)
	}

	const extension = await ExtensionStorageAdapter.probe(storageKey)
	if (extension) {
		console.debug('[KnowledgeStore] Using extension storage (global)')
		return extension
	}

	const hubUrl = resolveHubUrl(config.hubUrl)
	const hub = await HubStorageAdapter.probe(storageKey, hubUrl)
	if (hub) {
		console.debug('[KnowledgeStore] Using hub storage (global)', hubUrl)
		return hub
	}

	console.warn(
		'[KnowledgeStore] Global storage unavailable; falling back to per-site localStorage. ' +
			'Install the Page Agent extension or run `npm run dev:demo` for cross-site memory.'
	)
	return new LocalStorageAdapter(storageKey)
}

export { LocalStorageAdapter, ExtensionStorageAdapter, HubStorageAdapter, resolveHubUrl }
