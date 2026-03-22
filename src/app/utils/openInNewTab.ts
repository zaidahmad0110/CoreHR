export const openInNewTab = (url: string): void => {
  const isBlobUrl = url.startsWith("blob:");
  const features = isBlobUrl ? "noopener" : "noopener,noreferrer";
  const openedWindow = window.open(url, "_blank", features);
  if (openedWindow) {
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = isBlobUrl ? "noopener" : "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const openBlobInNewTab = (blob: Blob, revokeAfterMs = 60000): void => {
  const fileUrl = window.URL.createObjectURL(blob);
  openInNewTab(fileUrl);
  window.setTimeout(() => {
    window.URL.revokeObjectURL(fileUrl);
  }, revokeAfterMs);
};
