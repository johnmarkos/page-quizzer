const SUPPORTED_INJECTION_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function isMissingContentScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Receiving end does not exist');
}

export function hasUnsupportedInjectionProtocol(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  try {
    const protocol = new URL(url).protocol;
    return !SUPPORTED_INJECTION_PROTOCOLS.has(protocol);
  } catch {
    return true;
  }
}

export function buildContentScriptAccessError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('Cannot access contents of url') ||
    message.includes('The extensions gallery cannot be scripted') ||
    message.includes('Missing host permission for the tab')
  ) {
    return new Error('PageQuizzer cannot access this page. Chrome blocks extension scripts here.');
  }

  return new Error(`Failed to attach PageQuizzer to this tab: ${message}`);
}

export function isHostPermissionInjectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension manifest must request permission to access the respective host');
}

export function buildOriginPermissionPattern(url?: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}
