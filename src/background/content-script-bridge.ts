import { buildOriginPermissionPattern } from '../shared/site-access.js';

const SUPPORTED_INJECTION_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
const CONTENT_SCRIPT_ATTACH_ERROR_TAG = '[attach-v2]';

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
    return new Error(`${CONTENT_SCRIPT_ATTACH_ERROR_TAG} PageQuizzer cannot access this page. Chrome blocks extension scripts here.`);
  }

  return new Error(`${CONTENT_SCRIPT_ATTACH_ERROR_TAG} Failed to attach PageQuizzer to this tab: ${message}`);
}

export function isHostPermissionInjectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension manifest must request permission to access the respective host');
}
