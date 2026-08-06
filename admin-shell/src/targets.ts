/* eslint-disable vue/one-component-per-file */

import type { TargetCandidate, TypedTarget } from '@peanut-admin/admin/core'
import { ElOption, ElPagination, ElSelect } from 'element-plus'
import { computed, defineComponent, h } from 'vue'
import type { Component, PropType } from 'vue'

const SelectComponent = ElSelect as unknown as Component
const OptionComponent = ElOption as unknown as Component
const PaginationComponent = ElPagination as unknown as Component

const targetKey = (target: TypedTarget): string => JSON.stringify([
  target.target_resource_key,
  target.target_role,
  target.target_id,
])

export const TargetSelector = defineComponent({
  name: 'TargetSelector',
  props: {
    modelValue: {
      type: Array as PropType<readonly TypedTarget[]>,
      default: () => [],
    },
    candidates: {
      type: Array as PropType<readonly TargetCandidate[]>,
      default: () => [],
    },
    multiple: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: 'Select target' },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 20 },
    total: { type: Number, default: 0 },
  },
  emits: {
    'update:modelValue': (targets: readonly TypedTarget[]) => Array.isArray(targets),
    search: (query: string) => typeof query === 'string',
    'page-change': (page: number) => Number.isInteger(page) && page >= 1,
  },
  setup(props, { emit }) {
    const candidateMap = computed(() => new Map(
      props.candidates.map(candidate => [targetKey(candidate), candidate]),
    ))
    const selectedKeys = computed(() => props.modelValue.map(targetKey))
    const updateSelection = (value: unknown): void => {
      const values = (Array.isArray(value) ? value : [value]).filter(
        (candidate): candidate is string => typeof candidate === 'string',
      )
      const targets = values.flatMap(key => {
        const candidate = candidateMap.value.get(key)
        return candidate === undefined
          ? []
          : [{
              target_resource_key: candidate.target_resource_key,
              target_role: candidate.target_role,
              target_id: candidate.target_id,
            }]
      })
      emit('update:modelValue', props.multiple ? targets : targets.slice(0, 1))
    }

    return () => h('div', { class: 'pa-target-selector' }, [
      h(SelectComponent, {
        modelValue: props.multiple ? selectedKeys.value : (selectedKeys.value[0] ?? null),
        'onUpdate:modelValue': updateSelection,
        multiple: props.multiple,
        filterable: true,
        remote: true,
        remoteMethod: (query: string) => emit('search', query),
        loading: props.loading,
        disabled: props.disabled,
        placeholder: props.placeholder,
        class: 'pa-target-selector__select',
      }, () => props.candidates.map(candidate => h(OptionComponent, {
        key: targetKey(candidate),
        value: targetKey(candidate),
        label: candidate.label,
      }))),
      props.total <= props.pageSize
        ? null
        : h(PaginationComponent, {
            class: 'pa-target-selector__pagination',
            currentPage: props.page,
            pageSize: props.pageSize,
            total: props.total,
            layout: 'prev, pager, next',
            'onUpdate:currentPage': (page: number) => emit('page-change', page),
          }),
    ])
  },
})

export type TargetScopeMode = 'zero' | 'single' | 'multiple' | 'aggregate'

export const TargetScopeSummary = defineComponent({
  name: 'TargetScopeSummary',
  props: {
    mode: {
      type: String as PropType<TargetScopeMode>,
      required: true,
    },
    availableCount: { type: Number, required: true },
    selectedCount: { type: Number, default: 0 },
    digest: { type: String, default: null },
  },
  setup(props) {
    const message = computed(() => {
      switch (props.mode) {
        case 'zero':
          return 'No available targets'
        case 'single':
          return '1 available target'
        case 'aggregate':
          return `Read-only aggregate across ${props.availableCount} targets`
        default:
          return `${props.selectedCount} of ${props.availableCount} targets selected`
      }
    })

    return () => h('div', {
      class: ['pa-target-scope-summary', `is-${props.mode}`],
      role: 'status',
      'aria-label': 'Target scope',
    }, message.value)
  },
})
