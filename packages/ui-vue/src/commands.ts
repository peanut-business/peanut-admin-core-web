import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';

export interface ShellCommand { id: string; label: string; run: () => void | Promise<void>; disabled?: boolean }
/** Commands are supplied by the host after its own authorization checks. */
export const CommandPalette = defineComponent({
  name: 'CommandPalette',
  props: { commands: { type: Array as PropType<readonly ShellCommand[]>, required: true }, label: { type: String, default: 'Commands' } },
  emits: ['error'],
  setup(props, { emit }) {
    const open = ref(false); const query = ref(''); const input = ref<HTMLInputElement>(); const dialog = ref<HTMLElement>();
    let previous: HTMLElement | null = null;
    const close = () => { open.value = false; previous?.focus(); previous = null; };
    const show = () => { previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; query.value = ''; open.value = true; void nextTick(() => input.value?.focus()); };
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (open.value) close(); else show(); }
      else if (open.value && event.key === 'Escape') { event.preventDefault(); close(); }
      else if (open.value && event.key === 'Tab' && dialog.value) {
        const items = Array.from(dialog.value.querySelectorAll<HTMLElement>('input, button:not(:disabled)'));
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    onMounted(() => window.addEventListener('keydown', keydown));
    onBeforeUnmount(() => window.removeEventListener('keydown', keydown));
    return () => open.value ? h('div', { ref: dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': props.label, class: 'peanut-command-palette' }, [
      h('input', { ref: input, value: query.value, 'aria-label': props.label, onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; } }),
      h('ul', props.commands.filter(command => command.label.toLowerCase().includes(query.value.toLowerCase())).map(command => h('li', { key: command.id }, [
        h('button', { type: 'button', disabled: command.disabled, onClick: () => { close(); void Promise.resolve().then(() => command.run()).catch(error => emit('error', error, command)); } }, command.label),
      ]))),
      h('button', { type: 'button', onClick: close }, 'Close'),
    ]) : null;
  },
});

export const ShellTabContextMenu = defineComponent({
  name: 'ShellTabContextMenu',
  props: {
    labels: { type: Object as PropType<Record<'refresh' | 'left' | 'right' | 'other' | 'all', string>>, required: true },
    disabled: { type: Array as PropType<readonly string[]>, default: () => [] },
  },
  emits: ['action'],
  setup(props, { slots, emit }) {
    const open = ref(false);
    const trigger = ref<HTMLElement>();
    const menu = ref<HTMLElement>();
    const close = () => { open.value = false; trigger.value?.focus(); };
    const show = (event: MouseEvent) => { event.preventDefault(); open.value = true; void nextTick(() => menu.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()); };
    return () => h('span', { ref: trigger, tabindex: 0, onContextmenu: show, onKeydown: (event: KeyboardEvent) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) show(event as unknown as MouseEvent);
      if (event.key === 'Escape' && open.value) close();
    } }, [slots.default?.(), open.value ? h('div', { ref: menu, role: 'menu' }, (['refresh', 'left', 'right', 'other', 'all'] as const).map(action => h('button', {
      type: 'button', role: 'menuitem', disabled: props.disabled.includes(action), onClick: () => { close(); emit('action', action); },
    }, props.labels[action]))) : null]);
  },
});
