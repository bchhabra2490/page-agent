import type { LLMConfig } from './types'

const MISSING_CONFIG_MESSAGE =
	'LLM configuration required. Set LLM_MODEL_NAME, LLM_BASE_URL, and LLM_API_KEY in the repo root .env file, then restart the dev server.'

const LEGACY_TESTING_ENDPOINTS = [
	'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
	'https://hwcxiuzfylggtcktqgij.supabase.co/functions/v1/llm-testing-proxy',
]

export function isLegacyTestingEndpoint(baseURL: string): boolean {
	const normalized = baseURL.replace(/\/+$/, '')
	return LEGACY_TESTING_ENDPOINTS.some((endpoint) => normalized === endpoint.replace(/\/+$/, ''))
}

function normalizeParam(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim()
	if (!trimmed) return undefined
	return trimmed
}

/** Read LLM settings injected at build time via Vite `define`. */
export function readBuildTimeLLMEnv(): Partial<LLMConfig> {
	const env = import.meta.env
	const config: Partial<LLMConfig> = {}

	if (env.LLM_MODEL_NAME) {
		config.model = env.LLM_MODEL_NAME
	}
	if (env.LLM_BASE_URL) {
		config.baseURL = env.LLM_BASE_URL
	}
	if (env.LLM_API_KEY) {
		config.apiKey = env.LLM_API_KEY
	}

	return config
}

export function resolveLLMConfig(options?: {
	urlSearchParams?: URLSearchParams | null
}): Required<Pick<LLMConfig, 'model' | 'baseURL'>> & Pick<LLMConfig, 'apiKey'> {
	const builtIn = readBuildTimeLLMEnv()
	const params = options?.urlSearchParams

	const paramModel = normalizeParam(params?.get('model') ?? undefined)
	const paramBaseURL = normalizeParam(params?.get('baseURL') ?? undefined)
	const paramApiKey = normalizeParam(params?.get('apiKey') ?? undefined)

	if (paramBaseURL && isLegacyTestingEndpoint(paramBaseURL)) {
		console.warn(
			'[PageAgent] Ignoring legacy demo testing baseURL from script URL params. Using .env instead.'
		)
	}

	const model = paramModel || builtIn.model
	const baseURL =
		(paramBaseURL && !isLegacyTestingEndpoint(paramBaseURL) ? paramBaseURL : undefined) ||
		builtIn.baseURL
	const apiKey = paramApiKey ?? builtIn.apiKey ?? ''

	if (!model?.trim() || !baseURL?.trim()) {
		throw new Error(MISSING_CONFIG_MESSAGE)
	}

	if (isLegacyTestingEndpoint(baseURL.trim())) {
		throw new Error(`${MISSING_CONFIG_MESSAGE} The legacy demo testing API is no longer supported.`)
	}

	return {
		model: model.trim(),
		baseURL: baseURL.trim(),
		apiKey,
	}
}

export function llmConfigMatches(
	existing: Pick<LLMConfig, 'model' | 'baseURL' | 'apiKey'> | undefined,
	next: Pick<LLMConfig, 'model' | 'baseURL' | 'apiKey'>
): boolean {
	if (!existing) return false
	return (
		existing.model === next.model &&
		existing.baseURL === next.baseURL &&
		(existing.apiKey ?? '') === (next.apiKey ?? '')
	)
}

export function tryResolveLLMConfig(options?: {
	urlSearchParams?: URLSearchParams | null
}): (Required<Pick<LLMConfig, 'model' | 'baseURL'>> & Pick<LLMConfig, 'apiKey'>) | null {
	try {
		return resolveLLMConfig(options)
	} catch {
		return null
	}
}
