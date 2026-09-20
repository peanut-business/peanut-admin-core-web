export interface TenantChoice {
  tenant_id: number
  tenant_code: string
  tenant_name: string
  member_id: number
  member_display_name: string
}

export interface TenantSelection {
  state: 'tenant_selection_required'
  challenge_token: string
  expires_at: string
  tenants: TenantChoice[]
}

export interface TenantAuthentication {
  state: 'authenticated'
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  context: {
    tenant_id: string
    account_id: string
    tenant_member_id: string
  }
}

export type TenantSessionOutcome = TenantSelection | TenantAuthentication

export const isMultiTenantDeployment = (value: unknown): boolean => value === 'multi-tenant'

export const isTenantAccessToken = (token: string | null): boolean => token?.startsWith('pa_tat_') === true
