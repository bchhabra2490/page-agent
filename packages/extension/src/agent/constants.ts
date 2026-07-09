import type { LLMConfig } from '@page-agent/llms'
import { isLegacyTestingEndpoint, readBuildTimeLLMEnv } from '@page-agent/llms'

export { isLegacyTestingEndpoint }

export function getEnvDefaultConfig(): LLMConfig {
	const env = readBuildTimeLLMEnv()
	return {
		model: env.model ?? '',
		baseURL: env.baseURL ?? '',
		apiKey: env.apiKey,
	}
}

export function migrateLegacyEndpoint(config: LLMConfig): LLMConfig {
	if (isLegacyTestingEndpoint(config.baseURL)) {
		return { ...getEnvDefaultConfig(), apiKey: config.apiKey ?? getEnvDefaultConfig().apiKey }
	}
	return config
}
