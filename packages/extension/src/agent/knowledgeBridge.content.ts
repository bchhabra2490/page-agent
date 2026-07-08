const KNOWLEDGE_MESSAGE_CHANNEL = 'PAGE_AGENT_KNOWLEDGE'
const DEFAULT_KNOWLEDGE_KEY = 'page-agent-knowledge-v1'
const STORAGE_KEY = `page-agent-knowledge-hub:${DEFAULT_KNOWLEDGE_KEY}`

interface KnowledgeMessage {
	channel: typeof KNOWLEDGE_MESSAGE_CHANNEL
	id: string
	action: 'load' | 'save'
	payload?: unknown[]
}

interface KnowledgeResponse {
	channel: typeof KNOWLEDGE_MESSAGE_CHANNEL
	id: string
	action: 'load_result' | 'save_result'
	payload?: unknown[]
	error?: string
}

function parseEntries(raw: unknown): unknown[] {
	if (!Array.isArray(raw)) return []
	return raw.filter(
		(entry) =>
			entry &&
			typeof entry === 'object' &&
			typeof (entry as { id?: string }).id === 'string' &&
			typeof (entry as { title?: string }).title === 'string'
	)
}

/**
 * Bridge page-agent knowledge requests to chrome.storage.local (global across sites).
 */
export function initKnowledgeBridge(): void {
	window.addEventListener('message', (event) => {
		if (event.source !== window) return

		const data = event.data as KnowledgeMessage
		if (data?.channel !== KNOWLEDGE_MESSAGE_CHANNEL) return

		const { id, action, payload } = data

		const respond = (response: Omit<KnowledgeResponse, 'channel' | 'id'>) => {
			window.postMessage({ channel: KNOWLEDGE_MESSAGE_CHANNEL, id, ...response }, '*')
		}

		if (action === 'load') {
			chrome.storage.local
				.get(STORAGE_KEY)
				.then((result) => {
					respond({
						action: 'load_result',
						payload: parseEntries(result[STORAGE_KEY]),
					})
				})
				.catch((error: Error) => {
					respond({ action: 'load_result', error: error.message })
				})
			return
		}

		if (action === 'save') {
			chrome.storage.local
				.set({ [STORAGE_KEY]: payload ?? [] })
				.then(() => {
					respond({ action: 'save_result' })
				})
				.catch((error: Error) => {
					respond({ action: 'save_result', error: error.message })
				})
		}
	})
}
