<script lang="ts" setup>
import {computed} from 'vue'

import type {IProject} from '@/modelTypes/IProject'

import {useProjectStore} from '@/stores/projects'
import {getProjectTitle} from '@/helpers/getProjectTitle'

const props = defineProps<{
	project: IProject
}>()

const projectStore = useProjectStore()

const ancestors = computed(() => projectStore.getAncestors(props.project)
	.filter(p => p.id !== props.project.id)
	.map(p => getProjectTitle(p)))
</script>

<template>
	<span>
		<span
			v-if="ancestors.length > 0"
			class="has-text-grey"
		>
			{{ ancestors.join(' &gt; ') }} &gt;
		</span>
		{{ getProjectTitle(project) }}
	</span>
</template>
