import { getServiceClient } from "@/lib/supabase";
import type { ArticleRow } from "@/lib/types";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadArticles(): Promise<{ articles: ArticleRow[]; error?: string }> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) return { articles: [], error: error.message };
    return { articles: (data as ArticleRow[]) ?? [] };
  } catch (e) {
    return { articles: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Page() {
  const { articles, error } = await loadArticles();
  return <Dashboard initialArticles={articles} loadError={error} />;
}
