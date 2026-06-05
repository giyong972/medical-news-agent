// OpenRouter 클라이언트 (기본 모델: openrouter/auto)

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { jsonObject?: boolean; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.");

  const model = process.env.OPENROUTER_MODEL || "openrouter/auto";

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter 권장 헤더 (선택)
      "HTTP-Referer": "https://github.com/medical-news-agent",
      "X-Title": "Medical News Agent",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1200,
      ...(opts.jsonObject ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter 응답에 content가 없습니다.");
  return content;
}
