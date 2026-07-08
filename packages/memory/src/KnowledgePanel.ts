import { KNOWLEDGE_CATEGORIES, type KnowledgeStore } from './KnowledgeStore'
import type { KnowledgeCategory, KnowledgeEntry } from './types'

import styles from './KnowledgePanel.module.css'

const STRINGS = {
	'en-US': {
		title: 'My Info',
		toggleTitle: 'Manage saved info for form filling',
		close: 'Close',
		empty:
			'Add your profile, experience, and motivation so the agent can fill forms and write cover letters.',
		addTitle: 'Add info',
		editTitle: 'Edit info',
		fieldTitle: 'Title',
		fieldCategory: 'Category',
		fieldContent: 'Content',
		fieldTags: 'Tags (comma-separated)',
		save: 'Save',
		cancel: 'Cancel',
		edit: 'Edit',
		delete: 'Delete',
		deleteConfirm: 'Delete this entry?',
		titlePlaceholder: 'e.g. Contact info, Why I want to join',
		contentPlaceholder: 'Facts the agent should use — address, employers, skills, motivation…',
		tagsPlaceholder: 'email, address, cover-letter',
		categories: {
			profile: 'Profile',
			experience: 'Experience',
			education: 'Education',
			skills: 'Skills',
			motivation: 'Motivation',
			other: 'Other',
		} satisfies Record<KnowledgeCategory, string>,
	},
	'zh-CN': {
		title: '我的信息',
		toggleTitle: '管理表单填写用的个人信息',
		close: '关闭',
		empty: '添加个人资料、经历和动机，以便 Agent 填写表单和撰写求职信。',
		addTitle: '添加信息',
		editTitle: '编辑信息',
		fieldTitle: '标题',
		fieldCategory: '分类',
		fieldContent: '内容',
		fieldTags: '标签（逗号分隔）',
		save: '保存',
		cancel: '取消',
		edit: '编辑',
		delete: '删除',
		deleteConfirm: '确定删除这条信息？',
		titlePlaceholder: '例如：联系方式、加入动机',
		contentPlaceholder: 'Agent 应使用的事实 — 地址、雇主、技能、动机等',
		tagsPlaceholder: 'email, address, cover-letter',
		categories: {
			profile: '个人资料',
			experience: '工作经历',
			education: '教育',
			skills: '技能',
			motivation: '动机',
			other: '其他',
		} satisfies Record<KnowledgeCategory, string>,
	},
} as const

export type KnowledgePanelLanguage = 'en-US' | 'zh-CN'

export interface KnowledgePanelConfig {
	language?: KnowledgePanelLanguage
}

/**
 * Floating UI for managing user knowledge entries (add / edit / delete).
 */
export class KnowledgePanel {
	#store: KnowledgeStore
	#strings: (typeof STRINGS)[keyof typeof STRINGS]
	#overlay: HTMLElement
	#panel: HTMLElement
	#listEl: HTMLElement
	#formEl: HTMLElement
	#formTitleEl: HTMLElement
	#titleInput: HTMLInputElement
	#categorySelect: HTMLSelectElement
	#contentInput: HTMLTextAreaElement
	#tagsInput: HTMLInputElement
	#editingId: string | null = null
	#isOpen = false
	#unsubscribe: (() => void) | null = null

	constructor(store: KnowledgeStore, config: KnowledgePanelConfig = {}) {
		this.#store = store
		const lang = config.language ?? 'en-US'
		this.#strings = STRINGS[lang] ?? STRINGS['en-US']

		this.#overlay = document.createElement('div')
		this.#overlay.className = styles.overlay

		this.#panel = document.createElement('div')
		this.#panel.className = styles.panel
		this.#panel.innerHTML = `
			<div class="${styles.header}">
				<span class="${styles.title}">${this.#strings.title}</span>
				<button type="button" class="${styles.closeButton}" aria-label="${this.#strings.close}">×</button>
			</div>
			<div class="${styles.body}">
				<div class="${styles.entryList}"></div>
				<div class="${styles.form}">
					<div class="${styles.formTitle} ${styles.label}">${this.#strings.addTitle}</div>
					<label class="${styles.label}">${this.#strings.fieldTitle}</label>
					<input type="text" class="${styles.input}" data-field="title" maxlength="120" />
					<label class="${styles.label}">${this.#strings.fieldCategory}</label>
					<select class="${styles.select}" data-field="category"></select>
					<label class="${styles.label}">${this.#strings.fieldContent}</label>
					<textarea class="${styles.textarea}" data-field="content" maxlength="8000"></textarea>
					<label class="${styles.label}">${this.#strings.fieldTags}</label>
					<input type="text" class="${styles.input}" data-field="tags" maxlength="200" />
					<div class="${styles.entryActions}">
						<button type="button" class="${styles.primaryButton}" data-action="save">${this.#strings.save}</button>
						<button type="button" class="${styles.smallButton} ${styles.hidden}" data-action="cancel">${this.#strings.cancel}</button>
					</div>
				</div>
			</div>
		`

		this.#listEl = this.#panel.querySelector(`.${styles.entryList}`)!
		this.#formEl = this.#panel.querySelector(`.${styles.form}`)!
		this.#formTitleEl = this.#panel.querySelector(`.${styles.formTitle}`)!
		this.#titleInput = this.#panel.querySelector('[data-field="title"]')!
		this.#categorySelect = this.#panel.querySelector('[data-field="category"]')!
		this.#contentInput = this.#panel.querySelector('[data-field="content"]')!
		this.#tagsInput = this.#panel.querySelector('[data-field="tags"]')!

		this.#titleInput.placeholder = this.#strings.titlePlaceholder
		this.#contentInput.placeholder = this.#strings.contentPlaceholder
		this.#tagsInput.placeholder = this.#strings.tagsPlaceholder

		for (const cat of KNOWLEDGE_CATEGORIES) {
			const opt = document.createElement('option')
			opt.value = cat
			opt.textContent = this.#strings.categories[cat]
			this.#categorySelect.appendChild(opt)
		}

		this.#setupListeners()
		this.#renderList()
	}

	mount(): void {
		document.body.appendChild(this.#overlay)
		document.body.appendChild(this.#panel)
		this.#unsubscribe = this.#store.subscribe(() => this.#renderList())
		void this.#store.ready.then(() => this.#renderList())
	}

	dispose(): void {
		this.#unsubscribe?.()
		this.#overlay.remove()
		this.#panel.remove()
	}

	toggle(): void {
		this.#setOpen(!this.#isOpen)
	}

	open(): void {
		this.#setOpen(true)
	}

	close(): void {
		this.#setOpen(false)
	}

	#setupListeners(): void {
		this.#overlay.addEventListener('click', () => this.#setOpen(false))
		this.#panel
			.querySelector(`.${styles.closeButton}`)!
			.addEventListener('click', () => this.#setOpen(false))

		this.#panel
			.querySelector('[data-action="save"]')!
			.addEventListener('click', () => this.#saveForm())
		this.#panel
			.querySelector('[data-action="cancel"]')!
			.addEventListener('click', () => this.#resetForm())
	}

	#setOpen(open: boolean): void {
		this.#isOpen = open
		this.#overlay.classList.toggle(styles.open, open)
		this.#panel.classList.toggle(styles.open, open)
		if (open) this.#renderList()
	}

	#renderList(): void {
		const entries = this.#store.getAll()
		this.#listEl.innerHTML = ''

		if (entries.length === 0) {
			const empty = document.createElement('div')
			empty.className = styles.emptyState
			empty.textContent = this.#strings.empty
			this.#listEl.appendChild(empty)
			return
		}

		for (const entry of entries) {
			this.#listEl.appendChild(this.#createEntryCard(entry))
		}
	}

	#createEntryCard(entry: KnowledgeEntry): HTMLElement {
		const card = document.createElement('div')
		card.className = styles.entryCard
		card.innerHTML = `
			<div class="${styles.entryHeader}">
				<span class="${styles.entryTitle}"></span>
				<span class="${styles.entryMeta}"></span>
			</div>
			<div class="${styles.entryExcerpt}"></div>
			<div class="${styles.entryActions}">
				<button type="button" class="${styles.smallButton}" data-action="edit">${this.#strings.edit}</button>
				<button type="button" class="${styles.smallButton} ${styles.danger}" data-action="delete">${this.#strings.delete}</button>
			</div>
		`

		card.querySelector(`.${styles.entryTitle}`)!.textContent = entry.title
		card.querySelector(`.${styles.entryMeta}`)!.textContent =
			this.#strings.categories[entry.category]
		card.querySelector(`.${styles.entryExcerpt}`)!.textContent = entry.content

		card
			.querySelector('[data-action="edit"]')!
			.addEventListener('click', () => this.#startEdit(entry))
		card.querySelector('[data-action="delete"]')!.addEventListener('click', () => {
			if (confirm(this.#strings.deleteConfirm)) {
				void this.#store.delete(entry.id).then(() => {
					if (this.#editingId === entry.id) this.#resetForm()
				})
			}
		})

		return card
	}

	#startEdit(entry: KnowledgeEntry): void {
		this.#editingId = entry.id
		this.#formTitleEl.textContent = this.#strings.editTitle
		this.#titleInput.value = entry.title
		this.#categorySelect.value = entry.category
		this.#contentInput.value = entry.content
		this.#tagsInput.value = entry.tags.join(', ')
		this.#panel.querySelector('[data-action="cancel"]')!.classList.remove(styles.hidden)
		this.#formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
	}

	#resetForm(): void {
		this.#editingId = null
		this.#formTitleEl.textContent = this.#strings.addTitle
		this.#titleInput.value = ''
		this.#categorySelect.value = 'profile'
		this.#contentInput.value = ''
		this.#tagsInput.value = ''
		this.#panel.querySelector('[data-action="cancel"]')!.classList.add(styles.hidden)
	}

	#saveForm(): void {
		const title = this.#titleInput.value.trim()
		const content = this.#contentInput.value.trim()
		if (!title || !content) return

		const input = {
			title,
			category: this.#categorySelect.value as KnowledgeCategory,
			content,
			tags: this.#tagsInput.value
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean),
		}

		const savePromise = this.#editingId
			? this.#store.update(this.#editingId, input)
			: this.#store.add(input)

		void savePromise.then(() => this.#resetForm())
	}
}
