/* eslint-disable vue/one-component-per-file */

import { defineComponent, h } from 'vue'

const ShellFrame = defineComponent({
  name: 'ShellFrame',
  inheritAttrs: false,
  props: {
    audience: {
      type: String as () => 'tenant' | 'platform',
      required: true,
    },
  },
  setup(props, { attrs, slots }) {
    return () => h('div', {
      ...attrs,
      class: ['pa-shell', `pa-shell--${props.audience}`, attrs.class],
      'data-audience': props.audience,
    }, [
      slots.header?.(),
      h('div', { class: 'pa-shell__workspace' }, [
        slots.sidebar?.(),
        h('div', { class: 'pa-shell__main' }, [
          slots.breadcrumb?.(),
          slots.tabs?.(),
          slots.default?.(),
        ]),
      ]),
    ])
  },
})

export const AdminShell = defineComponent({
  name: 'AdminShell',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(ShellFrame, { ...attrs, audience: 'tenant' }, slots)
  },
})

export const PlatformShell = defineComponent({
  name: 'PlatformShell',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(ShellFrame, { ...attrs, audience: 'platform' }, slots)
  },
})

export const ShellHeader = defineComponent({
  name: 'ShellHeader',
  setup(_, { slots }) {
    return () => h('header', { class: 'pa-shell-header' }, slots.default?.())
  },
})

export const ShellSidebar = defineComponent({
  name: 'ShellSidebar',
  props: {
    label: { type: String, default: 'Primary navigation' },
    collapsed: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => h('aside', {
      class: ['pa-shell-sidebar', { 'is-collapsed': props.collapsed }],
      'aria-label': props.label,
    }, slots.default?.())
  },
})

export const ShellBreadcrumb = defineComponent({
  name: 'ShellBreadcrumb',
  props: {
    label: { type: String, default: 'Breadcrumb' },
  },
  setup(props, { slots }) {
    return () => h('nav', { class: 'pa-shell-breadcrumb', 'aria-label': props.label }, slots.default?.())
  },
})

export const ShellTabs = defineComponent({
  name: 'ShellTabs',
  props: {
    label: { type: String, default: 'Open pages' },
  },
  setup(props, { slots }) {
    return () => h('nav', { class: 'pa-shell-tabs', 'aria-label': props.label }, slots.default?.())
  },
})

export const PageHeader = defineComponent({
  name: 'PageHeader',
  setup(_, { slots }) {
    return () => h('header', { class: 'pa-page-header' }, [
      h('div', { class: 'pa-page-header__title' }, slots.default?.()),
      slots.actions === undefined
        ? null
        : h('div', { class: 'pa-page-header__actions' }, slots.actions()),
    ])
  },
})

export const PageToolbar = defineComponent({
  name: 'PageToolbar',
  props: {
    label: { type: String, default: 'Page actions' },
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: 'pa-page-toolbar',
      role: 'toolbar',
      'aria-label': props.label,
    }, slots.default?.())
  },
})

export const PageContent = defineComponent({
  name: 'PageContent',
  setup(_, { slots }) {
    return () => h('section', { class: 'pa-page-content' }, slots.default?.())
  },
})
