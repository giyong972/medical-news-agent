"use server";

import { revalidatePath } from "next/cache";
import { runCollection, type CollectStats } from "@/lib/collect";

export interface CollectActionResult {
  ok: boolean;
  stats?: CollectStats;
  error?: string;
}

/** 대시보드의 "지금 수집" 버튼용 서버 액션 */
export async function collectNow(): Promise<CollectActionResult> {
  try {
    const stats = await runCollection();
    revalidatePath("/");
    return { ok: true, stats };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
