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

const SOURCE_DOT: Record<string, string> = {
  WHO: "bg-sky-500",
  CDC: "bg-indigo-500",
  NIH: "bg-violet-500",
  PubMed: "bg-emerald-500",
  MedicalXpress: "bg-amber-500",
  GoogleNewsHealth: "bg-rose-500",
  ReutersHealth: "bg-orange-500",
};

type CatKey = "outbreak" | "research" | "policy" | "general";
const CATEGORIES: { key: CatKey | "ALL"; label: string; dot: string }[] = [
  { key: "ALL", label: "전체", dot: "bg-[#b8b3a7]" },
  { key: "outbreak", label: "발병·유행", dot: "bg-[#d2622e]" },
  { key: "research", label: "연구", dot: "bg-[#5a8a68]" },
  { key: "policy", label: "정책", dot: "bg-[#5a7da3]" },
  { key: "general", label: "일반", dot: "bg-[#a8a399]" },
];

const CAT_META: Record<string, { label: string; chip: string; dot: string; accent: string }> = {
  outbreak: { label: "발병·유행", chip: "bg-[#fbeade] text-[#b5491f]", dot: "bg-[#d2622e]", accent: "border-l-[#d97757]" },
  research: { label: "연구", chip: "bg-[#e9f0e7] text-[#3f6b4e]", dot: "bg-[#5a8a68]", accent: "border-l-[#7fa98a]" },
  policy: { label: "정책", chip: "bg-[#e7ecf2] text-[#3a5a7a]", dot: "bg-[#5a7da3]", accent: "border-l-[#8aa6c2]" },
  general: { label: "일반", chip: "bg-[#efece4] text-[#6b6862]", dot: "bg-[#a8a399]", accent: "border-l-[#dcd7cc]" },
};

const SEVERITY: Record<string, { label: string; dot: string }> = {
  high: { label: "영향도 높음", dot: "bg-[#c96442]" },
  medium: { label: "영향도 보통", dot: "bg-amber-400" },
  low: { label: "영향도 낮음", dot: "bg-[#d6d1c6]" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
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
    for (const a of initialArticles) c[a.category ?? "general"] = (c[a.category ?? "general"] ?? 0) + 1;
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
      <header className="sticky top-0 z-20 border-b border-[#eae7df] bg-[#faf9f5]/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#c96442] text-sm text-white shadow-sm" aria-hidden>
                ✦
              </span>
              <h1 className="font-serif-display text-xl font-medium tracking-tight text-[#1f1e1d] sm:text-2xl">
                의료 뉴스 <span className="italic text-[#c96442]">Agent</span>
              </h1>
              <span className="hidden text-xs text-[#908d86] sm:inline">
                최신 질병 정보 자동 수집 · 한국어 요약
              </span>
            </div>
            <button
              onClick={handleCollect}
              disabled={pending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1f1e1d] px-4 py-2 text-xs font-medium text-[#faf9f5] shadow-sm transition hover:bg-[#3d3a37] disabled:opacity-60"
            >
              {pending ? <><Spinner /> 수집 중…</> : <>↻ 지금 수집</>}
            </button>
          </div>

          {/* 필터 */}
          <div className="mt-4 flex flex-col gap-2.5">
            {/* 분류 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((c) => {
                const on = cat === c.key;
                const n = c.key === "ALL" ? initialArticles.length : catCounts[c.key] ?? 0;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCat(c.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      on
                        ? "bg-[#c96442] text-white shadow-sm"
                        : "bg-white text-[#6b6862] ring-1 ring-[#e8e5dd] hover:ring-[#d6d1c6]"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-white/80" : c.dot}`} />
                    {c.label}
                    <span className={on ? "text-white/70" : "text-[#aaa69d]"}>{n}</span>
                  </button>
                );
              })}
            </div>

            {/* 출처 + 검색 */}
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-1.5">
                {SOURCES.map((s) => {
                  const on = source === s;
                  const label = s === "ALL" ? "전체 출처" : SOURCE_SHORT[s] ?? s;
                  const n = s === "ALL" ? initialArticles.length : srcCounts[s] ?? 0;
                  return (
                    <button
                      key={s}
                      onClick={() => setSource(s)}
                      title={s === "ALL" ? "전체 출처" : SOURCE_LABELS[s as SourceName]}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? "bg-[#1f1e1d] text-[#faf9f5]"
                          : "bg-white text-[#6b6862] ring-1 ring-[#e8e5dd] hover:ring-[#d6d1c6]"
                      }`}
                    >
                      {s !== "ALL" && <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[s]}`} />}
                      {label} <span className={on ? "text-white/60" : "text-[#aaa69d]"}>{n}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative lg:ml-auto lg:w-72">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#aaa69d]">🔍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="질병·키워드 검색"
                  className="w-full rounded-full border border-[#e8e5dd] bg-white py-2 pl-9 pr-3 text-sm text-[#1f1e1d] outline-none transition placeholder:text-[#aaa69d] focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/15"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        {result && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              result.ok
                ? "border-[#cfe0d2] bg-[#eef5ef] text-[#3f6b4e]"
                : "border-[#e9c9bd] bg-[#fbeade] text-[#b5491f]"
            }`}
          >
            {result.ok && result.stats ? (
              <span>
                ✦ 수집 완료 — 신규 {result.stats.newArticles} · 요약 {result.stats.summarized} · 저장{" "}
                {result.stats.inserted}건 ({(result.stats.durationMs / 1000).toFixed(1)}초).{" "}
                <button onClick={() => location.reload()} className="font-semibold underline underline-offset-2">
                  새로고침
                </button>
              </span>
            ) : (
              <span>⚠️ 수집 실패: {result.error}</span>
            )}
          </div>
        )}

        {needsSetup && (
          <div className="mb-5 rounded-xl border border-[#e9d9bd] bg-[#f7f1e4] p-5 text-sm text-[#7a6535]">
            <p className="font-semibold">⚙️ 아직 수집된 기사가 없습니다.</p>
            {loadError && <p className="mt-1 opacity-80">DB 오류: {loadError}</p>}
            <p className="mt-1">
              환경변수(<code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>,{" "}
              <code className="font-mono text-xs">OPENROUTER_API_KEY</code>) 설정 후 <b>“지금 수집”</b>을 누르세요.
            </p>
          </div>
        )}

        <div className="mb-3 flex items-baseline justify-between">
          <p className="font-serif-display text-sm text-[#6b6862]">
            <span className="text-lg font-medium text-[#1f1e1d]">{filtered.length}</span>건의 소식
          </p>
        </div>

        {/* 그리드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a, i) => (
            <ArticleCard key={a.id} a={a} index={i} />
          ))}
        </div>

        {!needsSetup && filtered.length === 0 && (
          <p className="py-20 text-center font-serif-display text-[#aaa69d]">조건에 맞는 기사가 없습니다.</p>
        )}

        <footer className="mt-14 border-t border-[#eae7df] pt-6 text-center text-xs text-[#aaa69d]">
          <p className="font-serif-display italic">openrouter/auto 요약 · Supabase · Vercel 자동 수집</p>
          <p className="mt-1">WHO · CDC · NIH · PubMed · MedicalXpress · Google News · Reuters Health</p>
        </footer>
      </main>
    </div>
  );
}

function ArticleCard({ a, index }: { a: ArticleRow; index: number }) {
  const cat = CAT_META[a.category ?? "general"] ?? CAT_META.general;
  const sev = SEVERITY[a.severity ?? "low"] ?? SEVERITY.low;
  const date = fmtDate(a.published_at ?? a.created_at);

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 25, 400)}ms` }}
      className={`animate-fade-up group flex flex-col rounded-2xl border border-[#ece9e0] border-l-[3px] ${cat.accent} bg-white p-4 shadow-[0_1px_2px_rgba(31,30,29,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(31,30,29,0.08)]`}
    >
      {/* 메타 */}
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide text-[#6b6862]">
          <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[a.source] ?? "bg-[#a8a399]"}`} />
          {SOURCE_SHORT[a.source] ?? a.source}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${cat.chip}`}>{cat.label}</span>
        <span className="inline-flex items-center" title={sev.label}>
          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
        </span>
        {date && <span className="ml-auto text-[#aaa69d]">{date}</span>}
      </div>

      {/* 제목 (에디토리얼 세리프) */}
      <h2 className="font-serif-display text-[15px] font-medium leading-snug text-[#1f1e1d]">
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 decoration-[#c96442]/40 underline-offset-2 transition group-hover:text-[#c96442] group-hover:underline"
        >
          {a.title}
        </a>
      </h2>

      {/* 요약 */}
      {a.summary_ko ? (
        <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-[#54514c]">{a.summary_ko}</p>
      ) : (
        <p className="mt-2 text-[13px] italic text-[#aaa69d]">요약 대기 중…</p>
      )}

      {/* 질병 태그 */}
      {a.diseases && a.diseases.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {a.diseases.slice(0, 3).map((d, i) => (
            <span key={i} className="rounded-full bg-[#f4f2ea] px-2 py-0.5 text-[11px] text-[#6b6862]">
              {d}
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
