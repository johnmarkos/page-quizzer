import type { ProviderName } from '../providers/index.js';

export type ConnectionSettings = {
  provider: ProviderName;
  apiKey: string;
  model?: string;
};

export function resolveConnectionSettings(
  stored: ConnectionSettings,
  override?: Partial<ConnectionSettings>,
): ConnectionSettings {
  const provider = override?.provider ?? stored.provider;
  const model = override?.model !== undefined
    ? override.model
    : provider === stored.provider
      ? stored.model
      : undefined;

  return {
    provider,
    apiKey: override?.apiKey ?? stored.apiKey,
    model,
  };
}
