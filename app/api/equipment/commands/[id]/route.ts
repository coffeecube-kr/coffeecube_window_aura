import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  id: string;
}

// POST: 장비명령 실행
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { robot_code } = body;

    if (!robot_code) {
      return NextResponse.json(
        { error: "robot_code가 필요합니다." },
        { status: 400 }
      );
    }

    const commandNumber = parseInt(id);

    if (isNaN(commandNumber) || commandNumber < 1 || commandNumber > 9) {
      return NextResponse.json(
        { error: "유효하지 않은 명령 번호입니다." },
        { status: 400 }
      );
    }

    const actionName = `장비명령 ${commandNumber}`;

    // 50% 확률로 성공/실패 결정
    const isSuccess = Math.random() > 0.5;
    const actionResponse = isSuccess ? "성공" : "실패";

    // 현재 equipment_status 테이블에서 최신 레코드 업데이트
    const { data: currentData, error: fetchError } = await supabase
      .from("equipment_status")
      .select("*")
      .eq("robot_code", robot_code)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "장비 상태 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    let updatedData;

    if (currentData) {
      // 기존 레코드가 있으면 새 레코드 생성 (명령 정보 포함)
      const { data, error } = await supabase
        .from("equipment_status")
        .insert({
          robot_code: currentData.robot_code,
          total_weight: currentData.total_weight,
          temperature: currentData.temperature,
          device_status: currentData.device_status,
          action_name: actionName,
          action_response: actionResponse,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedData = data;
    } else {
      // 기존 레코드가 없으면 기본 상태로 새 레코드 생성
      const { data, error } = await supabase
        .from("equipment_status")
        .insert({
          robot_code: robot_code,
          total_weight: 15,
          temperature: 99, // 기본값 99 (serial 통신 실패 시)
          device_status: "장애발생", // 기본값 장애발생 (serial 통신 실패 시)
          action_name: actionName,
          action_response: actionResponse,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedData = data;
    }

    return NextResponse.json({
      message: `${actionName}이 ${actionResponse}했습니다.`,
      success: isSuccess,
      data: {
        robot_code: updatedData.robot_code,
        total_weight: Number(updatedData.total_weight),
        temperature: Number(updatedData.temperature),
        device_status: updatedData.device_status,
        action_name: updatedData.action_name,
        action_response: updatedData.action_response,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "장비명령 실행 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
