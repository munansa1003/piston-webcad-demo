/**
 * 단일 파일(아티팩트) 빌드용 다운로드. claude.ai 아티팩트 뷰어는 일반 다운로드 링크를 막고
 * `downloads` 기능(window.claude.use("downloads"))으로만 파일을 건넨다.
 * 허용 확장자 목록에 .step/.stl 이 없어서 텍스트 형식(STEP 은 원래 텍스트, STL 은 ASCII)으로 `.txt` 를 덧붙여 저장한다 —
 * 받은 뒤 `.txt` 만 지우면 그대로 CAD 에서 열린다. 기능이 없으면(로컬 파일로 연 경우) 일반 링크로 폴백.
 */
type DownloadsNs = { save(req: { filename: string; data: Blob | string }): Promise<{ status: string }> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

const MESSAGES: Record<string, string> = {
  declined: "저장을 취소했습니다",
  rate_limited: "저장 확인 창이 이미 열려 있습니다. 잠시 후 다시 시도하세요",
  rejected_extension: "이 뷰어가 허용하지 않는 파일 형식입니다",
  unavailable: "이 뷰어에서는 파일 저장이 지원되지 않습니다",
};

function fallbackAnchor(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) {
    fallbackAnchor(blob, fileName);
    return;
  }
  const downloads = (await host.use("downloads")) as DownloadsNs | null;
  if (!downloads) throw new Error(MESSAGES.unavailable ?? "unavailable");
  const filename = /\.(step|stl)$/i.test(fileName) ? `${fileName}.txt` : fileName;
  try {
    await downloads.save({ filename, data: blob });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    const message = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
    throw new Error(MESSAGES[code] ?? `${code || "오류"}: ${message}`);
  }
}
