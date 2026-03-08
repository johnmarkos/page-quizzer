export function isLocalFilePdfUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'file:';
  } catch {
    return false;
  }
}

type FileSchemeAccessChecker = (callback: (isAllowedAccess: boolean) => void) => void;

export async function hasAllowedFileSchemeAccess(
  checker: FileSchemeAccessChecker | undefined = getDefaultFileSchemeAccessChecker(),
): Promise<boolean> {
  if (!checker) {
    return false;
  }

  return await new Promise(resolve => {
    try {
      checker((isAllowedAccess) => resolve(isAllowedAccess));
    } catch {
      resolve(false);
    }
  });
}

export function buildLocalPdfAccessError(): Error {
  return new Error(
    'Local PDF access is blocked. In chrome://extensions, enable "Allow access to file URLs" for PageQuizzer, then reload the extension and reopen the PDF.',
  );
}

export function buildLocalPdfReadError(): Error {
  return new Error(
    'PageQuizzer could not read this local PDF. Confirm "Allow access to file URLs" is enabled for PageQuizzer, reload the extension, reopen the PDF, and make sure the file still exists at the same path.',
  );
}

function getDefaultFileSchemeAccessChecker(): FileSchemeAccessChecker | undefined {
  if (typeof chrome === 'undefined' || !chrome.extension?.isAllowedFileSchemeAccess) {
    return undefined;
  }

  return chrome.extension.isAllowedFileSchemeAccess.bind(chrome.extension);
}
