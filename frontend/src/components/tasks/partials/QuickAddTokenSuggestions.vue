<script lang="ts" setup>
import {computed, ref, watch} from 'vue'

import Icon from '@/components/misc/Icon'
import XLabel from '@/components/tasks/partials/Label.vue'
import ProjectTitleWithAncestors from '@/components/project/partials/ProjectTitleWithAncestors.vue'
import type {QuickAddSuggestion} from '@/composables/useQuickAddTokenSelector'

const props = defineProps<{
	suggestions: QuickAddSuggestion[]
	activeIndex: number
	listboxId: string
	optionId: (index: number) => string
}>()

defineEmits<{
	select: [index: number]
	hover: [index: number]
}>()

const announcement = computed(() => String(props.suggestions.length))

const rows = ref<HTMLButtonElement[]>([])

// Arrow keys move a roving index rather than DOM focus, so nothing scrolls the
// active row into view on its own.
watch(() => props.activeIndex, index => {
	rows.value[index]?.scrollIntoView({block: 'nearest'})
}, {flush: 'post'})
</script>

<template>
	<div
		:id="listboxId"
		class="quick-add-token-suggestions"
		role="listbox"
	>
		<button
			v-for="(suggestion, index) in suggestions"
			:id="optionId(index)"
			:key="suggestion.kind + suggestion.title"
			ref="rows"
			type="button"
			class="suggestion-row"
			:class="{'is-active': index === activeIndex}"
			role="option"
			:aria-selected="index === activeIndex"
			@pointerdown.prevent
			@click="$emit('select', index)"
			@mousemove="$emit('hover', index)"
		>
			<XLabel
				v-if="suggestion.kind === 'label' && suggestion.label"
				:label="suggestion.label"
			/>
			<ProjectTitleWithAncestors
				v-else-if="suggestion.kind === 'project' && suggestion.project"
				:project="suggestion.project"
			/>
			<template v-else>
				<Icon
					icon="plus"
					class="create-icon"
				/>
				<span>{{ suggestion.title }}</span>
				<span class="hint-text">{{ $t('task.label.createPlaceholder') }}</span>
			</template>
		</button>

		<div
			class="is-sr-only"
			role="status"
			aria-live="polite"
		>
			{{ announcement }}
		</div>
	</div>
</template>

<style lang="scss" scoped>
.quick-add-token-suggestions {
	background: var(--white);
	border: 1px solid var(--primary);
	border-radius: 0 0 $radius $radius;
	border-block-start: none;

	max-block-size: 50vh;
	overflow: hidden auto;
	position: absolute;
	z-index: 100;
	inset-inline: 0;
	inline-size: 100%;
	box-sizing: border-box;
}

.suggestion-row {
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--grey-800);
	font-family: $family-sans-serif;
	font-weight: normal;
	text-align: start;
	padding: .5rem;

	display: flex;
	align-items: center;
	gap: .5rem;
	inline-size: 100%;
	box-sizing: border-box;

	&:hover,
	&.is-active {
		background: var(--grey-100);
	}
}

.hint-text {
	margin-inline-start: auto;
	color: var(--grey-400);
	font-size: .75rem;
}
</style>
