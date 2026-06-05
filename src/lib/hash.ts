import { createHash } from "node:crypto";

/** URL + 제목 기반의 안정적인 중복제거 해시 */
export function contentHash(url: string, title: string): string {
  const normalized = `${url.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
  return createHash("sha256").update(normalized).digest("hex");
}
