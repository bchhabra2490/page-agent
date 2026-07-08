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
import { Panel, type PanelConfig } from '@page-agent/ui'

export * from '@page-agent/core'
export * from '@page-agent/memory'

export type PageAgentConfig = AgentConfig &
	PageControllerConfig &
	Omit<PanelConfig, 'language'> & {
		/**
		 * Enable user knowledge store with lookup/generate tools and management UI.
		 * @default false
		 */
		memory?: MemoryOptions
	}

export class PageAgent extends PageAgentCore {
	panel: Panel
	/** User knowledge store — present when `memory` is enabled */
	readonly knowledgeStore?: KnowledgeStore
	/** Knowledge management UI — present when `memory` is enabled */
	readonly knowledgePanel?: KnowledgePanel

	constructor(config: PageAgentConfig) {
		const { memory: memoryOption, ...rest } = config
		const memoryConfig = resolveMemoryConfig(memoryOption)

		let agentConfig: AgentConfig & PageControllerConfig = rest
		let knowledgeStore: KnowledgeStore | undefined

		if (memoryConfig) {
			knowledgeStore = new KnowledgeStore(memoryConfig)
			const memoryTools = createMemoryTools(knowledgeStore)

			const mergedSystem = [MEMORY_SYSTEM_INSTRUCTIONS, rest.instructions?.system]
				.filter(Boolean)
				.join('\n\n')

			const userOnBeforeTask = rest.onBeforeTask

			agentConfig = {
				...rest,
				customTools: {
					...memoryTools,
					...rest.customTools,
				},
				instructions: {
					...rest.instructions,
					system: mergedSystem,
				},
				onBeforeTask: async (agent) => {
					await knowledgeStore!.ready
					if (knowledgeStore!.size() > 0) {
						agent.pushObservation(
							`User knowledge base has ${knowledgeStore!.size()} saved entries. ` +
								'Use lookup_user_data for factual form fields and generate_answer for open-ended questions.'
						)
					} else {
						agent.pushObservation(
							'User knowledge base is empty. Ask the user to add info via the 📚 button on the task bar, or use ask_user for missing data.'
						)
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

		let knowledgePanel: KnowledgePanel | undefined
		if (knowledgeStore && memoryConfig?.showPanel !== false) {
			knowledgePanel = new KnowledgePanel(knowledgeStore, {
				language: config.language,
			})
			knowledgePanel.mount()
		}
		this.knowledgePanel = knowledgePanel

		this.panel = new Panel(this, {
			language: config.language,
			promptForNextTask: config.promptForNextTask,
			onKnowledgeClick: knowledgePanel ? () => knowledgePanel!.toggle() : undefined,
		})
	}

	override dispose(): void {
		this.knowledgePanel?.dispose()
		super.dispose()
	}
}
