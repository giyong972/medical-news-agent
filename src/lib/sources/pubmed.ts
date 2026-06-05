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
        publishedAt: null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
