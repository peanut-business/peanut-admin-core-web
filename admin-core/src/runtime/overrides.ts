export type AdminOverrideKind = 'service' | 'component' | 'page' | 'route'

export type AdminOverrideSource = 'default' | 'application'

export interface AdminOverrideSlot<Value = unknown> {
  readonly key: string
  readonly kind: AdminOverrideKind
  readonly contractVersion: string
  readonly defaultValue: Value
  readonly validate?: (value: unknown) => value is Value
}

export interface AdminOverride<Value = unknown> {
  readonly key: string
  readonly kind: AdminOverrideKind
  readonly contractVersion: string
  readonly value: Value
}

export interface AdminOverrideResolution<Value = unknown> {
  readonly key: string
  readonly kind: AdminOverrideKind
  readonly contractVersion: string
  readonly value: Value
  readonly source: AdminOverrideSource
}

export type AdminOverrideResolutionMetadata = Omit<AdminOverrideResolution, 'value'>

export interface AdminOverrideRegistryInput<
  Slots extends readonly AdminOverrideSlot[] = readonly AdminOverrideSlot[],
> {
  readonly slots: Slots
  readonly overrides?: readonly AdminOverride[]
}

type SlotValue<Slots extends readonly AdminOverrideSlot[], Key extends string> =
  Extract<Slots[number], { readonly key: Key }> extends infer Slot
    ? Slot extends AdminOverrideSlot<infer Value> ? Value : unknown
    : unknown

type SlotKey<Slots extends readonly AdminOverrideSlot[]> = Slots[number]['key'] & string

export interface AdminOverrideRegistry<
  Slots extends readonly AdminOverrideSlot[] = readonly AdminOverrideSlot[],
> {
  resolve<Key extends SlotKey<Slots>>(key: Key): AdminOverrideResolution<SlotValue<Slots, Key>>
  get<Key extends SlotKey<Slots>>(key: Key): SlotValue<Slots, Key>
  diagnostics(): readonly AdminOverrideResolutionMetadata[]
}

const overrideKinds: readonly AdminOverrideKind[] = ['service', 'component', 'page', 'route']
const overrideKindSet = new Set<AdminOverrideKind>(overrideKinds)
const overrideKeyPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*){2,}$/
const contractVersionPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const hasOwn = (value: object, key: PropertyKey): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
)

const fail = (code: string, detail?: string): never => {
  throw new Error(detail === undefined ? code : `${code}: ${detail}`)
}

const validateKey = (value: unknown, kind: unknown): string => {
  if (typeof value !== 'string' || !overrideKeyPattern.test(value)) {
    return fail('ADMIN_OVERRIDE_SLOT_KEY_INVALID', typeof value === 'string' ? value : 'unknown')
  }
  if (typeof kind !== 'string' || !overrideKindSet.has(kind as AdminOverrideKind)) {
    return fail('ADMIN_OVERRIDE_KIND_INVALID', String(kind))
  }
  if (!value.split('.').includes(kind)) {
    return fail('ADMIN_OVERRIDE_SLOT_KEY_KIND_INVALID', value)
  }
  return value
}

const validateVersion = (value: unknown): string => {
  if (typeof value !== 'string' || !contractVersionPattern.test(value)) {
    return fail('ADMIN_OVERRIDE_CONTRACT_VERSION_INVALID', typeof value === 'string' ? value : 'unknown')
  }
  return value
}

const validatorAccepts = (validator: (value: unknown) => boolean, value: unknown): boolean => {
  try {
    return validator(value) === true
  } catch {
    return false
  }
}

const freezeMetadata = (
  metadata: AdminOverrideResolutionMetadata,
): AdminOverrideResolutionMetadata => Object.freeze({ ...metadata })

const freezeResolution = <Value>(
  resolution: AdminOverrideResolution<Value>,
): AdminOverrideResolution<Value> => Object.freeze({ ...resolution })

const copyMetadata = (
  metadata: readonly AdminOverrideResolutionMetadata[],
): readonly AdminOverrideResolutionMetadata[] => Object.freeze(
  metadata.map(entry => freezeMetadata(entry)),
)

export const defineAdminOverrideSlot = <Value, Slot extends AdminOverrideSlot<Value>>(
  slot: Slot,
): Slot => slot

export const createAdminOverrideRegistry = <
  Slots extends readonly AdminOverrideSlot[],
>(input: AdminOverrideRegistryInput<Slots>): AdminOverrideRegistry<Slots> => {
  if (!isRecord(input) || !Array.isArray(input.slots)) {
    fail('ADMIN_OVERRIDE_SLOTS_INVALID')
  }
  if (input.overrides !== undefined && !Array.isArray(input.overrides)) {
    fail('ADMIN_OVERRIDE_OVERRIDES_INVALID')
  }

  const slots = new Map<string, AdminOverrideSlot>()
  for (const rawSlot of input.slots) {
    if (!isRecord(rawSlot)) fail('ADMIN_OVERRIDE_SLOT_INVALID')

    const key = validateKey(rawSlot.key, rawSlot.kind)
    if (slots.has(key)) fail('ADMIN_OVERRIDE_SLOT_KEY_DUPLICATE', key)

    if (!hasOwn(rawSlot, 'contractVersion')) {
      fail('ADMIN_OVERRIDE_CONTRACT_VERSION_INVALID', key)
    }
    const contractVersion = validateVersion(rawSlot.contractVersion)
    if (!hasOwn(rawSlot, 'defaultValue')) {
      fail('ADMIN_OVERRIDE_DEFAULT_INVALID', key)
    }
    if (rawSlot.validate !== undefined && typeof rawSlot.validate !== 'function') {
      fail('ADMIN_OVERRIDE_VALIDATOR_INVALID', key)
    }
    const slot = rawSlot as unknown as AdminOverrideSlot
    if (slot.validate !== undefined && !validatorAccepts(slot.validate, slot.defaultValue)) {
      fail('ADMIN_OVERRIDE_DEFAULT_INVALID', key)
    }

    slots.set(key, Object.freeze({
      key,
      kind: rawSlot.kind as AdminOverrideKind,
      contractVersion,
      defaultValue: slot.defaultValue,
      ...(slot.validate === undefined ? {} : { validate: slot.validate }),
    }))
  }

  const values = new Map<string, AdminOverrideResolution>()
  for (const [key, slot] of slots) {
    values.set(key, freezeResolution({
      key,
      kind: slot.kind,
      contractVersion: slot.contractVersion,
      value: slot.defaultValue,
      source: 'default',
    }))
  }

  const seenOverrides = new Set<string>()
  for (const rawOverride of input.overrides ?? []) {
    if (!isRecord(rawOverride) || typeof rawOverride.key !== 'string') {
      fail('ADMIN_OVERRIDE_OVERRIDE_KEY_INVALID')
    }
    const key = rawOverride.key
    if (seenOverrides.has(key)) fail('ADMIN_OVERRIDE_KEY_DUPLICATE', key)
    seenOverrides.add(key)

    const slot = slots.get(key) ?? fail('ADMIN_OVERRIDE_KEY_UNKNOWN', key)
    if (rawOverride.kind !== slot.kind) {
      fail('ADMIN_OVERRIDE_KIND_MISMATCH', key)
    }
    if (rawOverride.contractVersion !== slot.contractVersion) {
      fail('ADMIN_OVERRIDE_CONTRACT_VERSION_MISMATCH', key)
    }
    if (!hasOwn(rawOverride, 'value')) fail('ADMIN_OVERRIDE_VALUE_INVALID', key)

    const value = rawOverride.value
    if (slot.validate !== undefined && !validatorAccepts(slot.validate, value)) {
      fail('ADMIN_OVERRIDE_VALUE_INVALID', key)
    }

    values.set(key, freezeResolution({
      key,
      kind: slot.kind,
      contractVersion: slot.contractVersion,
      value,
      source: 'application',
    }))
  }

  const metadata = [...values.values()].map(({ key, kind, contractVersion, source }) => (
    freezeMetadata({ key, kind, contractVersion, source })
  ))

  const resolve = <Value>(key: string): AdminOverrideResolution<Value> => {
    const resolution = values.get(key)
    if (resolution === undefined) fail('ADMIN_OVERRIDE_SLOT_UNKNOWN', key)
    return resolution as AdminOverrideResolution<Value>
  }

  return {
    resolve,
    get: <Value>(key: string): Value => resolve<Value>(key).value,
    diagnostics: () => copyMetadata(metadata),
  } as AdminOverrideRegistry<Slots>
}
