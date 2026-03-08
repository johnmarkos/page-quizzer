const SUPPORTED_INJECTION_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function isMissingContentScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Receiving end does not exist');
}

export function canInjectContentScript(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  try {
    const protocol = new URL(url).protocol;
    return SUPPORTED_INJECTION_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
}
