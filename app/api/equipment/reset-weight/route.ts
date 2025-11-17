import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { robot_code } = await request.json();

    if (!robot_code) {
      return NextResponse.json(
        { error: "robot_code가 필요합니다." },
        { status: 400 }
      );
    }

    // equipment_list 테이블에서 해당 장비의 중량 초기화
    const { data, error } = await supabase
      .from("equipment_list")
      .update({
        bucket1: 0,
        bucket2: 0,
        bucket3: 0,
        bucket4: 0,
        bucket_active: "bucket1",
      })
      .eq("robot_code", robot_code)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "중량 초기화에 실패했습니다.", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "중량이 초기화되었습니다.",
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
