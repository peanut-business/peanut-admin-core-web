import { onScopeDispose, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { createSingleFlight, raceAbortSignal } from '@peanut-admin/client';

const flight = createSingleFlight<unknown>();
const generations = reactive(new Map<string, number>());
const cache = new Map<string, { value: unknown; expiresAt: number }>();
const maxEntries = 256;
const controllers = new Map<string, AbortController>();
const keyFor = (namespace: string, key: string) => JSON.stringify([namespace, key]);

export function invalidateDict(namespace: string, key: string) {
  const id = keyFor(namespace, key);
  cache.delete(id);
  generations.set(id, (generations.get(id) ?? 0) + 1);
  controllers.get(id)?.abort();
  controllers.delete(id);
}

export function useDict<T>(options: {
  namespace: MaybeRefOrGetter<string>;
  key: string;
  load: (signal: AbortSignal) => Promise<T>;
  ttlMs?: number;
}) {
  const data = shallowRef<T>();
  const loading = ref(false);
  const error = shallowRef<unknown>();
  let revision = 0;
  let local = new AbortController();
  const cancel = () => {
    revision++;
    local.abort();
    local = new AbortController();
    loading.value = false;
  };
  const load = async () => {
    cancel();
    const current = revision;
    const id = keyFor(toValue(options.namespace), options.key);
    const generation = generations.get(id) ?? 0;
    loading.value = true;
    error.value = undefined;
    const cached = cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      data.value = cached.value as T;
      loading.value = false;
      return true;
    }
    cache.delete(id);
    try {
      const value = await raceAbortSignal(flight.run(`${id}:${generation}`, () => {
        const controller = new AbortController();
        controllers.set(id, controller);
        return raceAbortSignal(options.load(controller.signal), controller.signal).finally(() => {
          if (controllers.get(id) === controller) controllers.delete(id);
        });
      }) as Promise<T>, local.signal);
      if (revision !== current || (generations.get(id) ?? 0) !== generation) return false;
      const ttl = Math.max(0, options.ttlMs ?? 300_000);
      if (ttl > 0) {
        if (cache.size >= maxEntries) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(id, { value, expiresAt: Date.now() + ttl });
      }
      data.value = value;
      return true;
    } catch (cause) {
      if (revision === current && (generations.get(id) ?? 0) === generation) error.value = cause;
      return false;
    } finally {
      if (revision === current) loading.value = false;
    }
  };
  const invalidate = () => {
    invalidateDict(toValue(options.namespace), options.key);
    cancel();
    data.value = undefined;
  };
  watch(() => {
    const id = keyFor(toValue(options.namespace), options.key);
    return [id, generations.get(id) ?? 0] as const;
  }, () => {
    cancel();
    data.value = undefined;
    error.value = undefined;
  }, { flush: 'sync' });
  onScopeDispose(cancel);
  return { data, loading, error, load, cancel, invalidate };
}
