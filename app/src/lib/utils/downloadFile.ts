/**
 * Triggers a client-side file download in a robust, cross-browser manner.
 * Ensures the Object URL is not revoked prematurely before the browser
 * finishes writing the file to disk (which causes corrupt or truncated files).
 */
export function triggerFileDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Allow ample time for the browser/OS to stream the blob to disk before revoking
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}
