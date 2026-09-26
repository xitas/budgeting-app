// Saves an in-memory file via a temporary object URL. Used for downloads
// that need the auth header (so a plain <a href> to the API won't do).
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking right away cancels the download in Chrome (the browser reads
  // the object URL asynchronously after the click). Give it time first —
  // 40s is the same margin FileSaver.js settled on.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}
