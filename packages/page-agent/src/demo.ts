/**
 * IIFE demo entry - auto-initializes with LLM config from .env (baked in at build time)
 */
import { resolveLLMConfig } from '@page-agent/llms'

import { PageAgent, type PageAgentConfig } from './PageAgent'

const currentScript = document.currentScript as HTMLScriptElement | null
const currentScriptURL = currentScript?.src ? new URL(currentScript.src) : null
const autoInit = currentScriptURL?.searchParams.get('autoInit') !== 'false'

// Clean up existing instances to prevent multiple injections from bookmarklet
if (autoInit && window.pageAgent) {
	window.pageAgent.dispose()
}

// Mount to global window object
window.PageAgent = PageAgent

console.log('🚀 page-agent.js loaded!')

// in case document.x is not ready yet
if (autoInit) {
	setTimeout(() => {
		try {
			const llm = resolveLLMConfig({ urlSearchParams: currentScriptURL?.searchParams })
			const language = (currentScriptURL?.searchParams.get('lang') as 'zh-CN' | 'en-US') || 'zh-CN'
			const showPanel =
				((currentScriptURL?.searchParams.get('showPanel') as 'true' | 'false') || 'true') === 'true'
			const config: PageAgentConfig = { ...llm, language, memory: true, recording: true }

			window.pageAgent = new PageAgent(config)
			if (showPanel) {
				window.pageAgent.panel.show()
			}

			console.log('🚀 page-agent.js initialized with config:', {
				model: window.pageAgent.config.model,
				baseURL: window.pageAgent.config.baseURL,
			})
		} catch (error) {
			console.error('[PageAgent] Failed to initialize:', error)
		}
	})
}
