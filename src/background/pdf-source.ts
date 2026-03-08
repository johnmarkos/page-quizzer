export function isLocalFilePdfUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'file:';
  } catch {
    return false;
  }
}

export function buildLocalPdfAccessError(): Error {
  return new Error(
    'Local PDF access is blocked. In chrome://extensions, enable "Allow access to file URLs" for PageQuizzer, then reload the extension and reopen the PDF.',
  );
}
