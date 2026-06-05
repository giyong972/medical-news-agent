import { NextResponse } from "next/server";
import { runCollection } from "@/lib/collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 뉴스 수집 + 한국어 요약 + 저장.
 * - Vercel Cron이 Authorization: Bearer <CRON_SECRET> 헤더로 호출
 * - 수동 테스트: /api/collect?secret=<CRON_SECRET>
 */
async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const url = new URL(request.url);
    const qs = url.searchParams.get("secret");
    const ok = auth === `Bearer ${secret}` || qs === secret;
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const stats = await runCollection();
    return NextResponse.json({ ok: true, ...stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
