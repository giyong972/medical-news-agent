# 🩺 의료 뉴스 수집 Agent

최신 질병 정보를 **자동 수집**하고 **한국어로 요약**하는 의료 뉴스 Agent입니다.

WHO · CDC · NIH · PubMed · MedicalXpress · Google News Health · Reuters Health 7개 출처에서
기사를 크롤링하고, `openrouter/auto` LLM으로 한국어 요약·질병 분류·공중보건 영향도를 생성해
Supabase에 저장한 뒤 대시보드로 보여줍니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프론트엔드 | Next.js 15 (App Router) + React 19 + Tailwind CSS v4 |
| 데이터베이스 | Supabase (PostgreSQL) |
| LLM | OpenRouter (`openrouter/auto`) |
| 배포 | Vercel |
| 자동화 | Vercel Cron (매일 06:00 KST) |

## 아키텍처

```
Vercel Cron ─▶ /api/collect
                  │
                  ├─ 7개 소스 크롤링 (RSS/Atom + PubMed E-utilities)
                  ├─ content_hash 로 중복 제거
                  ├─ openrouter/auto 로 한국어 요약 (동시 4개)
                  └─ Supabase articles 테이블에 저장
                          │
대시보드(/) ◀────────────┘  (서버 컴포넌트로 직접 읽기)
```

## 데이터 소스

| 소스 | 방식 |
| --- | --- |
| WHO | Disease Outbreak News / News RSS |
| CDC | Newsroom / MMWR RSS |
| NIH | News Releases RSS |
| PubMed | E-utilities API (esearch + efetch) |
| MedicalXpress | RSS |
| Google News Health | Topic RSS |
| Reuters Health | Google News 검색 RSS |

## 환경변수

`.env.example` 참고. 다음 값이 필요합니다.

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 쓰기용 service_role 키 (비공개) |
| `OPENROUTER_API_KEY` | OpenRouter API 키 |
| `OPENROUTER_MODEL` | 기본 `openrouter/auto` |
| `CRON_SECRET` | `/api/collect` 보호용 시크릿 |

## 로컬 실행

```bash
npm install
# .env.local 에 키 입력 후
npm run dev
```

- 대시보드: http://localhost:3000
- 수동 수집: http://localhost:3000/api/collect?secret=<CRON_SECRET>
  또는 대시보드의 **“지금 수집”** 버튼

## 배포

Vercel에 연결하고 위 환경변수를 등록하면 `vercel.json` 의 크론이 매일 자동 수집합니다.
(Hobby 플랜은 크론 1일 1회 제한 — 더 자주 수집하려면 Pro 플랜에서 `vercel.json` 의 schedule 수정)
