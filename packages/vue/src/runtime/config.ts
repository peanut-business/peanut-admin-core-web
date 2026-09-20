export interface AdminAudienceHostConfig {
  baseUrl: string
  allowedOrigin: string
  clientKey: string
}

export interface AdminHostConfig {
  tenant: AdminAudienceHostConfig
  platform: AdminAudienceHostConfig
}

const clientKeyPattern = /^[a-z][a-z0-9-]{0,63}$/

const parseAuthority = (value: string): URL => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('ADMIN_HOST_ORIGIN_INVALID')
  }

  if (!['http:', 'https:'].includes(url.protocol)
    || url.origin === 'null'
    || url.username !== ''
    || url.password !== ''
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== '') {
    throw new Error('ADMIN_HOST_ORIGIN_INVALID')
  }

  return url
}

const defineAudienceConfig = (config: AdminAudienceHostConfig): AdminAudienceHostConfig => {
  const baseUrl = parseAuthority(config.baseUrl)
  const allowedOrigin = parseAuthority(config.allowedOrigin)
  if (baseUrl.origin !== allowedOrigin.origin) {
    throw new Error('ADMIN_HOST_ORIGIN_MISMATCH')
  }
  if (!clientKeyPattern.test(config.clientKey)) {
    throw new Error('ADMIN_HOST_CLIENT_KEY_INVALID')
  }

  return {
    baseUrl: baseUrl.origin,
    allowedOrigin: allowedOrigin.origin,
    clientKey: config.clientKey,
  }
}

export const defineAdminHostConfig = (config: AdminHostConfig): AdminHostConfig => ({
  tenant: defineAudienceConfig(config.tenant),
  platform: defineAudienceConfig(config.platform),
})
