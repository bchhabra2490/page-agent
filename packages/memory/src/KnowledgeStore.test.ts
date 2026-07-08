import { beforeEach, describe, expect, it } from 'vitest'

import { KnowledgeStore } from './KnowledgeStore'

describe('KnowledgeStore', () => {
	let store: KnowledgeStore

	beforeEach(() => {
		localStorage.clear()
		store = new KnowledgeStore({ storageKey: 'test-knowledge', global: false })
	})

	it('adds and retrieves entries', async () => {
		await store.ready
		const entry = await store.add({
			title: 'Contact',
			category: 'profile',
			content: 'Email: jane@example.com',
			tags: ['email'],
		})
		expect(store.get(entry.id)?.title).toBe('Contact')
		expect(store.size()).toBe(1)
	})

	it('updates and deletes entries', async () => {
		await store.ready
		const entry = await store.add({
			title: 'Old',
			category: 'other',
			content: 'data',
		})
		await store.update(entry.id, { title: 'New' })
		expect(store.get(entry.id)?.title).toBe('New')
		expect(await store.delete(entry.id)).toBe(true)
		expect(store.size()).toBe(0)
	})

	it('searches by query tokens', async () => {
		await store.ready
		await store.add({
			title: 'Work at Acme',
			category: 'experience',
			content: 'Senior engineer 2020-2024',
			tags: ['employer'],
		})
		await store.add({
			title: 'Email',
			category: 'profile',
			content: 'jane@example.com',
			tags: ['email'],
		})

		const hits = store.search('email address')
		expect(hits.length).toBeGreaterThan(0)
		expect(hits[0]?.title).toBe('Email')
	})

	it('persists to localStorage', async () => {
		await store.ready
		await store.add({ title: 'Saved', category: 'profile', content: 'data' })
		const reloaded = new KnowledgeStore({ storageKey: 'test-knowledge', global: false })
		await reloaded.ready
		expect(reloaded.size()).toBe(1)
		expect(reloaded.getAll()[0]?.title).toBe('Saved')
	})
})
