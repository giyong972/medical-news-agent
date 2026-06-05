import type { RawArticle, SourceName } from "@/lib/types";
import { fetchFeed } from "./rss";
import { fetchPubMed } from "./pubmed";

/** RSS/Atom 기반 소스의 후보 피드 URL (앞에서부터 시도) */
const FEED_SOURCES: Record<Exclude<SourceName, "PubMed">, string[]> = {
  WHO: [
    "https://www.who.int/rss-feeds/news-english.xml",
    "https://news.google.com/rss/search?q=WHO+OR+%22World+Health+Organization%22+disease+OR+outbreak+when:30d&hl=en-US&gl=US&ceid=US:en",
  ],
  CDC: [
    "https://tools.cdc.gov/api/v2/resources/media/285676.rss", // CDC Outbreaks
    "https://tools.cdc.gov/api/v2/resources/media/316422.rss", // CDC What's New
    "https://news.google.com/rss/search?q=disease+OR+outbreak+OR+health+site:cdc.gov+when:30d&hl=en-US&gl=US&ceid=US:en",
  ],
  NIH: [
    "https://news.google.com/rss/search?q=research+OR+disease+OR+health+site:nih.gov+when:30d&hl=en-US&gl=US&ceid=US:en",
    "https://www.nih.gov/news-events/news-releases/feed",
  ],
  MedicalXpress: [
    "https://medicalxpress.com/rss-feed/",
    "https://medicalxpress.com/rss-feed/breaking/",
  ],
  GoogleNewsHealth: [
    "https://news.google.com/rss/search?q=(health+OR+disease+OR+virus+OR+vaccine+OR+outbreak)+when:7d&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-US&gl=US&ceid=US:en",
  ],
  ReutersHealth: [
    "https://news.google.com/rss/search?q=health+OR+disease+OR+outbreak+site:reuters.com+when:14d&hl=en-US&gl=US&ceid=US:en",
  ],
};

export interface SourceResult {
  source: SourceName;
  articles: RawArticle[];
  error?: string;
}

/** 모든 소스를 병렬로 수집 */
export async function fetchAllSources(perSource = 10): Promise<SourceResult[]> {
  const feedEntries = Object.entries(FEED_SOURCES) as [Exclude<SourceName, "PubMed">, string[]][];

  const feedTasks = feedEntries.map(async ([source, urls]): Promise<SourceResult> => {
    try {
      const articles = await fetchFeed(source, urls, perSource);
      return { source, articles };
    } catch (e) {
      return { source, articles: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  const pubmedTask: Promise<SourceResult> = fetchPubMed(perSource)
    .then((articles) => ({ source: "PubMed" as SourceName, articles }))
    .catch((e) => ({
      source: "PubMed" as SourceName,
      articles: [],
      error: e instanceof Error ? e.message : String(e),
    }));

  return Promise.all([...feedTasks, pubmedTask]);
}
