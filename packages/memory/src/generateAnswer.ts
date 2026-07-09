import type { LLMConfig } from '@page-agent/llms'
import { InvokeError, InvokeErrorTypes, LLM } from '@page-agent/llms'

import type { KnowledgeEntry } from './types'

export interface GenerateAnswerOptions {
	companyOrContext?: string
	maxWords?: number
	signal?: AbortSignal
}

/**
 * Generate a tailored answer from saved user knowledge using the configured LLM.
 */
export async function generateAnswerFromKnowledge(
	config: LLMConfig,
	question: string,
	entries: KnowledgeEntry[],
	options: GenerateAnswerOptions = {}
): Promise<string> {
	const { companyOrContext, maxWords = 200, signal } = options

	console.log('generateAnswerFromKnowledge', { config, question, entries, options })

	if (entries.length === 0) {
		return 'No user knowledge available. Ask the user to add profile information first.'
	}

	const contextBlock = entries
		.map(
			(e) =>
				`### ${e.title} (${e.category})\n${e.content}${e.tags.length ? `\nTags: ${e.tags.join(', ')}` : ''}`
		)
		.join('\n\n')

	const systemPrompt = `You write application and form answers on behalf of the user.
Use ONLY facts from the user knowledge below. Do not invent employers, dates, skills, or motivations.
Write in first person. Be specific and professional.
Keep the answer under ${maxWords} words unless the question clearly needs more detail.`

	const userPrompt = [
		`<user_knowledge>\n${contextBlock}\n</user_knowledge>`,
		companyOrContext ? `<context>\n${companyOrContext}\n</context>` : '',
		`<question>\n${question}\n</question>`,
		'Write the answer ready to paste into a form field. Call the Answer tool with the final text only.',
	]
		.filter(Boolean)
		.join('\n\n')

	const llm = new LLM(config)
	const abortSignal = signal ?? new AbortController().signal

	try {
		return await llm.complete(
			[
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt },
			],
			abortSignal
		)
	} catch (error) {
		if (error instanceof InvokeError && error.type === InvokeErrorTypes.AUTH_ERROR) {
			throw new Error(
				`Answer generation auth failed (${error.message}). ` +
					'Check your API key and baseURL — the same config is used for generate_answer and the main agent.',
				{ cause: error }
			)
		}
		throw new Error(
			`Answer generation failed: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		)
	}
}
