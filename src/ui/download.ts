/** Blob 을 파일로 내려받기 (외부 라이브러리 없이) */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 일부 브라우저는 click 직후 revoke 하면 다운로드가 취소되므로 약간 늦춘다
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
