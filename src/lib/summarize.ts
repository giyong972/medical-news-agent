import { chatCompletion } from "./openrouter";
import type { RawArticle, Summary } from "./types";

const SYSTEM = `당신은 의료/공중보건 전문 뉴스 에디터입니다.
영문 의료 뉴스/논문을 한국 일반 독자가 이해하기 쉽게 한국어로 정확하게 요약합니다.
과장 없이 사실 위주로, 의학 용어는 필요한 경우 쉬운 설명을 덧붙입니다.
반드시 지정된 JSON 형식으로만 답하세요.`;

function buildUserPrompt(a: RawArticle): string {
  return `다음 의료 뉴스를 한국어로 요약하세요.

[출처] ${a.source}
[제목] ${a.title}
[본문/초록]
${a.snippet || "(본문 없음 — 제목 기반으로 추정 요약)"}

아래 JSON 스키마로만 응답:
{
  "summary_ko": "3~5문장의 한국어 요약",
  "key_points": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"],
  "diseases": ["관련 질병/병원체 한국어 명칭"],
  "category": "outbreak | research | policy | general 중 하나",
  "severity": "low | medium | high 중 하나 (공중보건 영향도)"
}`;
}

function coerceSummary(parsed: Record<string, unknown>): Summary {
  const cat = String(parsed.category ?? "general");
  const sev = String(parsed.severity ?? "low");
  return {
    summary_ko: String(parsed.summary_ko ?? "").trim(),
    key_points: Array.isArray(parsed.key_points)
      ? parsed.key_points.map((x) => String(x)).filter(Boolean).slice(0, 6)
      : [],
    diseases: Array.isArray(parsed.diseases)
      ? parsed.diseases.map((x) => String(x)).filter(Boolean).slice(0, 8)
      : [],
    category: (["outbreak", "research", "policy", "general"].includes(cat) ? cat : "general") as Summary["category"],
    severity: (["low", "medium", "high"].includes(sev) ? sev : "low") as Summary["severity"],
  };
}

/** 하나의 기사를 한국어로 요약. 실패 시 null. */
export async function summarizeArticle(a: RawArticle): Promise<Summary | null> {
  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserPrompt(a) },
      ],
      { jsonObject: true, temperature: 0.3, maxTokens: 1000 }
    );

    // JSON 본문만 안전하게 추출
    let jsonStr = raw.trim();
    const first = jsonStr.indexOf("{");
    const last = jsonStr.lastIndexOf("}");
    if (first !== -1 && last !== -1) jsonStr = jsonStr.slice(first, last + 1);

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const summary = coerceSummary(parsed);
    if (!summary.summary_ko) return null;
    return summary;
  } catch {
    return null;
  }
}
