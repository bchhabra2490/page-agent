import type { KnowledgeEntry } from '../types'
import type { KnowledgeStorageAdapter } from './types'
import { parseEntries } from './types'

const HUB_READY_TIMEOUT_MS = 2000
const HUB_REQUEST_TIMEOUT_MS = 3000

function uid(): string {
	return crypto.randomUUID()
}

type HubRequest =
	{ type: 'load'; key: string } | { type: 'save'; key: string; entries: KnowledgeEntry[] }

type HubResponse =
	| { type: 'ready' }
	| { type: 'load_result'; key: string; entries: KnowledgeEntry[] }
	| { type: 'save_result'; key: string; ok: boolean; error?: string }

/**
 * Cross-origin storage via a hidden iframe hub (same hub origin for every site).
 */
export class HubStorageAdapter implements KnowledgeStorageAdapter {
	readonly label = 'hub'
	readonly storageKey: string
	readonly hubUrl: string

	#iframe: HTMLIFrameElement | null = null
	#ready: Promise<void> | null = null

	constructor(storageKey: string, hubUrl: string) {
		this.storageKey = storageKey
		this.hubUrl = hubUrl
	}

	static async probe(storageKey: string, hubUrl: string): Promise<HubStorageAdapter | null> {
		const adapter = new HubStorageAdapter(storageKey, hubUrl)
		try {
			await adapter.#ensureReady()
			await adapter.load()
			return adapter
		} catch {
			adapter.dispose()
			return null
		}
	}

	async load(): Promise<KnowledgeEntry[]> {
		await this.#ensureReady()
		const response = await this.#send<HubResponse>({ type: 'load', key: this.storageKey })
		if (response.type !== 'load_result') throw new Error('Unexpected hub response')
		return parseEntries(response.entries)
	}

	async save(entries: KnowledgeEntry[]): Promise<void> {
		await this.#ensureReady()
		const response = await this.#send<HubResponse>({
			type: 'save',
			key: this.storageKey,
			entries,
		})
		if (response.type !== 'save_result' || !response.ok) {
			throw new Error(
				response.type === 'save_result'
					? response.error || 'Hub save failed'
					: 'Unexpected hub response'
			)
		}
	}

	dispose(): void {
		this.#iframe?.remove()
		this.#iframe = null
		this.#ready = null
	}

	async #ensureReady(): Promise<void> {
		if (typeof document === 'undefined') {
			throw new Error('Hub storage requires a DOM')
		}
		if (!this.#ready) {
			this.#ready = this.#mountIframe()
		}
		await this.#ready
	}

	#mountIframe(): Promise<void> {
		return new Promise((resolve, reject) => {
			const iframe = document.createElement('iframe')
			iframe.src = this.hubUrl
			iframe.title = 'Page Agent knowledge hub'
			iframe.setAttribute('aria-hidden', 'true')
			iframe.style.cssText =
				'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px'
			document.body.appendChild(iframe)
			this.#iframe = iframe

			const timeout = setTimeout(() => {
				cleanup()
				reject(new Error('Knowledge hub iframe timeout'))
			}, HUB_READY_TIMEOUT_MS)

			const onMessage = (event: MessageEvent) => {
				if (event.source !== iframe.contentWindow) return
				const data = event.data as HubResponse
				if (data?.type !== 'ready') return
				cleanup()
				resolve()
			}

			const cleanup = () => {
				clearTimeout(timeout)
				window.removeEventListener('message', onMessage)
			}

			window.addEventListener('message', onMessage)
			iframe.addEventListener('error', () => {
				cleanup()
				reject(new Error('Knowledge hub iframe failed to load'))
			})
		})
	}

	#send<T extends HubResponse>(request: HubRequest): Promise<T> {
		const iframe = this.#iframe
		if (!iframe?.contentWindow) {
			return Promise.reject(new Error('Knowledge hub not ready'))
		}

		return new Promise((resolve, reject) => {
			const requestId = uid()
			const timeout = setTimeout(() => {
				window.removeEventListener('message', onMessage)
				reject(new Error('Knowledge hub request timeout'))
			}, HUB_REQUEST_TIMEOUT_MS)

			const onMessage = (event: MessageEvent) => {
				if (event.source !== iframe.contentWindow) return
				const data = event.data as HubResponse & { requestId?: string }
				if (data?.requestId !== requestId) return

				clearTimeout(timeout)
				window.removeEventListener('message', onMessage)
				resolve(data as T)
			}

			window.addEventListener('message', onMessage)
			iframe.contentWindow!.postMessage({ ...request, requestId }, '*')
		})
	}
}

export function resolveHubUrl(explicit?: string): string {
	if (explicit) return explicit

	const script = document.querySelector('script[src*="page-agent"]') as HTMLScriptElement | null
	if (script?.src) {
		try {
			const url = new URL(script.src)
			return `${url.origin}${url.pathname.replace(/\/[^/]*$/, '/memory-hub.html')}`
		} catch {
			// fall through
		}
	}

	return 'http://localhost:5174/memory-hub.html'
}
