// ============================================================================
// Utils Index - 统一导出工具函数
// ============================================================================

// Deep Merge
export { deepMerge, deepMergeAll, MERGE_REPLACE, MERGE_DEEP, MERGE_APPEND, MERGE_CONSERVATIVE } from './deepMerge';
export type { DeepMergeOptions, MergeStrategy } from './deepMerge';

// API Version
export {
  registerTransformer,
  getVersionFallbackChain,
  saveLastSuccessVersion,
  getLastSuccessVersion,
  getPreferredVersion,
  apiCallWithVersion,
  fetchConfigWithVersion,
  fetchConfigWithFallbackUrls,
} from './apiVersion';
export type {
  ApiVersion,
  ApiVersionInfo,
  ApiVersionResponse,
  VersionedRequest,
  VersionedResponse,
  ApiCallOptions,
} from './apiVersion';

// API Client
export { apiClient, apiGet, apiPost, clearCache, getCacheStats } from './apiClient';
export type { ApiClientOptions } from './apiClient';
