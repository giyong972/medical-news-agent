// 의료 뉴스 Agent 공통 타입

/** 크롤러가 각 소스에서 수집한 원시 기사 */
export interface RawArticle {
  source: SourceName;
  title: string;
  url: string;
  /** 원문 요약/초록/본문 일부 (영문 등) */
  snippet: string;
  /** ISO 문자열 또는 null */
  publishedAt: string | null;
}

/** LLM 요약 결과 */
export interface Summary {
  summary_ko: string;
  key_points: string[];
  diseases: string[];
  category: "outbreak" | "research" | "policy" | "general";
  severity: "low" | "medium" | "high";
}

/** DB articles 행 */
export interface ArticleRow {
  id: string;
  source: string;
  title: string;
  url: string;
  content_hash: string;
  published_at: string | null;
  original_snippet: string | null;
  summary_ko: string | null;
  key_points: string[];
  diseases: string[];
  category: string | null;
  severity: string | null;
  summarized: boolean;
  created_at: string;
  updated_at: string;
}

export type SourceName =
  | "WHO"
  | "CDC"
  | "NIH"
  | "PubMed"
  | "MedicalXpress"
  | "GoogleNewsHealth"
  | "ReutersHealth";

export const SOURCE_LABELS: Record<SourceName, string> = {
  WHO: "WHO (세계보건기구)",
  CDC: "CDC (미국 질병통제예방센터)",
  NIH: "NIH (미국 국립보건원)",
  PubMed: "PubMed",
  MedicalXpress: "MedicalXpress",
  GoogleNewsHealth: "Google News (건강)",
  ReutersHealth: "Reuters Health",
};
