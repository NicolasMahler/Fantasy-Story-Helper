/** Triggers a browser download of in-memory data. */
export function download(data: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** e.g. fantasy-helper-2026-11-18.sqlite */
export function backupName(ext: string): string {
  return `fantasy-helper-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
