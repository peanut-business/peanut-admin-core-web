export interface ShellHostConfigInput {
  brand: {
    name: string
    mark: string
  }
  audiences: {
    tenant: { label: string }
    platform: { label: string }
  }
  commands: {
    switchTenantLabel: string
    logoutLabel: string
  }
}

export interface ShellHostConfig {
  readonly brand: Readonly<ShellHostConfigInput['brand']>
  readonly audiences: Readonly<{
    tenant: Readonly<ShellHostConfigInput['audiences']['tenant']>
    platform: Readonly<ShellHostConfigInput['audiences']['platform']>
  }>
  readonly commands: Readonly<ShellHostConfigInput['commands']>
}

const assertObject = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`SHELL_CONFIG_INVALID:${path}`)
  }
  return value as Record<string, unknown>
}

const assertKnownFields = (value: Record<string, unknown>, allowed: readonly string[], path = ''): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`SHELL_CONFIG_UNKNOWN_FIELD:${path}${key}`)
    }
  }
}

const displayValue = (value: unknown, path: string, maximum: number): string => {
  if (typeof value !== 'string') throw new Error(`SHELL_CONFIG_INVALID:${path}`)
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new Error(`SHELL_CONFIG_INVALID:${path}`)
  }
  return normalized
}

export const defineShellHostConfig = (input: ShellHostConfigInput): ShellHostConfig => {
  const root = assertObject(input, 'root')
  assertKnownFields(root, ['brand', 'audiences', 'commands'])

  const brandInput = assertObject(root.brand, 'brand')
  const audiencesInput = assertObject(root.audiences, 'audiences')
  const tenantInput = assertObject(audiencesInput.tenant, 'audiences.tenant')
  const platformInput = assertObject(audiencesInput.platform, 'audiences.platform')
  const commandsInput = assertObject(root.commands, 'commands')
  assertKnownFields(brandInput, ['name', 'mark'], 'brand.')
  assertKnownFields(audiencesInput, ['tenant', 'platform'], 'audiences.')
  assertKnownFields(tenantInput, ['label'], 'audiences.tenant.')
  assertKnownFields(platformInput, ['label'], 'audiences.platform.')
  assertKnownFields(commandsInput, ['switchTenantLabel', 'logoutLabel'], 'commands.')

  const brand = Object.freeze({
    name: displayValue(brandInput.name, 'brand.name', 120),
    mark: displayValue(brandInput.mark, 'brand.mark', 12),
  })
  const tenant = Object.freeze({
    label: displayValue(tenantInput.label, 'audiences.tenant.label', 80),
  })
  const platform = Object.freeze({
    label: displayValue(platformInput.label, 'audiences.platform.label', 80),
  })
  const commands = Object.freeze({
    switchTenantLabel: displayValue(commandsInput.switchTenantLabel, 'commands.switchTenantLabel', 80),
    logoutLabel: displayValue(commandsInput.logoutLabel, 'commands.logoutLabel', 80),
  })

  return Object.freeze({
    brand,
    audiences: Object.freeze({ tenant, platform }),
    commands,
  })
}
