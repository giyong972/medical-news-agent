import { XMLParser } from "fast-xml-parser";
import type { RawArticle, SourceName } from "@/lib/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

const UA =
  "Mozilla/5.0 (compatible; MedicalNewsAgent/1.0; +https://github.com/medical-news-agent)";

/** 객체/문자열/배열 어디서든 텍스트만 추출 */
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return asText(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["#text"] === "string") return o["#text"] as string;
  }
  return "";
}

/** HTML 태그/엔티티 제거 후 공백 정리 */
export function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Atom의 link 배열에서 alternate href 추출 */
function extractAtomLink(link: unknown): string {
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const alt = link.find(
      (l) => (l as Record<string, unknown>)?.["@_rel"] === "alternate"
    );
    const chosen = (alt ?? link[0]) as Record<string, unknown> | undefined;
    return (chosen?.["@_href"] as string) ?? "";
  }
  if (link && typeof link === "object") {
    return ((link as Record<string, unknown>)["@_href"] as string) ?? "";
  }
  return "";
}

async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 하나의 RSS/Atom 피드를 파싱해 RawArticle[] 반환.
 * 여러 후보 URL을 순서대로 시도하여 첫 성공 피드를 사용.
 */
export async function fetchFeed(
  source: SourceName,
  urls: string[],
  limit = 12
): Promise<RawArticle[]> {
  for (const url of urls) {
    const xml = await fetchXml(url);
    if (!xml) continue;

    let doc: Record<string, unknown>;
    try {
      doc = parser.parse(xml) as Record<string, unknown>;
    } catch {
      continue;
    }

    // RSS 2.0
    const rss = doc.rss as Record<string, unknown> | undefined;
    const channel = rss?.channel as Record<string, unknown> | undefined;
    let items: Record<string, unknown>[] = [];
    let isAtom = false;

    if (channel?.item) {
      items = (Array.isArray(channel.item) ? channel.item : [channel.item]) as Record<
        string,
        unknown
      >[];
    } else {
      // Atom
      const feed = doc.feed as Record<string, unknown> | undefined;
      if (feed?.entry) {
        isAtom = true;
        items = (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) as Record<
          string,
          unknown
        >[];
      }
    }

    if (items.length === 0) continue;

    const out: RawArticle[] = [];
    for (const item of items.slice(0, limit)) {
      const title = asText(item.title);
      const link = isAtom ? extractAtomLink(item.link) : asText(item.link);
      const rawBody =
        asText(item["content:encoded"]) ||
        asText(item.description) ||
        asText(item.summary) ||
        asText(item.content);
      const dateStr =
        asText(item.pubDate) ||
        asText(item.published) ||
        asText(item.updated) ||
        asText(item["dc:date"]);

      if (!title || !link) continue;

      let publishedAt: string | null = null;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
      }

      out.push({
        source,
        title: stripHtml(title),
        url: link.trim(),
        snippet: stripHtml(rawBody).slice(0, 1200),
        publishedAt,
      });
    }
    if (out.length > 0) return out;
  }
  return [];
}
