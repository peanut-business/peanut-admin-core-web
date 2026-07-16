export type TenantDisposer = () => void | Promise<void>

const tenantDisposers = new Map<string, TenantDisposer>()

export const registerTenantDisposer = (key: string, disposer: TenantDisposer): (() => void) => {
  if (key === '' || tenantDisposers.has(key)) {
    throw new Error(`TENANT_DISPOSER_DUPLICATE: ${key}`)
  }
  tenantDisposers.set(key, disposer)

  return () => {
    if (tenantDisposers.get(key) === disposer) {
      tenantDisposers.delete(key)
    }
  }
}

export const disposeTenantState = async (): Promise<void> => {
  const disposers = [...tenantDisposers.values()]
  await Promise.all(disposers.map(async disposer => disposer()))
}
