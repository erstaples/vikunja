import {describe, it, expect, beforeEach, vi} from 'vitest'
import {setActivePinia, createPinia} from 'pinia'
import {nextTick, ref} from 'vue'

// useProjectStore calls useRouter() and useBaseStore() directly, neither of which
// works outside a component instance. Mocked the same way src/stores/projects.test.ts
// does it. vue-i18n itself is left real: the label store's own `@/i18n` singleton
// (used in this same test file) needs its actual createI18n().
vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: vi.fn(),
	}),
}))

vi.mock('@/stores/base', () => ({
	useBaseStore: () => ({
		currentProject: null,
		setCurrentProject: vi.fn(),
	}),
}))

import {useQuickAddTokenSelector} from './useQuickAddTokenSelector'
import {PrefixMode} from '@/modules/quickAddMagic'
import {useLabelStore} from '@/stores/labels'
import {useProjectStore} from '@/stores/projects'
import type {ILabel} from '@/modelTypes/ILabel'
import type {IProject} from '@/modelTypes/IProject'

const LABELS = [
	{id: 1, title: 'health'},
	{id: 2, title: 'healthcare'},
	{id: 3, title: 'home'},
] as ILabel[]

// projectsArray sorts by position, so set it explicitly or the empty-query
// ordering assertion below is at the mercy of the sort's NaN comparisons.
const PROJECTS = [
	{id: 1, title: 'Work', isArchived: false, parentProjectId: 0, position: 1},
	{id: 2, title: 'Office Move', isArchived: false, parentProjectId: 0, position: 2},
	{id: 3, title: 'Archived', isArchived: true, parentProjectId: 0, position: 3},
] as IProject[]

// The composable reads selectionStart off a real textarea, so give it one.
function setup(initial = '', mode = PrefixMode.Todoist) {
	const el = document.createElement('textarea')
	document.body.appendChild(el)
	el.value = initial

	const text = ref(initial)
	const textarea = ref<HTMLTextAreaElement | null>(el)
	const selector = useQuickAddTokenSelector({text, textarea, mode: ref(mode)})

	function type(value: string, caret: number = value.length) {
		text.value = value
		el.value = value
		el.setSelectionRange(caret, caret)
		selector.onSelectionChange()
	}

	return {selector, text, el, type}
}

beforeEach(() => {
	setActivePinia(createPinia())
	const labelStore = useLabelStore()
	labelStore.setLabels(LABELS)
	vi.spyOn(labelStore, 'loadAllLabels').mockResolvedValue(LABELS)

	const projectStore = useProjectStore()
	projectStore.setProjects(PROJECTS)
	vi.spyOn(projectStore, 'loadAllProjects').mockResolvedValue([])
})

describe('opening and closing', () => {
	it('stays closed with no token', () => {
		const {selector, type} = setup()
		type('Call dentist')
		expect(selector.isOpen.value).toBe(false)
	})

	it('opens on a label token', () => {
		const {selector, type} = setup()
		type('Call @hea')
		expect(selector.isOpen.value).toBe(true)
		expect(selector.suggestions.value.map(s => s.title)).toEqual(['health', 'healthcare', 'hea'])
	})

	it('opens on a project token', () => {
		const {selector, type} = setup()
		type('Call #Off')
		expect(selector.tokenKind.value).toBe('project')
		expect(selector.suggestions.value.map(s => s.title)).toEqual(['Office Move'])
	})

	it('excludes archived projects on an empty query', () => {
		const {selector, type} = setup()
		type('Call #')
		expect(selector.suggestions.value.map(s => s.title)).toEqual(['Work', 'Office Move'])
	})

	it('closes when the caret leaves the token', () => {
		const {selector, type} = setup()
		type('Call @hea')
		expect(selector.isOpen.value).toBe(true)
		type('Call @hea now')
		expect(selector.isOpen.value).toBe(false)
	})

	it('stays closed while enabled is false', () => {
		const el = document.createElement('textarea')
		document.body.appendChild(el)
		const text = ref('Call @hea')
		el.value = text.value
		el.setSelectionRange(9, 9)
		const selector = useQuickAddTokenSelector({
			text,
			textarea: ref(el),
			mode: ref(PrefixMode.Todoist),
			enabled: ref(false),
		})
		selector.onSelectionChange()
		expect(selector.isOpen.value).toBe(false)
	})
})

describe('create label row', () => {
	it('appends a create row for a query matching no label', () => {
		const {selector, type} = setup()
		type('Call @brandnew')
		expect(selector.suggestions.value).toEqual([
			{kind: 'create-label', title: 'brandnew'},
		])
	})

	it('omits the create row on an exact match', () => {
		const {selector, type} = setup()
		type('Call @health')
		expect(selector.suggestions.value.some(s => s.kind === 'create-label')).toBe(false)
	})

	it('omits the create row for project tokens', () => {
		const {selector, type} = setup()
		type('Call #nosuchproject')
		expect(selector.suggestions.value).toEqual([])
	})

	it('offers to create a label whose name is a substring of an existing one', () => {
		const {selector, type} = setup()
		type('Call @heal')
		const suggestions = selector.suggestions.value
		expect(suggestions[suggestions.length - 1]).toEqual({kind: 'create-label', title: 'heal'})
	})
})

describe('keyboard', () => {
	function key(name: string, extra: KeyboardEventInit = {}) {
		return new KeyboardEvent('keydown', {key: name, ...extra})
	}

	it('ignores keys while closed', () => {
		const {selector, type} = setup()
		type('Call dentist')
		expect(selector.onKeydown(key('Enter'))).toBe(false)
	})

	it('moves the active index with arrows and clamps at both ends', () => {
		const {selector, type} = setup()
		type('Call @hea')
		expect(selector.suggestions.value).toHaveLength(3)
		expect(selector.activeIndex.value).toBe(0)
		expect(selector.onKeydown(key('ArrowDown'))).toBe(true)
		expect(selector.activeIndex.value).toBe(1)
		selector.onKeydown(key('ArrowDown'))
		expect(selector.activeIndex.value).toBe(2)
		selector.onKeydown(key('ArrowDown'))
		expect(selector.activeIndex.value).toBe(2)
		selector.onKeydown(key('ArrowUp'))
		selector.onKeydown(key('ArrowUp'))
		selector.onKeydown(key('ArrowUp'))
		expect(selector.activeIndex.value).toBe(0)
	})

	it('consumes Enter and replaces the token', async () => {
		const {selector, text, type} = setup()
		type('Call @hea')
		expect(selector.onKeydown(key('Enter'))).toBe(true)
		await nextTick()
		expect(text.value).toBe('Call @health ')
		expect(selector.isOpen.value).toBe(false)
	})

	it('consumes Tab the same way', async () => {
		const {selector, text, type} = setup()
		type('Call @hea')
		expect(selector.onKeydown(key('Tab'))).toBe(true)
		await nextTick()
		expect(text.value).toBe('Call @health ')
	})

	it('does not select while composing', () => {
		const {selector, text, type} = setup()
		type('Call @hea')
		expect(selector.onKeydown(new KeyboardEvent('keydown', {key: 'Enter', isComposing: true}))).toBe(false)
		expect(text.value).toBe('Call @hea')
	})

	it('closes on Escape and stays closed until the next input', () => {
		const {selector, type} = setup()
		type('Call @hea')
		expect(selector.onKeydown(key('Escape'))).toBe(true)
		expect(selector.isOpen.value).toBe(false)

		// A keyup after Escape must not reopen it: same text, so still dismissed.
		selector.onSelectionChange()
		expect(selector.isOpen.value).toBe(false)

		// Typing changes the text, which clears the dismissal.
		type('Call @heal')
		expect(selector.isOpen.value).toBe(true)
	})
})

describe('select', () => {
	it('inserts the create-row query verbatim', async () => {
		const {selector, text, type} = setup()
		type('Call @brandnew')
		selector.select(0)
		await nextTick()
		expect(text.value).toBe('Call @brandnew ')
	})

	it('quotes a multi-word project title', async () => {
		const {selector, text, type} = setup()
		type('Plan #Off')
		selector.select(0)
		await nextTick()
		expect(text.value).toBe('Plan #"Office Move" ')
	})
})
