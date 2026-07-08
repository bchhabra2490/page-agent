import { type PageAgentCore, tool } from '@page-agent/core'
import * as z from 'zod/v4'

import type { KnowledgeStore } from './KnowledgeStore'
import { generateAnswerFromKnowledge } from './generateAnswer'

/**
 * Agent tools for reading and synthesizing user knowledge.
 */
export function createMemoryTools(store: KnowledgeStore) {
	return {
		lookup_user_data: tool({
			description:
				'Search the user saved profile and documents for factual data. Use before filling any personal or document-derived form field.',
			inputSchema: z.object({
				query: z
					.string()
					.describe(
						'What you need, e.g. "email address", "previous employer", "phone number", "university degree"'
					),
				limit: z.number().int().min(1).max(10).default(5),
			}),
			execute: async function (this: PageAgentCore, input) {
				await store.ready
				const hits = store.search(input.query, input.limit)
				if (hits.length === 0) {
					return 'No matching user data found. Use ask_user or generate_answer if appropriate.'
				}
				return JSON.stringify(
					hits.map((h) => ({
						title: h.title,
						category: h.category,
						excerpt: h.excerpt,
					})),
					null,
					2
				)
			},
		}),

		generate_answer: tool({
			description:
				'Generate a tailored text answer from the user knowledge base. Use for cover letters, "why join this company", motivation statements, and other open-ended questions.',
			inputSchema: z.object({
				question: z
					.string()
					.describe(
						'The question or prompt to answer, e.g. "Why do you want to join this company?"'
					),
				company_or_context: z
					.string()
					.optional()
					.describe('Company name, role title, or other context from the current page'),
				max_words: z.number().int().min(50).max(600).default(200),
			}),
			execute: async function (this: PageAgentCore, input, { signal }) {
				await store.ready
				const entries = store.getContextForQuestion(input.question, 8)
				const answer = await generateAnswerFromKnowledge(this.config, input.question, entries, {
					companyOrContext: input.company_or_context,
					maxWords: input.max_words,
					signal,
				})
				signal.throwIfAborted()
				return answer
			},
		}),
	}
}

export type MemoryTools = ReturnType<typeof createMemoryTools>
