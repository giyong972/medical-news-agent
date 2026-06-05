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

const SOURCE_SHORT: Record<string, string> = {
  WHO: "WHO",
  CDC: "CDC",
  NIH: "NIH",
  PubMed: "PubMed",
  MedicalXpress: "MedicalXpress",
  GoogleNewsHealth: "Google",
  ReutersHealth: "Reuters",
};

const SOURCE_BADGE: Record<string, string> = {
  WHO: "bg-sky-100 text-sky-700",
  CDC: "bg-indigo-100 text-indigo-700",
  NIH: "bg-violet-100 text-violet-700",
  PubMed: "bg-emerald-100 text-emerald-700",
  MedicalXpress: "bg-amber-100 text-amber-700",
  GoogleNewsHealth: "bg-rose-100 text-rose-700",
  ReutersHealth: "bg-orange-100 text-orange-700",
};

type CatKey = "outbreak" | "research" | "policy" | "general";
const CATEGORIES: { key: CatKey | "ALL"; label: string; dot: string; chip: string }[] = [
  { key: "ALL", label: "전체 분류", dot: "bg-slate-400", chip: "data-[on=true]:bg-slate-900 data-[on=true]:text-white data-[on=true]:border-slate-900" },
  { key: "outbreak", label: "발병·유행", dot: "bg-red-500", chip: "data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600" },
  { key: "research", label: "연구", dot: "bg-emerald-500", chip: "data-[on=true]:bg-emerald-600 data-[on=true]:text-white data-[on=true]:border-emerald-600" },
  { key: "policy", label: "정책", dot: "bg-indigo-500", chip: "data-[on=true]:bg-indigo-600 data-[on=true]:text-white data-[on=true]:border-indigo-600" },
  { key: "general", label: "일반", dot: "bg-slate-400", chip: "data-[on=true]:bg-slate-700 data-[on=true]:text-white data-[on=true]:border-slate-700" },
];
const CAT_META: Record<string, { label: string; text: string; dot: string }> = {
  outbreak: { label: "발병·유행", text: "text-red-600", dot: "bg-red-500" },
  research: { label: "연구", text: "text-emerald-600", dot: "bg-emerald-500" },
  policy: { label: "정책", text: "text-indigo-600", dot: "bg-indigo-500" },
  general: { label: "일반", text: "text-slate-500", dot: "bg-slate-400" },
};

const SEVERITY: Record<string, { label: string; dot: string }> = {
  high: { label: "영향도 높음", dot: "bg-red-500" },
  medium: { label: "영향도 보통", dot: "bg-amber-500" },
  low: { label: "영향도 낮음", dot: "bg-slate-300" },
};

const CAT_ACCENT: Record<string, string> = {
  outbreak: "border-l-red-400",
  research: "border-l-emerald-400",
  policy: "border-l-indigo-400",
  general: "border-l-slate-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default function Dashboard({
  initialArticles,
  loadError,
}: {
  initialArticles: ArticleRow[];
  loadError?: string;
}) {
  const [source, setSource] = useState<SourceName | "ALL">("ALL");
  const [cat, setCat] = useState<CatKey | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CollectActionResult | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialArticles.filter((a) => {
      if (source !== "ALL" && a.source !== source) return false;
      if (cat !== "ALL" && (a.category ?? "general") !== cat) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.summary_ko ?? "").toLowerCase().includes(q) ||
        (a.diseases ?? []).some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [initialArticles, source, cat, query]);

  const srcCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of initialArticles) c[a.source] = (c[a.source] ?? 0) + 1;
    return c;
  }, [initialArticles]);

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of initialArticles) {
      const k = a.category ?? "general";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [initialArticles]);

  function handleCollect() {
    setResult(null);
    startTransition(async () => setResult(await collectNow()));
  }

  const needsSetup = loadError || initialArticles.length === 0;

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
              <span aria-hidden>🩺</span> 의료 뉴스 수집 Agent
              <span className="ml-1 hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 sm:inline">
                {initialArticles.length}건
              </span>
            </h1>
            <button
              onClick={handleCollect}
              disabled={pending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? <><Spinner /> 수집 중…</> : <>↻ 지금 수집</>}
            </button>
          </div>

          {/* 필터 영역 */}
          <div className="mt-3 space-y-2">
            {/* 분류(카테고리) 필터 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-slate-400">분류</span>
              {CATEGORIES.map((c) => {
                const on = cat === c.key;
                const n = c.key === "ALL" ? initialArticles.length : catCounts[c.key] ?? 0;
                return (
                  <button
                    key={c.key}
                    data-on={on}
                    onClick={() => setCat(c.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 ${c.chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    {c.label}
                    <span className="opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>

            {/* 소스 필터 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-slate-400">출처</span>
              {SOURCES.map((s) => {
                const on = source === s;
                const label = s === "ALL" ? "전체" : SOURCE_SHORT[s] ?? s;
                const n = s === "ALL" ? initialArticles.length : srcCounts[s] ?? 0;
                return (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    title={s === "ALL" ? "전체 출처" : SOURCE_LABELS[s as SourceName]}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {label} <span className="opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>

            {/* 검색 */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍 질병명·키워드 검색 (예: 인플루엔자, 홍역, COVID)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        {result && (
          <div
            className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {result.ok && result.stats ? (
              <span>
                ✅ 수집 완료 — 신규 {result.stats.newArticles} · 요약 {result.stats.summarized} · 저장{" "}
                {result.stats.inserted}건 ({(result.stats.durationMs / 1000).toFixed(1)}초).{" "}
                <button onClick={() => location.reload()} className="font-semibold underline">
                  새로고침
                </button>
              </span>
            ) : (
              <span>⚠️ 수집 실패: {result.error}</span>
            )}
          </div>
        )}

        {needsSetup && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">⚙️ 아직 수집된 기사가 없습니다.</p>
            {loadError && <p className="mt-1 text-amber-700">DB 오류: {loadError}</p>}
            <p className="mt-1 text-amber-800">
              환경변수(<code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>,{" "}
              <code className="font-mono">OPENROUTER_API_KEY</code>) 설정 후 <b>“지금 수집”</b>을 누르세요.
            </p>
          </div>
        )}

        <p className="mb-2 text-xs text-slate-400">{filtered.length}건 표시</p>

        {/* 컴팩트 그리드 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>

        {!needsSetup && filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-slate-400">조건에 맞는 기사가 없습니다.</p>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          openrouter/auto 요약 · Supabase 저장 · Vercel 자동 수집 · WHO·CDC·NIH·PubMed·MedicalXpress·Google·Reuters
        </footer>
      </main>
    </div>
  );
}

function ArticleCard({ a }: { a: ArticleRow }) {
  const cat = CAT_META[a.category ?? "general"] ?? CAT_META.general;
  const sev = SEVERITY[a.severity ?? "low"] ?? SEVERITY.low;
  const accent = CAT_ACCENT[a.category ?? "general"] ?? CAT_ACCENT.general;
  const date = fmtDate(a.published_at ?? a.created_at);

  return (
    <article
      className={`group flex flex-col rounded-lg border border-slate-200 border-l-4 ${accent} bg-white p-3.5 shadow-sm transition hover:shadow-md`}
    >
      {/* 메타 */}
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px]">
        <span className={`rounded px-1.5 py-0.5 font-semibold ${SOURCE_BADGE[a.source] ?? "bg-slate-100 text-slate-600"}`}>
          {SOURCE_SHORT[a.source] ?? a.source}
        </span>
        <span className={`inline-flex items-center gap-1 font-medium ${cat.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} />
          {cat.label}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400" title={sev.label}>
          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
        </span>
        {date && <span className="ml-auto text-slate-400">{date}</span>}
      </div>

      {/* 제목 */}
      <h2 className="text-sm font-semibold leading-snug text-slate-900">
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 hover:text-sky-700 hover:underline">
          {a.title}
        </a>
      </h2>

      {/* 요약 */}
      {a.summary_ko ? (
        <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed text-slate-600">{a.summary_ko}</p>
      ) : (
        <p className="mt-1.5 text-xs italic text-slate-400">요약 대기 중…</p>
      )}

      {/* 질병 태그 */}
      {a.diseases && a.diseases.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
          {a.diseases.slice(0, 3).map((d, i) => (
            <span key={i} className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700">
              #{d}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
