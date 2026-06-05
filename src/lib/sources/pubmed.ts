import { XMLParser } from "fast-xml-parser";
import type { RawArticle } from "@/lib/types";
import { stripHtml } from "./rss";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const UA = "MedicalNewsAgent/1.0 (mailto:noreply@example.com)";

// 최근 감염병/발병/신종질환 관련 논문
const TERM =
  '("disease outbreak"[Title/Abstract] OR "infectious disease"[Title/Abstract] OR epidemic[Title/Abstract] OR pandemic[Title/Abstract] OR "emerging infection"[Title/Abstract])';

function abstractText(article: Record<string, unknown>): string {
  const abs = ((article.Abstract as Record<string, unknown>)?.AbstractText) as unknown;
  if (!abs) return "";
  if (typeof abs === "string") return abs;
  if (Array.isArray(abs)) {
    return abs
      .map((a) => (typeof a === "string" ? a : ((a as Record<string, unknown>)?.["#text"] as string) ?? ""))
      .join(" ");
  }
  if (typeof abs === "object") {
    return ((abs as Record<string, unknown>)["#text"] as string) ?? "";
  }
  return "";
}

function pad(n: string): string {
  return n.length === 1 ? `0${n}` : n;
}

/** PubMed 기사에서 발행일(ISO) 추출 */
function extractDate(article: Record<string, unknown>): string | null {
  // ArticleDate (가장 정확)
  const ad = article.ArticleDate as Record<string, unknown> | undefined;
  const src = Array.isArray(ad) ? (ad[0] as Record<string, unknown>) : ad;
  let y = "", m = "", d = "";
  if (src) {
    y = String(src.Year ?? "");
    m = String(src.Month ?? "01");
    d = String(src.Day ?? "01");
  } else {
    // Journal > JournalIssue > PubDate
    const journal = article.Journal as Record<string, unknown> | undefined;
    const issue = journal?.JournalIssue as Record<string, unknown> | undefined;
    const pd = issue?.PubDate as Record<string, unknown> | undefined;
    if (pd) {
      y = String(pd.Year ?? "");
      m = String(pd.Month ?? "01");
      d = String(pd.Day ?? "01");
    }
  }
  if (!y || !/^\d{4}$/.test(y)) return null;
  // 월이 "Jan" 같은 약어인 경우 처리
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  if (months[m]) m = months[m];
  if (!/^\d{1,2}$/.test(m)) m = "01";
  if (!/^\d{1,2}$/.test(d)) d = "01";
  const iso = `${y}-${pad(m)}-${pad(d)}T00:00:00.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function fetchPubMed(limit = 12): Promise<RawArticle[]> {
  try {
    const searchUrl =
      `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(TERM)}` +
      `&sort=date&retmax=${limit}&retmode=json&datetype=pdat&reldate=30`;
    const sres = await fetch(searchUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!sres.ok) return [];
    const sjson = (await sres.json()) as { esearchresult?: { idlist?: string[] } };
    const ids = sjson.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const fetchUrl = `${EUTILS}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const fres = await fetch(fetchUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (!fres.ok) return [];
    const xml = await fres.text();
    const doc = parser.parse(xml) as Record<string, unknown>;

    const set = doc.PubmedArticleSet as Record<string, unknown> | undefined;
    if (!set?.PubmedArticle) return [];
    const articles = (Array.isArray(set.PubmedArticle) ? set.PubmedArticle : [set.PubmedArticle]) as Record<
      string,
      unknown
    >[];

    const out: RawArticle[] = [];
    for (const pa of articles) {
      const citation = pa.MedlineCitation as Record<string, unknown> | undefined;
      if (!citation) continue;
      const pmid =
        typeof citation.PMID === "object"
          ? ((citation.PMID as Record<string, unknown>)["#text"] as string)
          : (citation.PMID as string);
      const article = citation.Article as Record<string, unknown> | undefined;
      if (!article || !pmid) continue;

      const title = stripHtml(
        typeof article.ArticleTitle === "object"
          ? ((article.ArticleTitle as Record<string, unknown>)["#text"] as string) ?? ""
          : (article.ArticleTitle as string) ?? ""
      );
      if (!title) continue;

      const snippet = stripHtml(abstractText(article)).slice(0, 1500);

      out.push({
        source: "PubMed",
        title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        snippet,
        publishedAt: extractDate(article),
      });
    }
    return out;
  } catch {
    return [];
  }
}
