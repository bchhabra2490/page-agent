import type { RecordedStep, RecordedWorkflow, RecordingConfig } from './types'
import { urlKeyForPage } from './urlKey'

const DEFAULT_STORAGE_KEY = 'page-agent-recordings-v1'

function uid(): string {
	return crypto.randomUUID()
}

export class RecordingStore {
	readonly storageKey: string

	constructor(config: RecordingConfig = {}) {
		this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY
	}

	getForUrl(url: string = location.href): RecordedWorkflow | null {
		const key = urlKeyForPage(url)
		const workflows = this.#loadAll()
		const matches = workflows
			.filter((w) => w.urlKey === key)
			.sort((a, b) => b.updatedAt - a.updatedAt)
		return matches[0] ?? null
	}

	saveSteps(url: string, steps: RecordedStep[], title = document.title): RecordedWorkflow {
		const urlKey = urlKeyForPage(url)
		const workflows = this.#loadAll().filter((w) => w.urlKey !== urlKey)
		const workflow: RecordedWorkflow = {
			id: uid(),
			urlKey,
			url,
			title,
			steps,
			updatedAt: Date.now(),
		}
		workflows.push(workflow)
		this.#saveAll(workflows)
		return workflow
	}

	clearForUrl(url: string = location.href): void {
		const key = urlKeyForPage(url)
		const workflows = this.#loadAll().filter((w) => w.urlKey !== key)
		this.#saveAll(workflows)
	}

	#loadAll(): RecordedWorkflow[] {
		try {
			const raw = localStorage.getItem(this.storageKey)
			if (!raw) return []
			const parsed = JSON.parse(raw) as RecordedWorkflow[]
			return Array.isArray(parsed) ? parsed : []
		} catch {
			return []
		}
	}

	#saveAll(workflows: RecordedWorkflow[]): void {
		localStorage.setItem(this.storageKey, JSON.stringify(workflows))
	}
}
