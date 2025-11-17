import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  // buttons 테이블에서 admin 타입 버튼을 button_no 기준 오름차순으로 가져오기
  const { data: buttons, error: buttonsError } = await supabase
    .from("buttons")
    .select("*")
    .eq("button_type", "admin")
    .order("button_no", { ascending: true });

  if (buttonsError) {
    return NextResponse.json(
      {
        error: "버튼 데이터를 가져오는데 실패했습니다.",
        details: buttonsError.message,
      },
      { status: 500 }
    );
  }

  // 각 버튼에 대한 명령어들을 가져오기
  const buttonsWithCommands = await Promise.all(
    (buttons || []).map(async (button) => {
      const { data: commands, error: commandsError } = await supabase
        .from("button_commands")
        .select("*")
        .eq("button_no", button.button_no)
        .order("sequence_order", { ascending: true });

      if (commandsError) {
        return {
          ...button,
          commands: [],
        };
      }

      return {
        ...button,
        commands: commands || [],
      };
    })
  );

  return NextResponse.json({ buttons: buttonsWithCommands });
}
