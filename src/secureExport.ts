/** Manual export helpers. They never upload or store the document remotely. */
export async function createIntegrityExport(payload: Record<string, unknown>) {
  const material = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(material);
  const sha = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(sha), x => x.toString(16).padStart(2, "0")).join("");
  return JSON.stringify({
    format: "wimm-manual-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    integrity: { algorithm: "SHA-256", contentHash: hash },
    ...payload,
  }, null, 2);
}

export async function sendFile(name: string, content: string, mime: string) {
  const file = new File([content], name, { type: mime });
  const navigatorWithShare = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  // iOS installed PWA: let users save to Files via native share sheet.
  if (navigatorWithShare.share && navigatorWithShare.canShare?.({ files: [file] })) {
    try {
      await navigatorWithShare.share({ files: [file], title: "Sauvegarde Wimm" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Fall back to a browser download.
    }
  }
  const href = URL.createObjectURL(file);
  try {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(href), 60000);
  }
}
