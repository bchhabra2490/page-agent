export interface RecordedStep {
	action: 'click'
	index: number
	label: string
	recordedAt: number
}

export interface RecordedWorkflow {
	id: string
	urlKey: string
	url: string
	title: string
	steps: RecordedStep[]
	updatedAt: number
}

export interface RecordingConfig {
	/** localStorage key @default 'page-agent-recordings-v1' */
	storageKey?: string
}

export type RecordingOptions = boolean | RecordingConfig

export function resolveRecordingConfig(recording?: RecordingOptions): RecordingConfig | null {
	if (!recording) return null
	if (recording === true) return {}
	return recording
}
