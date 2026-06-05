import { getServiceClient } from "./supabase";
import { fetchAllSources } from "./sources";
import { summarizeArticle } from "./summarize";
import { contentHash } from "./hash";
import type { RawArticle } from "./types";

export interface CollectStats {
  fetched: number;
  newArticles: number;
  summarized: number;
  inserted: number;
  perSource: Record<string, { fetched: number; error?: string }>;
  durationMs: number;
}

/** 동시 실행 제한 풀 */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 전체 수집 파이프라인:
 * 1) 모든 소스 크롤링 → 2) 중복 제거 → 3) 신규만 한국어 요약 → 4) Supabase 저장
 */
export async function runCollection(opts: { maxSummarize?: number } = {}): Promise<CollectStats> {
  const started = Date.now();
  const maxSummarize = opts.maxSummarize ?? 30;
  const supabase = getServiceClient();

  // 1) 크롤링
  const sourceResults = await fetchAllSources(10);
  const perSource: CollectStats["perSource"] = {};
  let all: RawArticle[] = [];
  for (const r of sourceResults) {
    perSource[r.source] = { fetched: r.articles.length, error: r.error };
    all = all.concat(r.articles);
  }

  // 2) 배치 내 중복 제거 + 해시 부여
  const byHash = new Map<string, RawArticle & { hash: string }>();
  for (const a of all) {
    if (!a.title || !a.url) continue;
    const hash = contentHash(a.url, a.title);
    if (!byHash.has(hash)) byHash.set(hash, { ...a, hash });
  }
  const unique = [...byHash.values()];

  // 3) DB에 이미 존재하는 해시 제외
  const hashes = unique.map((u) => u.hash);
  const existing = new Set<string>();
  // in() 절 길이 제한 대비 청크 처리
  for (let i = 0; i < hashes.length; i += 100) {
    const chunk = hashes.slice(i, i + 100);
    const { data } = await supabase.from("articles").select("content_hash").in("content_hash", chunk);
    for (const row of data ?? []) existing.add((row as { content_hash: string }).content_hash);
  }
  const freshAll = unique.filter((u) => !existing.has(u.hash));

  // 소스별로 그룹화하고 각 그룹 내에서는 최신순 정렬
  const groups = new Map<string, (RawArticle & { hash: string })[]>();
  for (const u of freshAll) {
    const g = groups.get(u.source) ?? [];
    g.push(u);
    groups.set(u.source, g);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });
  }

  // 라운드로빈으로 소스 간 공평하게 maxSummarize개 선택 (특정 소스 독식 방지)
  const lists = [...groups.values()];
  const fresh: (RawArticle & { hash: string })[] = [];
  for (let i = 0; fresh.length < maxSummarize; i++) {
    let added = false;
    for (const list of lists) {
      if (i < list.length) {
        fresh.push(list[i]);
        added = true;
        if (fresh.length >= maxSummarize) break;
      }
    }
    if (!added) break;
  }

  // 4) 한국어 요약 (동시 4개)
  let summarized = 0;
  const rows = await pool(fresh, 4, async (a) => {
    const summary = await summarizeArticle(a);
    if (summary) summarized++;
    return {
      source: a.source,
      title: a.title,
      url: a.url,
      content_hash: a.hash,
      published_at: a.publishedAt,
      original_snippet: a.snippet || null,
      summary_ko: summary?.summary_ko ?? null,
      key_points: summary?.key_points ?? [],
      diseases: summary?.diseases ?? [],
      category: summary?.category ?? null,
      severity: summary?.severity ?? null,
      summarized: Boolean(summary),
    };
  });

  // 5) 저장 (해시 충돌은 무시)
  let inserted = 0;
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("articles")
      .upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Supabase upsert 실패: ${error.message}`);
    inserted = data?.length ?? 0;
  }

  return {
    fetched: all.length,
    newArticles: fresh.length,
    summarized,
    inserted,
    perSource,
    durationMs: Date.now() - started,
  };
}
