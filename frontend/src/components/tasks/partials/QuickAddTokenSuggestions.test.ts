import {describe, it, expect, beforeEach, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {setActivePinia, createPinia} from 'pinia'

// useProjectStore calls useRouter() and useBaseStore() directly, neither of which
// works outside a component instance. Mocked the same way
// src/composables/useQuickAddTokenSelector.test.ts does it.
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

import QuickAddTokenSuggestions from './QuickAddTokenSuggestions.vue'
import XLabel from './Label.vue'
import ProjectTitleWithAncestors from '@/components/project/partials/ProjectTitleWithAncestors.vue'
import {useProjectStore} from '@/stores/projects'
import type {QuickAddSuggestion} from '@/composables/useQuickAddTokenSelector'
import type {IProject} from '@/modelTypes/IProject'
import type {ILabel} from '@/modelTypes/ILabel'

const PARENT = {id: 1, title: 'Work', isArchived: false, parentProjectId: 0, position: 1} as IProject
const CHILD = {id: 2, title: 'Office Move', isArchived: false, parentProjectId: 1, position: 2} as IProject

function mountList(suggestions: QuickAddSuggestion[], activeIndex = 0) {
	return mount(QuickAddTokenSuggestions, {
		props: {
			suggestions,
			activeIndex,
			listboxId: 'listbox',
			optionId: (index: number) => `listbox-option-${index}`,
		},
		global: {
			mocks: {$t: (key: string) => key},
		},
	})
}

beforeEach(() => {
	setActivePinia(createPinia())
	useProjectStore().setProjects([PARENT, CHILD])
})

describe('QuickAddTokenSuggestions', () => {
	it('renders label rows with their titles', () => {
		const wrapper = mountList([
			{kind: 'label', title: 'health', label: {id: 1, title: 'health'} as ILabel},
		])
		expect(wrapper.get('[role="listbox"]').attributes('id')).toBe('listbox')
		expect(wrapper.text()).toContain('health')
		expect(wrapper.findComponent(XLabel).exists()).toBe(true)
	})

	it('renders project rows with ancestor context', () => {
		const wrapper = mountList([{kind: 'project', title: 'Office Move', project: CHILD}])
		expect(wrapper.text()).toContain('Work')
		expect(wrapper.text()).toContain('Office Move')
		expect(wrapper.findComponent(ProjectTitleWithAncestors).exists()).toBe(true)
	})

	it('marks the active row as selected', () => {
		const wrapper = mountList([
			{kind: 'label', title: 'health', label: {id: 1, title: 'health'} as ILabel},
			{kind: 'label', title: 'home', label: {id: 3, title: 'home'} as ILabel},
		], 1)
		const options = wrapper.findAll('[role="option"]')
		expect(options[0].attributes('aria-selected')).toBe('false')
		expect(options[1].attributes('aria-selected')).toBe('true')
		expect(options[0].attributes('id')).toBe('listbox-option-0')
		expect(options[1].attributes('id')).toBe('listbox-option-1')
	})

	it('emits select with the clicked index', async () => {
		const wrapper = mountList([
			{kind: 'label', title: 'health', label: {id: 1, title: 'health'} as ILabel},
			{kind: 'label', title: 'home', label: {id: 3, title: 'home'} as ILabel},
		])
		await wrapper.findAll('[role="option"]')[1].trigger('click')
		expect(wrapper.emitted('select')).toEqual([[1]])
	})

	it('emits hover with the row index on mousemove', async () => {
		const wrapper = mountList([
			{kind: 'label', title: 'health', label: {id: 1, title: 'health'} as ILabel},
			{kind: 'label', title: 'home', label: {id: 3, title: 'home'} as ILabel},
		])
		await wrapper.findAll('[role="option"]')[1].trigger('mousemove')
		expect(wrapper.emitted('hover')).toEqual([[1]])
	})

	it('renders the create row with the existing translation key', () => {
		const wrapper = mountList([{kind: 'create-label', title: 'brandnew'}])
		expect(wrapper.text()).toContain('brandnew')
		expect(wrapper.text()).toContain('task.label.createPlaceholder')
	})
})
