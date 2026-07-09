/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * All rights reserved.
 */
import { type AgentConfig, PageAgentCore } from '@page-agent/core'
import {
	KnowledgePanel,
	KnowledgeStore,
	MEMORY_SYSTEM_INSTRUCTIONS,
	type MemoryOptions,
	createMemoryTools,
	resolveMemoryConfig,
} from '@page-agent/memory'
import { PageController, type PageControllerConfig } from '@page-agent/page-controller'
import {
	ActionRecorder,
	RECORDING_SYSTEM_INSTRUCTIONS,
	type RecordingOptions,
	RecordingStore,
	formatRecordingContext,
	resolveRecordingConfig,
} from '@page-agent/recording'
import { Panel, type PanelConfig } from '@page-agent/ui'

export * from '@page-agent/core'
export * from '@page-agent/memory'
export * from '@page-agent/recording'

export type PageAgentConfig = AgentConfig &
	PageControllerConfig &
	Omit<PanelConfig, 'language' | 'onRecordingToggle'> & {
		/**
		 * Enable user knowledge store with lookup/generate tools and management UI.
		 * @default false
		 */
		memory?: MemoryOptions
		/**
		 * Enable per-URL click workflow recording from the panel ⏺ button.
		 * @default false
		 */
		recording?: RecordingOptions
	}

export class PageAgent extends PageAgentCore {
	panel: Panel
	/** User knowledge store — present when `memory` is enabled */
	readonly knowledgeStore?: KnowledgeStore
	/** Knowledge management UI — present when `memory` is enabled */
	readonly knowledgePanel?: KnowledgePanel
	readonly recordingStore?: RecordingStore
	readonly actionRecorder?: ActionRecorder

	constructor(config: PageAgentConfig) {
		const { memory: memoryOption, recording: recordingOption, ...rest } = config
		const memoryConfig = resolveMemoryConfig(memoryOption)
		const recordingConfig = resolveRecordingConfig(recordingOption)

		let agentConfig: AgentConfig & PageControllerConfig = rest
		let knowledgeStore: KnowledgeStore | undefined
		let recordingStore: RecordingStore | undefined

		if (recordingConfig) {
			recordingStore = new RecordingStore(recordingConfig)
		}

		const systemParts: string[] = []
		if (recordingConfig) systemParts.push(RECORDING_SYSTEM_INSTRUCTIONS)

		if (memoryConfig) {
			knowledgeStore = new KnowledgeStore(memoryConfig)
			systemParts.push(MEMORY_SYSTEM_INSTRUCTIONS)
		}

		if (memoryConfig || recordingConfig) {
			const memoryTools = memoryConfig ? createMemoryTools(knowledgeStore!) : undefined
			const mergedSystem = [systemParts.join('\n\n'), rest.instructions?.system]
				.filter(Boolean)
				.join('\n\n')

			const userOnBeforeTask = rest.onBeforeTask
			const userGetPageInstructions = rest.instructions?.getPageInstructions

			agentConfig = {
				...rest,
				customTools: {
					...memoryTools,
					...rest.customTools,
				},
				instructions: {
					...rest.instructions,
					system: mergedSystem || undefined,
					getPageInstructions: (url) => {
						const parts: string[] = []
						const pageInstructions = userGetPageInstructions?.(url)
						if (pageInstructions?.trim()) parts.push(pageInstructions.trim())

						if (recordingStore) {
							const workflow = recordingStore.getForUrl(url)
							if (workflow) {
								const context = formatRecordingContext(workflow)
								if (context) parts.push(context)
							}
						}

						return parts.length > 0 ? parts.join('\n\n') : undefined
					},
				},
				onBeforeTask: async (agent) => {
					if (knowledgeStore) {
						await knowledgeStore.ready
						if (knowledgeStore.size() > 0) {
							agent.pushObservation(
								`User knowledge base has ${knowledgeStore.size()} saved entries. ` +
									'Use lookup_user_data for factual form fields and generate_answer for open-ended questions.'
							)
						} else {
							agent.pushObservation(
								'User knowledge base is empty. Ask the user to add info via the 📚 button on the task bar, or use ask_user for missing data.'
							)
						}
					}

					if (recordingStore) {
						const workflow = recordingStore.getForUrl(location.href)
						if (workflow && workflow.steps.length > 0) {
							agent.pushObservation(formatRecordingContext(workflow))
						}
					}

					await userOnBeforeTask?.(agent)
				},
			}
		}

		const pageController = new PageController({
			...agentConfig,
			enableMask: agentConfig.enableMask ?? true,
		})

		super({ ...agentConfig, pageController })

		this.knowledgeStore = knowledgeStore
		this.recordingStore = recordingStore

		let knowledgePanel: KnowledgePanel | undefined
		if (knowledgeStore && memoryConfig?.showPanel !== false) {
			knowledgePanel = new KnowledgePanel(knowledgeStore, {
				language: config.language,
			})
			knowledgePanel.mount()
		}
		this.knowledgePanel = knowledgePanel

		let actionRecorder: ActionRecorder | undefined
		if (recordingStore) {
			actionRecorder = new ActionRecorder({
				pageController: this.pageController,
				store: recordingStore,
				isBlockedTarget: (target) => Boolean(target.closest('[data-page-agent-not-interactive]')),
				onStep: (count) => {
					console.log(`[PageAgent Recording] ${count} step(s) captured`)
				},
			})
			this.actionRecorder = actionRecorder
		}

		this.panel = new Panel(this, {
			language: config.language,
			promptForNextTask: config.promptForNextTask,
			onKnowledgeClick: knowledgePanel ? () => knowledgePanel!.toggle() : undefined,
			onRecordingToggle: actionRecorder ? () => this.#toggleRecording() : undefined,
		})
	}

	override async execute(task: string) {
		await this.#stopRecordingIfActive()
		return super.execute(task)
	}

	#toggleRecording(): void {
		const recorder = this.actionRecorder
		if (!recorder) return

		if (this.status === 'running') {
			console.warn('[PageAgent Recording] Stop the running task before recording.')
			return
		}

		if (recorder.isRecording) {
			void recorder.stop().then((steps) => {
				this.panel.setRecordingActive(false)
				if (steps.length > 0) {
					console.log(`[PageAgent Recording] Saved ${steps.length} step(s) for ${location.href}`)
				}
			})
			return
		}

		this.panel.stopSpeechInput()
		recorder.start()
		this.panel.setRecordingActive(true)
	}

	async #stopRecordingIfActive(): Promise<void> {
		if (!this.actionRecorder?.isRecording) return
		await this.actionRecorder.stop()
		this.panel.setRecordingActive(false)
	}

	override dispose(): void {
		this.actionRecorder?.dispose()
		this.knowledgePanel?.dispose()
		super.dispose()
	}
}
