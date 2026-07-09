import type { PageController } from '@page-agent/page-controller'

import { RecordingStore } from './RecordingStore'
import type { RecordedStep } from './types'

export interface ActionRecorderOptions {
	pageController: PageController
	store: RecordingStore
	/** Ignore clicks inside these roots (e.g. the agent panel). */
	isBlockedTarget?: (target: Element) => boolean
	onStep?: (stepCount: number) => void
}

export class ActionRecorder {
	readonly #pageController: PageController
	readonly #store: RecordingStore
	readonly #isBlockedTarget: (target: Element) => boolean
	readonly #onStep?: (stepCount: number) => void

	#recording = false
	#steps: RecordedStep[] = []
	#clickListener: ((event: MouseEvent) => void) | null = null

	constructor(options: ActionRecorderOptions) {
		this.#pageController = options.pageController
		this.#store = options.store
		this.#isBlockedTarget = options.isBlockedTarget ?? (() => false)
		this.#onStep = options.onStep
	}

	get isRecording(): boolean {
		return this.#recording
	}

	get stepCount(): number {
		return this.#steps.length
	}

	start(): void {
		if (this.#recording) return
		this.#recording = true
		this.#steps = []
		this.#clickListener = (event) => {
			void this.#handleClick(event)
		}
		document.addEventListener('click', this.#clickListener, true)
	}

	async stop(): Promise<RecordedStep[]> {
		if (!this.#recording) return [...this.#steps]

		this.#recording = false
		if (this.#clickListener) {
			document.removeEventListener('click', this.#clickListener, true)
			this.#clickListener = null
		}

		const steps = [...this.#steps]
		if (steps.length > 0) {
			this.#store.saveSteps(location.href, steps)
		}
		return steps
	}

	dispose(): void {
		if (this.#clickListener) {
			document.removeEventListener('click', this.#clickListener, true)
			this.#clickListener = null
		}
		this.#recording = false
	}

	async #handleClick(event: MouseEvent): Promise<void> {
		if (!this.#recording) return

		const target = event.target
		if (!(target instanceof Element)) return
		if (this.#isBlockedTarget(target)) return

		try {
			await this.#pageController.updateTree()
			const resolved = this.#pageController.resolveElementIndex(target)
			if (!resolved) return

			this.#steps.push({
				action: 'click',
				index: resolved.index,
				label: resolved.label,
				recordedAt: Date.now(),
			})
			this.#onStep?.(this.#steps.length)
		} catch (error) {
			console.warn('[PageAgent Recording] Failed to record click:', error)
		}
	}
}
