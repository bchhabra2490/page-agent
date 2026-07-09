import { llmConfigMatches, resolveLLMConfig } from '@page-agent/llms'
import type { PageAgent as PageAgentType } from 'page-agent'
import { useEffect, useState } from 'react'
import { Link } from 'wouter'

import { useLanguage } from '@/i18n/context'

const SAMPLE_TASKS = {
	'en-US': [
		'Fill this job application using my saved info. Use lookup_user_data before each field. Do not submit.',
		'Write a compelling answer in the "Why do you want to join Acme Corp?" field using generate_answer. Do not submit.',
		'Fill the entire form including the motivation textarea, then stop before submitting.',
	],
	'zh-CN': [
		'使用我保存的信息填写这份职位申请表。每个字段前先调用 lookup_user_data。不要提交。',
		'使用 generate_answer 在「为什么想加入 Acme Corp？」文本框中写一段有说服力的回答。不要提交。',
		'填写整个表单（包括动机文本框），提交前停止。',
	],
} as const

let pageAgentModule: Promise<typeof import('page-agent')> | null = null

export default function JobApplicationTestPage() {
	const { language, isZh } = useLanguage()
	const [ready, setReady] = useState(false)
	const [configError, setConfigError] = useState<string | null>(null)
	const [running, setRunning] = useState(false)

	const sampleTasks = SAMPLE_TASKS[language]

	useEffect(() => {
		pageAgentModule ??= import('page-agent')
		pageAgentModule.then(async ({ PageAgent }) => {
			const win = window as Window & { pageAgent?: PageAgentType }

			let llmConfig
			try {
				llmConfig = resolveLLMConfig()
			} catch (error) {
				setConfigError(error instanceof Error ? error.message : String(error))
				return
			}

			if (
				win.pageAgent &&
				!win.pageAgent.disposed &&
				llmConfigMatches(win.pageAgent.config, llmConfig)
			) {
				setReady(true)
				return
			}

			win.pageAgent?.dispose()

			win.pageAgent = new PageAgent({
				language,
				memory: true,
				recording: true,
				interactiveBlacklist: [document.getElementById('site-chrome')!].filter(Boolean),
				instructions: {
					system: 'You are helping the user complete a job application on a test page.',
					getPageInstructions: () =>
						`This is a fake job application for Acme Corp (Senior Frontend Engineer).
Company context: Acme Corp builds developer tools and open-source UI automation.
For factual fields use lookup_user_data. For the motivation textarea use generate_answer with company_or_context "Acme Corp — Senior Frontend Engineer".
Never submit the form unless the user explicitly asks.`,
				},
				...llmConfig,
			})

			setReady(true)
		})
	}, [language])

	const runTask = async (task: string) => {
		const win = window as Window & { pageAgent?: PageAgentType }
		if (!ready || !win.pageAgent || running) return
		setRunning(true)
		try {
			await win.pageAgent.execute(task)
		} finally {
			setRunning(false)
		}
	}

	return (
		<main className="mx-auto max-w-3xl px-6 py-10 pb-32">
			<div className="mb-8">
				<Link href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
					← {isZh ? '返回首页' : 'Back to home'}
				</Link>
				<h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
					{isZh ? '记忆功能测试页' : 'Memory feature test page'}
				</h1>
				<p className="mt-2 text-gray-600 dark:text-gray-300">
					{isZh
						? '先用任务栏上的 📚 添加个人信息，再点击下方示例任务或在下方面板输入指令。'
						: 'Add your info via 📚 on the task bar, then run a sample task below or type a command in the panel.'}
				</p>
			</div>

			{configError && (
				<div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
					{configError}
				</div>
			)}

			<article className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
					Acme Corp · {isZh ? '招聘中' : 'Hiring'}
				</p>
				<h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
					Senior Frontend Engineer
				</h2>
				<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Remote-friendly · San Francisco, CA · Full-time
				</p>
				<div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
					<p>
						Acme Corp builds developer tools that make the web more programmable. We are looking for
						a Senior Frontend Engineer to help ship our in-browser automation platform used by
						thousands of teams.
					</p>
					<p>
						<strong>{isZh ? '你将负责' : 'You will'}</strong>
					</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>
							{isZh ? '构建高质量的 React/TypeScript UI' : 'Build polished React/TypeScript UI'}
						</li>
						<li>{isZh ? '与 LLM 驱动的 agent 系统协作' : 'Work on LLM-powered agent systems'}</li>
						<li>
							{isZh
								? '关注可访问性与开发者体验'
								: 'Care about accessibility and developer experience'}
						</li>
					</ul>
					<p>
						<strong>{isZh ? '我们看重' : 'We value'}</strong> open-source contributions, clear
						communication, and curiosity about AI-assisted product workflows.
					</p>
				</div>
			</article>

			<form
				className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
				onSubmit={(e) => e.preventDefault()}
			>
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					{isZh ? '申请表' : 'Application form'}
				</h2>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{isZh ? '姓名' : 'Full name'}
					</span>
					<input
						type="text"
						name="fullName"
						autoComplete="name"
						placeholder={isZh ? 'Jane Doe' : 'Jane Doe'}
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
					/>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{isZh ? '邮箱' : 'Email'}
					</span>
					<input
						type="email"
						name="email"
						autoComplete="email"
						placeholder="jane@example.com"
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
					/>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{isZh ? '电话' : 'Phone'}
					</span>
					<input
						type="tel"
						name="phone"
						autoComplete="tel"
						placeholder="+1 (555) 010-0200"
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
					/>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						LinkedIn URL
					</span>
					<input
						type="url"
						name="linkedin"
						placeholder="https://linkedin.com/in/janedoe"
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
					/>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{isZh ? '工作经验' : 'Years of experience'}
					</span>
					<select
						name="experience"
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
						defaultValue=""
					>
						<option value="" disabled>
							{isZh ? '请选择' : 'Select…'}
						</option>
						<option value="0-2">0–2</option>
						<option value="3-5">3–5</option>
						<option value="6-10">6–10</option>
						<option value="10+">10+</option>
					</select>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{isZh ? '为什么想加入 Acme Corp？' : 'Why do you want to join Acme Corp?'}
					</span>
					<textarea
						name="motivation"
						rows={6}
						maxLength={2000}
						placeholder={
							isZh
								? '分享你与我们使命的契合点，以及你能带来的价值…'
								: 'Tell us why our mission resonates with you and what you would bring to the team…'
						}
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
					/>
				</label>

				<button
					type="button"
					className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
				>
					{isZh ? '提交申请' : 'Submit application'}
				</button>
			</form>

			<section className="mt-8">
				<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					{isZh ? '示例任务' : 'Sample tasks'}
				</h2>
				<div className="flex flex-col gap-2">
					{sampleTasks.map((task) => (
						<button
							key={task}
							type="button"
							disabled={!ready || running}
							onClick={() => runTask(task)}
							className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:bg-blue-950/70"
						>
							{task}
						</button>
					))}
				</div>
			</section>
		</main>
	)
}
