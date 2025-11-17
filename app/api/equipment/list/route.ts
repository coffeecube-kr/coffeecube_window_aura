import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const supabase = await createClient();

  let query = supabase
    .from("equipment_list")
    .select("*")
    .eq("usable", true)
    .order("install_location", { ascending: true });

  if (search) {
    query = query.or(
      `install_location.ilike.%${search}%,name.ilike.%${search}%,robot_code.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
