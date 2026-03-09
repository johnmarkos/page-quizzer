import type { ProviderName } from '../providers/index.js';

export function shouldApplyLoadedProviderKey(
  requestId: number,
  latestRequestId: number,
  requestedProvider: ProviderName,
  activeProvider: ProviderName,
): boolean {
  return requestId === latestRequestId && requestedProvider === activeProvider;
}

export function resolveDisplayedProviderApiKey(
  providerValue: unknown,
  legacyValue: unknown,
  hasProviderValue: boolean,
): string {
  if (hasProviderValue) {
    return typeof providerValue === 'string' ? providerValue : '';
  }

  return typeof legacyValue === 'string' ? legacyValue : '';
}
