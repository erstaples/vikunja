import {computed, nextTick, ref, type Ref} from 'vue'

import type {ILabel} from '@/modelTypes/ILabel'
import type {IProject} from '@/modelTypes/IProject'

import {
	findActiveQuickAddToken,
	replaceActiveQuickAddToken,
	type ActiveQuickAddToken,
	type PrefixMode,
} from '@/modules/quickAddMagic'
import {useLabelStore} from '@/stores/labels'
import {useProjectStore} from '@/stores/projects'

const MAX_SUGGESTIONS = 8

// Not useId(): the composable is exercised in unit tests outside any component
// instance, where useId() warns and returns undefined.
let selectorCount = 0

export interface QuickAddSuggestion {
	kind: 'label' | 'project' | 'create-label'
	title: string
	label?: ILabel
	project?: IProject
}

export function useQuickAddTokenSelector({text, textarea, mode, enabled}: {
	text: Ref<string>
	textarea: Ref<HTMLTextAreaElement | null>
	mode: Ref<PrefixMode>
	enabled?: Ref<boolean>
}) {
	const labelStore = useLabelStore()
	const projectStore = useProjectStore()

	const token = ref<ActiveQuickAddToken | null>(null)
	const activeIndex = ref(0)
	// Set by Escape, cleared on the next real edit, so the keyup that follows
	// Escape does not immediately reopen the popup.
	const dismissed = ref(false)
	const lastText = ref(text.value)

	// The stores expose these through readonly(), which types them DeepReadonly and will not
	// assign to ILabel/IProject. The popup only ever reads them.
	const allLabels = computed(() => labelStore.labelsArray as ILabel[])
	const allProjects = computed(() => projectStore.projectsArray as IProject[])

	const listboxId = `quick-add-token-listbox-${++selectorCount}`
	const loadedLabels = ref(false)
	const loadedProjects = ref(false)

	const suggestions = computed<QuickAddSuggestion[]>(() => {
		const active = token.value
		if (active === null) {
			return []
		}

		if (active.kind === 'label') {
			const found = active.query === ''
				? allLabels.value
				: labelStore.filterLabelsByQuery([], active.query)
			const rows: QuickAddSuggestion[] = found
				.slice(0, MAX_SUGGESTIONS)
				.map(label => ({kind: 'label', title: label.title, label}))

			if (active.query !== '' && !labelStore.getLabelByExactTitle(active.query)) {
				rows.push({kind: 'create-label', title: active.query})
			}
			return rows
		}

		const found = active.query === ''
			? allProjects.value.filter(p => p.id > 0 && !p.isArchived)
			: projectStore.searchProject(active.query)

		return found
			.slice(0, MAX_SUGGESTIONS)
			.map(project => ({kind: 'project', title: project.title, project}))
	})

	const isOpen = computed(() => token.value !== null && suggestions.value.length > 0)
	const tokenKind = computed(() => token.value?.kind ?? null)

	function optionId(index: number) {
		return `${listboxId}-option-${index}`
	}

	const activeOptionId = computed(() => isOpen.value ? optionId(activeIndex.value) : undefined)

	function close() {
		token.value = null
		activeIndex.value = 0
	}

	function setActiveIndex(index: number) {
		activeIndex.value = Math.min(Math.max(index, 0), Math.max(suggestions.value.length - 1, 0))
	}

	function onSelectionChange() {
		if (text.value !== lastText.value) {
			lastText.value = text.value
			dismissed.value = false
		}

		if (enabled?.value === false || dismissed.value) {
			close()
			return
		}

		const el = textarea.value
		if (el === null) {
			close()
			return
		}

		const found = findActiveQuickAddToken(text.value, el.selectionStart ?? 0, mode.value)
		const changed = found?.kind !== token.value?.kind || found?.query !== token.value?.query
		token.value = found
		if (changed) {
			activeIndex.value = 0
		}

		if (found === null) {
			return
		}

		if (found.kind === 'label' && !loadedLabels.value) {
			loadedLabels.value = true
			labelStore.loadAllLabels()
		}
		if (found.kind === 'project' && !loadedProjects.value) {
			loadedProjects.value = true
			projectStore.loadAllProjects()
		}
	}

	function select(index: number) {
		const active = token.value
		const suggestion = suggestions.value[index]
		if (active === null || suggestion === undefined) {
			return
		}

		const {text: newText, caret} = replaceActiveQuickAddToken(text.value, active, suggestion.title)
		text.value = newText
		lastText.value = newText
		close()

		// The textarea re-renders on the text change and would drop the caret.
		nextTick(() => {
			textarea.value?.setSelectionRange(caret, caret)
		})
	}

	function onKeydown(event: KeyboardEvent): boolean {
		if (!isOpen.value || event.isComposing) {
			return false
		}

		switch (event.key) {
			case 'ArrowDown':
				setActiveIndex(activeIndex.value + 1)
				return true
			case 'ArrowUp':
				setActiveIndex(activeIndex.value - 1)
				return true
			case 'Enter':
			case 'Tab':
				select(activeIndex.value)
				return true
			case 'Escape':
				dismissed.value = true
				close()
				return true
			default:
				return false
		}
	}

	return {
		isOpen,
		suggestions,
		activeIndex,
		setActiveIndex,
		tokenKind,
		listboxId,
		activeOptionId,
		optionId,
		onSelectionChange,
		onKeydown,
		select,
		close,
	}
}
