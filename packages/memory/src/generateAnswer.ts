import type { LLMConfig } from '@page-agent/llms'
import { parseLLMConfig } from '@page-agent/llms'

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
		'Write the answer ready to paste into a form field. Output only the answer text, no preamble.',
	]
		.filter(Boolean)
		.join('\n\n')

	return completeText(
		config,
		[
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
		signal
	)
}

async function completeText(
	config: LLMConfig,
	messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
	signal?: AbortSignal
): Promise<string> {
	const resolved = parseLLMConfig(config)
	signal?.throwIfAborted()

	const requestBody: Record<string, unknown> = {
		model: resolved.model,
		messages,
	}

	if (resolved.temperature !== undefined) {
		requestBody.temperature = resolved.temperature
	}

	const transformed = resolved.transformRequestBody(requestBody) ?? requestBody

	const response = await resolved.customFetch(`${resolved.baseURL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(resolved.apiKey && { Authorization: `Bearer ${resolved.apiKey}` }),
		},
		body: JSON.stringify(transformed),
		signal,
	})

	if (!response.ok) {
		let message = response.statusText
		try {
			const data = (await response.json()) as { error?: { message?: string } }
			message = data.error?.message ?? message
		} catch {
			// ignore
		}
		throw new Error(`Answer generation failed: ${message}`)
	}

	const data = (await response.json()) as {
		choices?: { message?: { content?: string | null } }[]
	}
	const content = data.choices?.[0]?.message?.content?.trim()
	if (!content) {
		throw new Error('Answer generation returned empty content')
	}
	return content
}
