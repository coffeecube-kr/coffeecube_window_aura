import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // 누적 투입량 조회
    const { data: cumulativeData, error: cumulativeError } = await supabase
      .from("user_cumulative_statistics")
      .select("total_input_amount, total_input_count")
      .eq("user_id", user.id)
      .single();

    // 오늘 투입량 조회
    const { data: todayData, error: todayError } = await supabase
      .from("user_input_statistics")
      .select("daily_input_amount, daily_input_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    // 총 포인트 조회
    const { data: pointsData, error: pointsError } = await supabase
      .from("user_points")
      .select("points_earned")
      .eq("user_id", user.id);

    if (cumulativeError && cumulativeError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "누적 통계 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    if (todayError && todayError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "오늘 통계 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    if (pointsError) {
      return NextResponse.json(
        { error: "포인트 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // 데이터 처리 (이미 kg 단위로 집계되어 있다고 가정)
    const totalInputKg = Number(cumulativeData?.total_input_amount || 0);
    const todayInputKg = Number(todayData?.daily_input_amount || 0);

    // 표시 단위는 kg로 통일 (소수점 한 자리)
    const totalInput = totalInputKg.toFixed(1);
    const todayInput = todayInputKg.toFixed(1);
    const totalPoints =
      pointsData?.reduce((sum, point) => sum + point.points_earned, 0) || 0;

    return NextResponse.json({
      totalInput: `${totalInput}kg`,
      todayInput: `${todayInput}kg`,
      myPoints: `${totalPoints}p`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
