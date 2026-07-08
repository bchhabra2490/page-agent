import type { KnowledgeEntry } from '../types'
import {
	KNOWLEDGE_MESSAGE_CHANNEL,
	type KnowledgeMessage,
	type KnowledgeResponse,
	type KnowledgeStorageAdapter,
	parseEntries,
} from './types'

const PROBE_TIMEOUT_MS = 250

function uid(): string {
	return crypto.randomUUID()
}

/**
 * Uses chrome.storage.local via the Page Agent extension content script.
 * Works across all websites when the extension is installed.
 */
export class ExtensionStorageAdapter implements KnowledgeStorageAdapter {
	readonly label = 'extension'
	readonly storageKey: string

	constructor(storageKey: string) {
		this.storageKey = storageKey
	}

	static async probe(storageKey: string): Promise<ExtensionStorageAdapter | null> {
		const adapter = new ExtensionStorageAdapter(storageKey)
		try {
			await adapter.load()
			return adapter
		} catch {
			return null
		}
	}

	async load(): Promise<KnowledgeEntry[]> {
		const response = await this.#request('load')
		return parseEntries(response.payload)
	}

	async save(entries: KnowledgeEntry[]): Promise<void> {
		await this.#request('save', entries)
	}

	#request(action: 'load' | 'save', payload?: KnowledgeEntry[]): Promise<KnowledgeResponse> {
		return new Promise((resolve, reject) => {
			const id = uid()
			const timeout = setTimeout(() => {
				window.removeEventListener('message', onMessage)
				reject(new Error('Extension knowledge bridge timeout'))
			}, PROBE_TIMEOUT_MS)

			const onMessage = (event: MessageEvent) => {
				if (event.source !== window) return
				const data = event.data as KnowledgeResponse
				if (data?.channel !== KNOWLEDGE_MESSAGE_CHANNEL || data.id !== id) return

				clearTimeout(timeout)
				window.removeEventListener('message', onMessage)

				if (data.error) reject(new Error(data.error))
				else resolve(data)
			}

			window.addEventListener('message', onMessage)
			const message: KnowledgeMessage = {
				channel: KNOWLEDGE_MESSAGE_CHANNEL,
				id,
				action,
				payload,
			}
			window.postMessage(message, '*')
		})
	}
}
