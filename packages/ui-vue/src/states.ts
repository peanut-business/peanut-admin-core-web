import { ElButton } from 'element-plus'
import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'

interface StateDefaults {
  title: string
  message: string
  actionLabel?: string
}

const createStateComponent = (name: string, state: string, defaults: StateDefaults) => defineComponent({
  name,
  props: {
    title: { type: String, default: defaults.title },
    message: { type: String, default: defaults.message },
    requestId: { type: String, default: null },
    retryAfter: { type: String as PropType<string | null>, default: null },
    actionLabel: { type: String, default: defaults.actionLabel ?? null },
    onAction: { type: Function as PropType<() => void>, default: null },
  },
  emits: {
    action: () => true,
  },
  setup(props, { emit, slots }) {
    return () => h('section', {
      class: ['pa-state', `pa-state--${name.replace(/State$/, '').toLowerCase()}`],
      'data-state': state,
      role: 'status',
      'aria-live': 'polite',
    }, [
      h('h2', { class: 'pa-state__title' }, props.title),
      h('p', { class: 'pa-state__message' }, props.message),
      props.requestId === null
        ? null
        : h('p', { class: 'pa-state__request-id' }, `Request ID: ${props.requestId}`),
      props.retryAfter === null
        ? null
        : h('p', { class: 'pa-state__retry-after' }, `Retry after: ${props.retryAfter}`),
      slots.default?.(),
      props.actionLabel === null
        ? null
        : h(ElButton, {
            onClick: () => {
              emit('action')
            },
          }, () => props.actionLabel),
    ])
  },
})

export const EmptyState = createStateComponent('EmptyState', 'empty', {
  title: 'No data',
  message: 'There is nothing to display.',
})

export const ForbiddenState = createStateComponent('ForbiddenState', 'forbidden', {
  title: 'Access denied',
  message: 'You do not have permission to view this page.',
})

export const NotFoundState = createStateComponent('NotFoundState', 'not-found', {
  title: 'Not found',
  message: 'The requested resource is unavailable.',
})

export const ModuleUnavailableState = createStateComponent('ModuleUnavailableState', 'module-unavailable', {
  title: 'Module unavailable',
  message: 'This module is currently unavailable.',
  actionLabel: 'Retry',
})

export const ConflictState = createStateComponent('ConflictState', 'conflict', {
  title: 'Content changed',
  message: 'Reload the latest version before continuing.',
  actionLabel: 'Reload',
})

export const RateLimitState = createStateComponent('RateLimitState', 'rate-limit', {
  title: 'Too many requests',
  message: 'Wait before trying again.',
})

export const ServiceUnavailableState = createStateComponent('ServiceUnavailableState', 'service-unavailable', {
  title: 'Service unavailable',
  message: 'The service is temporarily unavailable.',
  actionLabel: 'Retry',
})

export const SessionExpiredState = createStateComponent('SessionExpiredState', 'session-expired', {
  title: 'Session expired',
  message: 'Sign in again to continue.',
  actionLabel: 'Sign in',
})
