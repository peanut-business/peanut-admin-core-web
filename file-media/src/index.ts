export const FILE_MEDIA_PACKAGE = '@peanut-admin/admin/file-media' as const
export const FILE_MEDIA_VERSION = '0.1.0' as const
export { default as FileAssetSelector } from './FileAssetSelector.vue'
export { parseAssetCandidate, parseFileList, parseFileObject, parseFileResponse } from './contracts'
export type { AssetCandidate, AssetList, FileList, FileMediaTransport, FileObject, FileStatus, FileTransportResult, ImageVariant } from './contracts'
export {
  createFileMediaModuleContribution,
  createFileMediaRuntime,
  FILE_MEDIA_CREATE_PERMISSION,
  FILE_MEDIA_DELETE_PERMISSION,
  FILE_MEDIA_MODULE_KEY,
  FILE_MEDIA_READ_PERMISSION,
  FILE_MEDIA_ROUTE_NAME,
  FILE_MEDIA_ROUTE_PATH,
  FILE_MEDIA_STORE_KEY,
  fileMediaRuntimeKey,
  useFileMediaRuntime,
} from './runtime'
export type { FileMediaError, FileMediaRuntime, FileMediaRuntimeOptions, FileMediaState } from './runtime'
