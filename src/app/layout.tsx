import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "의료 뉴스 수집 Agent",
  description: "WHO · CDC · NIH · PubMed 등 최신 질병 정보를 자동 수집하고 한국어로 요약합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
