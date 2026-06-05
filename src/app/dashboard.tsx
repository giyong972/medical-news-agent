"use client";

import { useMemo, useState, useTransition } from "react";
import { collectNow, type CollectActionResult } from "./actions";
import { SOURCE_LABELS, type ArticleRow, type SourceName } from "@/lib/types";

const SOURCES: (SourceName | "ALL")[] = [
  "ALL",
  "WHO",
  "CDC",
  "NIH",
  "PubMed",
  "MedicalXpress",
  "GoogleNewsHealth",
  "ReutersHealth",
];

const SOURCE_BADGE: Record<string, string> = {
  WHO: "bg-sky-100 text-sky-800",
  CDC: "bg-indigo-100 text-indigo-800",
  NIH: "bg-violet-100 text-violet-800",
  PubMed: "bg-emerald-100 text-emerald-800",
  MedicalXpress: "bg-amber-100 text-amber-800",
  GoogleNewsHealth: "bg-rose-100 text-rose-800",
  ReutersHealth: "bg-orange-100 text-orange-800",
};

const CATEGORY_LABEL: Record<string, string> = {
  outbreak: "발병/유행",
  research: "연구",
  policy: "정책",
  general: "일반",
};

const SEVERITY: Record<string, { label: string; cls: string }> = {
  high: { label: "영향도 높음", cls: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "영향도 보통", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "영향도 낮음", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "날짜 미상";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "날짜 미상";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function Dashboard({
  initialArticles,
  loadError,
}: {
  initialArticles: ArticleRow[];
  loadError?: string;
}) {
  const [filter, setFilter] = useState<SourceName | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CollectActionResult | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialArticles.filter((a) => {
      if (filter !== "ALL" && a.source !== filter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.summary_ko ?? "").toLowerCase().includes(q) ||
        (a.diseases ?? []).some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [initialArticles, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of initialArticles) c[a.source] = (c[a.source] ?? 0) + 1;
    return c;
  }, [initialArticles]);

  function handleCollect() {
    setResult(null);
    startTransition(async () => {
      const r = await collectNow();
      setResult(r);
    });
  }

  const needsSetup = loadError || initialArticles.length === 0;

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                <span aria-hidden>🩺</span> 의료 뉴스 수집 Agent
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                WHO · CDC · NIH · PubMed · MedicalXpress · Google News · Reuters 의 최신 질병 정보를
                자동 수집하고 한국어로 요약합니다.
              </p>
            </div>
            <button
              onClick={handleCollect}
              disabled={pending}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Spinner /> 수집 중…
                </>
              ) : (
                <>↻ 지금 수집</>
              )}
            </button>
          </div>

          {/* 통계 */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <Stat label="총 기사" value={initialArticles.length} />
            <Stat label="활성 소스" value={Object.keys(counts).length} />
            <Stat label="필터 결과" value={filtered.length} />
          </div>

          {result && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                result.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {result.ok && result.stats ? (
                <span>
                  ✅ 수집 완료 — 수집 {result.stats.fetched}건 / 신규 {result.stats.newArticles}건 /
                  요약 {result.stats.summarized}건 / 저장 {result.stats.inserted}건 (
                  {(result.stats.durationMs / 1000).toFixed(1)}초). 새로고침하면 반영됩니다.
                </span>
              ) : (
                <span>⚠️ 수집 실패: {result.error}</span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* 소스 필터 */}
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => {
            const active = filter === s;
            const label = s === "ALL" ? "전체" : SOURCE_LABELS[s].split(" ")[0];
            const n = s === "ALL" ? initialArticles.length : counts[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {label} <span className={active ? "text-slate-300" : "text-slate-400"}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* 검색 */}
        <div className="mt-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="질병명·키워드로 검색 (예: 인플루엔자, 홍역, COVID)"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        {/* 설정 안내 */}
        {needsSetup && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">⚙️ 아직 수집된 기사가 없습니다.</p>
            {loadError && <p className="mt-1 text-amber-700">DB 오류: {loadError}</p>}
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
              <li>Vercel/로컬 환경변수에 <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> 와 <code className="font-mono">OPENROUTER_API_KEY</code> 를 설정하세요.</li>
              <li>설정 후 위의 <b>“지금 수집”</b> 버튼을 누르거나 매일 자동 크론이 실행됩니다.</li>
            </ul>
          </div>
        )}

        {/* 기사 목록 */}
        <div className="mt-6 space-y-4">
          {filtered.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
          {!needsSetup && filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
          )}
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          openrouter/auto 로 요약 · Supabase 저장 · Vercel 배포 · 매일 자동 수집
        </footer>
      </main>
    </div>
  );
}

function ArticleCard({ a }: { a: ArticleRow }) {
  const sev = SEVERITY[a.severity ?? "low"] ?? SEVERITY.low;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            SOURCE_BADGE[a.source] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          {a.source}
        </span>
        {a.category && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {CATEGORY_LABEL[a.category] ?? a.category}
          </span>
        )}
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${sev.cls}`}>{sev.label}</span>
        <span className="ml-auto text-xs text-slate-400">{timeAgo(a.published_at ?? a.created_at)}</span>
      </div>

      <h2 className="text-base font-semibold leading-snug text-slate-900">
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-700 hover:underline">
          {a.title}
        </a>
      </h2>

      {a.summary_ko ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{a.summary_ko}</p>
      ) : (
        <p className="mt-2 text-sm italic text-slate-400">요약 대기 중…</p>
      )}

      {a.key_points && a.key_points.length > 0 && (
        <ul className="mt-3 space-y-1">
          {a.key_points.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {a.diseases && a.diseases.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.diseases.map((d, i) => (
            <span key={i} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
              #{d}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold text-slate-900">{value}</span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
