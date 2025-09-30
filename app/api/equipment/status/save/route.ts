import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 요청 본문에서 데이터 추출
    const body = await request.json();
    const {
      robot_code,
      total_weight,
      temperature,
      device_status,
      action_name,
      action_response,
      user_id,
    } = body;

    // 필수 필드 확인 - 더 상세한 검증
    const missingFields: string[] = [];
    const fieldDetails: Record<string, string> = {};

    // robot_code 검증
    if (!robot_code || robot_code.trim() === "") {
      missingFields.push("robot_code");
      fieldDetails.robot_code = `받은 값: ${robot_code} (타입: ${typeof robot_code})`;
    }

    // total_weight 검증
    if (
      total_weight === undefined ||
      total_weight === null ||
      total_weight === ""
    ) {
      missingFields.push("total_weight");
      fieldDetails.total_weight = `받은 값: ${total_weight} (타입: ${typeof total_weight})`;
    }

    // temperature 검증
    if (
      temperature === undefined ||
      temperature === null ||
      temperature === ""
    ) {
      missingFields.push("temperature");
      fieldDetails.temperature = `받은 값: ${temperature} (타입: ${typeof temperature})`;
    }

    // device_status 검증
    if (!device_status || device_status.trim() === "") {
      missingFields.push("device_status");
      fieldDetails.device_status = `받은 값: ${device_status} (타입: ${typeof device_status})`;
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `필수 필드가 누락되었습니다: ${missingFields.join(", ")}`,
          field_details: fieldDetails,
          received_data: {
            robot_code,
            total_weight,
            temperature,
            device_status,
            action_name,
            action_response,
            user_id,
          },
        },
        { status: 400 }
      );
    }

    // 데이터 타입 변환 및 정제
    const insertData = {
      robot_code: String(robot_code).trim(),
      total_weight: Number(total_weight),
      temperature: Number(temperature),
      device_status: String(device_status).trim(),
      action_name: action_name ? String(action_name).trim() : null,
      action_response: action_response ? String(action_response).trim() : null,
      user_id: user_id ? String(user_id).trim() : null,
    };

    // 숫자 타입 유효성 검증
    if (isNaN(insertData.total_weight) || isNaN(insertData.temperature)) {
      return NextResponse.json(
        {
          success: false,
          error: "total_weight와 temperature는 유효한 숫자여야 합니다.",
          received_data: { total_weight, temperature },
        },
        { status: 400 }
      );
    }

    // equipment_status 테이블에 데이터 삽입
    const { data, error } = await supabase
      .from("equipment_status")
      .insert([insertData])
      .select();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: `데이터베이스 저장 실패: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "장비 상태 데이터가 성공적으로 저장되었습니다.",
      data: data[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `서버 오류: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
      },
      { status: 500 }
    );
  }
}
