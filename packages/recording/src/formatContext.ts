import type { RecordedWorkflow } from './types'

export function formatRecordingContext(workflow: RecordedWorkflow): string {
	if (workflow.steps.length === 0) {
		return ''
	}

	const lines = workflow.steps.map(
		(step, i) => `${i + 1}. click element [${step.index}] — ${step.label}`
	)

	return [
		`Recorded workflow for this page (${workflow.urlKey}, ${workflow.steps.length} step(s)):`,
		...lines,
		'Use this sequence as guidance when automating similar tasks. Indices may drift — match by labels if a click fails.',
	].join('\n')
}
