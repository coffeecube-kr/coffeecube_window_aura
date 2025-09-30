import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MainContent from "../components/MainContent";

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/client");
  }

  return <MainContent />;
}
