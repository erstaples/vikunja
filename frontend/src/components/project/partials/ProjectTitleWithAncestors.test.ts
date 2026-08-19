import {setActivePinia, createPinia} from 'pinia'
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {mount} from '@vue/test-utils'

import type {IProject} from '@/modelTypes/IProject'

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: vi.fn(),
	}),
}))

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
	createI18n: () => ({
		global: {
			t: (key: string) => key,
		},
	}),
}))

vi.mock('@/stores/base', () => ({
	useBaseStore: () => ({
		currentProject: null,
		setCurrentProject: vi.fn(),
	}),
}))

const projectServiceMock = {
	update: vi.fn(),
	getAll: vi.fn(),
	totalPages: 1,
}

vi.mock('@/services/project', () => ({
	default: class {
		update = (project: IProject) => projectServiceMock.update(project)
		getAll = (...args: unknown[]) => projectServiceMock.getAll(...args)
		get totalPages() {
			return projectServiceMock.totalPages
		}
	},
}))

import {useProjectStore} from '@/stores/projects'
import ProjectTitleWithAncestors from './ProjectTitleWithAncestors.vue'

function createMockProject(overrides: Partial<IProject>): IProject {
	return {
		id: 1,
		title: 'Test Project',
		description: '',
		owner: {id: 1, username: 'test', name: '', email: '', created: new Date(), updated: new Date()},
		tasks: [],
		isArchived: false,
		hexColor: '',
		identifier: '',
		backgroundInformation: null,
		isFavorite: false,
		subscription: null as any,
		position: 0,
		backgroundBlurHash: '',
		parentProjectId: 0,
		views: [],
		created: new Date(),
		updated: new Date(),
		...overrides,
	} as IProject
}

describe('ProjectTitleWithAncestors.vue', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('renders root project with no breadcrumb', () => {
		const rootProject = createMockProject({
			id: 1,
			title: 'Root Project',
			parentProjectId: 0,
		})

		const projectStore = useProjectStore()
		projectStore.setProjects([rootProject])

		const wrapper = mount(ProjectTitleWithAncestors, {
			props: {
				project: rootProject,
			},
			global: {
				mocks: {$t: (key: string) => key},
			},
		})

		expect(wrapper.text()).toBe('Root Project')
		expect(wrapper.find('.has-text-grey').exists()).toBe(false)
	})

	it('renders project with one ancestor', () => {
		const parentProject = createMockProject({
			id: 1,
			title: 'Parent Project',
			parentProjectId: 0,
		})

		const childProject = createMockProject({
			id: 2,
			title: 'Child Project',
			parentProjectId: 1,
		})

		const projectStore = useProjectStore()
		projectStore.setProjects([parentProject, childProject])

		const wrapper = mount(ProjectTitleWithAncestors, {
			props: {
				project: childProject,
			},
			global: {
				mocks: {$t: (key: string) => key},
			},
		})

		const greySpan = wrapper.find('.has-text-grey')
		expect(greySpan.exists()).toBe(true)
		expect(greySpan.text()).toBe('Parent Project >')
		expect(wrapper.text()).toContain('Child Project')
	})

	it('renders project with two levels of ancestors', () => {
		const rootProject = createMockProject({
			id: 1,
			title: 'Root Project',
			parentProjectId: 0,
		})

		const intermediateProject = createMockProject({
			id: 2,
			title: 'Intermediate Project',
			parentProjectId: 1,
		})

		const leafProject = createMockProject({
			id: 3,
			title: 'Leaf Project',
			parentProjectId: 2,
		})

		const projectStore = useProjectStore()
		projectStore.setProjects([rootProject, intermediateProject, leafProject])

		const wrapper = mount(ProjectTitleWithAncestors, {
			props: {
				project: leafProject,
			},
			global: {
				mocks: {$t: (key: string) => key},
			},
		})

		const greySpan = wrapper.find('.has-text-grey')
		expect(greySpan.exists()).toBe(true)
		expect(greySpan.text()).toBe('Root Project > Intermediate Project >')
		expect(wrapper.text()).toContain('Leaf Project')
	})
})
