import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientContent from "./components/ClientContent";

export default async function ClientPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/client");
  }

  return <ClientContent user={data.user} />;
}
