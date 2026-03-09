import type { ProviderName } from '../providers/index.js';

export function shouldApplyLoadedProviderKey(
  requestId: number,
  latestRequestId: number,
  requestedProvider: ProviderName,
  activeProvider: ProviderName,
): boolean {
  return requestId === latestRequestId && requestedProvider === activeProvider;
}
