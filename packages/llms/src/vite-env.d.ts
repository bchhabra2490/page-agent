interface ImportMetaEnv {
	readonly LLM_MODEL_NAME?: string
	readonly LLM_API_KEY?: string
	readonly LLM_BASE_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
