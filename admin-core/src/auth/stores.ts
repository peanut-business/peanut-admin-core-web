import { defineStore } from 'pinia'

export interface TenantContextData {
  audience: 'tenant'
  accountId: string
  tenantId: string
  memberId: string
  moduleKeys: readonly string[]
  permissionKeys: readonly string[]
  authorizationRevision: string
}

export interface PlatformContextData {
  audience: 'platform'
  accountId: string
  operatorId: string
  permissionKeys: readonly string[]
  authorizationRevision: string
}

interface AuthState {
  accessToken: string | null
  generation: number
  status: 'anonymous' | 'authenticated' | 'refreshing'
}

const authState = (): AuthState => ({
  accessToken: null,
  generation: 0,
  status: 'anonymous',
})

const authActions = {
  replaceAccessToken(this: AuthState, token: string): void {
    if (token === '') {
      throw new Error('AUTH_ACCESS_TOKEN_EMPTY')
    }
    this.accessToken = token
    this.status = 'authenticated'
  },
  markRefreshing(this: AuthState): void {
    this.status = 'refreshing'
  },
  clear(this: AuthState): void {
    this.accessToken = null
    this.status = 'anonymous'
    this.generation += 1
  },
}

export const useTenantAuth = defineStore('peanut-admin-tenant-auth', {
  state: authState,
  actions: authActions,
})

export const usePlatformAuth = defineStore('peanut-admin-platform-auth', {
  state: authState,
  actions: authActions,
})

interface TenantContextState {
  value: TenantContextData | null
  generation: number
}

export const useTenantContext = defineStore('peanut-admin-tenant-context', {
  state: (): TenantContextState => ({ value: null, generation: 0 }),
  getters: {
    accountId: state => state.value?.accountId ?? null,
    tenantId: state => state.value?.tenantId ?? null,
    memberId: state => state.value?.memberId ?? null,
    authorizationRevision: state => state.value?.authorizationRevision ?? null,
    moduleSet: state => new Set(state.value?.moduleKeys ?? []),
    permissionSet: state => new Set(state.value?.permissionKeys ?? []),
  },
  actions: {
    replace(context: TenantContextData): void {
      if (context.audience !== 'tenant') {
        throw new Error('CONTEXT_AUDIENCE_MISMATCH')
      }
      this.value = {
        ...context,
        moduleKeys: [...context.moduleKeys],
        permissionKeys: [...context.permissionKeys],
      }
      this.generation += 1
    },
    clear(): void {
      this.value = null
      this.generation += 1
    },
  },
})

interface PlatformContextState {
  value: PlatformContextData | null
  generation: number
}

export const usePlatformContext = defineStore('peanut-admin-platform-context', {
  state: (): PlatformContextState => ({ value: null, generation: 0 }),
  getters: {
    accountId: state => state.value?.accountId ?? null,
    operatorId: state => state.value?.operatorId ?? null,
    authorizationRevision: state => state.value?.authorizationRevision ?? null,
    permissionSet: state => new Set(state.value?.permissionKeys ?? []),
  },
  actions: {
    replace(context: PlatformContextData): void {
      if (context.audience !== 'platform') {
        throw new Error('CONTEXT_AUDIENCE_MISMATCH')
      }
      this.value = { ...context, permissionKeys: [...context.permissionKeys] }
      this.generation += 1
    },
    clear(): void {
      this.value = null
      this.generation += 1
    },
  },
})
