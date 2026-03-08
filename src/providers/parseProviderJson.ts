/**
 * Parse a JSON string from a provider response, throwing a descriptive
 * error that names the provider when parsing fails.
 */
export function parseProviderJson<T>(content: string, providerName: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Failed to parse ${providerName} response as JSON`);
  }
}
