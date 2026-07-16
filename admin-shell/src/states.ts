import { ElButton } from 'element-plus'
import { defineComponent, h } from 'vue'

interface StateDefaults {
  title: string
  message: string
  actionLabel?: string
}

const createStateComponent = (name: string, defaults: StateDefaults) => defineComponent({
  name,
  props: {
    title: { type: String, default: defaults.title },
    message: { type: String, default: defaults.message },
    requestId: { type: String, default: null },
    actionLabel: { type: String, default: defaults.actionLabel ?? null },
  },
  emits: {
    action: () => true,
  },
  setup(props, { emit, slots }) {
    return () => h('section', {
      class: ['pa-state', `pa-state--${name.replace(/State$/, '').toLowerCase()}`],
      role: 'status',
      'aria-live': 'polite',
    }, [
      h('h2', { class: 'pa-state__title' }, props.title),
      h('p', { class: 'pa-state__message' }, props.message),
      props.requestId === null
        ? null
        : h('p', { class: 'pa-state__request-id' }, `Request ID: ${props.requestId}`),
      slots.default?.(),
      props.actionLabel === null
        ? null
        : h(ElButton, { onClick: () => emit('action') }, () => props.actionLabel),
    ])
  },
})

export const EmptyState = createStateComponent('EmptyState', {
  title: 'No data',
  message: 'There is nothing to display.',
})

export const ForbiddenState = createStateComponent('ForbiddenState', {
  title: 'Access denied',
  message: 'You do not have permission to view this page.',
})

export const ModuleUnavailableState = createStateComponent('ModuleUnavailableState', {
  title: 'Module unavailable',
  message: 'This module is currently unavailable.',
  actionLabel: 'Retry',
})

export const SessionExpiredState = createStateComponent('SessionExpiredState', {
  title: 'Session expired',
  message: 'Sign in again to continue.',
  actionLabel: 'Sign in',
})
