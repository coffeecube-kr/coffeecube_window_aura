import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
          message: "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      equipment_command_id,
      input_amount,
      input_type,
      input_date,
      robot_code,
    } = body;

    // 입력 단위: kg 기준. 저장도 kg 기준으로 통일
    const inputAmountKg = Number(input_amount);

    // 필수 필드 검증
    if ((!input_amount && input_amount !== 0) || !input_type) {
      return NextResponse.json(
        {
          success: false,
          error: "투입량과 투입 타입은 필수입니다.",
          message: "필수 필드가 누락되었습니다.",
        },
        { status: 400 }
      );
    }

    // 투입량이 양수인지 확인
    if (isNaN(inputAmountKg) || inputAmountKg <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "투입량은 0보다 커야 합니다.",
          message: "올바른 투입량을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    const today = input_date || new Date().toISOString().split("T")[0];

    // 오늘 총 투입량 조회 (kg 기준)
    const { data: todayRecords, error: queryError } = await supabase
      .from("input_records")
      .select("input_amount")
      .eq("user_id", user.id)
      .eq("input_date", today);

    if (queryError) {
      return NextResponse.json(
        {
          success: false,
          error: "오늘 투입량 조회에 실패했습니다.",
          message: queryError.message || "데이터베이스 조회 오류",
        },
        { status: 500 }
      );
    }

    // 오늘 총 투입량 계산 (kg 기준)
    const todayTotalAmountKg = todayRecords.reduce(
      (sum, record) => sum + Number(record.input_amount),
      0
    );

    // 새로운 투입 후 총량 계산 (kg 기준)
    const newTotalAmountKg = todayTotalAmountKg + inputAmountKg;

    // 하루 최대 투입량 2kg 초과 체크
    if (todayTotalAmountKg >= 2) {
      return NextResponse.json(
        {
          success: false,
          error: "일일 투입량 한도 초과",
          message: "오늘 이미 2kg을 투입하여 더 이상 투입할 수 없습니다.",
          data: {
            todayTotal: todayTotalAmountKg,
            maxDaily: 2,
          },
        },
        { status: 400 }
      );
    }

    // 투입하려는 양이 일일 한도를 초과하는 경우, 가능한 만큼만 투입
    let actualInputAmountKg = inputAmountKg;
    if (newTotalAmountKg > 2) {
      actualInputAmountKg = 2 - todayTotalAmountKg;
      if (actualInputAmountKg <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "일일 투입량 한도 초과",
            message: "오늘 투입 가능한 양이 없습니다.",
            data: {
              todayTotal: todayTotalAmountKg,
              maxDaily: 2,
              remainingCapacity: Math.max(0, 2 - todayTotalAmountKg),
            },
          },
          { status: 400 }
        );
      }
    }

    // 실제 투입량 재계산
    const finalTotalAmountKg = todayTotalAmountKg + actualInputAmountKg;

    // 투입 기록 생성
    const { data, error } = await supabase
      .from("input_records")
      .insert({
        user_id: user.id,
        equipment_command_id: equipment_command_id || null,
        input_amount: actualInputAmountKg, // 실제 투입량으로 저장
        input_type,
        input_date: today,
        robot_code: robot_code || null,
      })
      .select()
      .single();

    if (error) {
      const errorMessage = error.message || "투입 기록 생성에 실패했습니다.";
      const errorDetails = error.details || "";

      return NextResponse.json(
        {
          success: false,
          error: "투입 기록 생성에 실패했습니다.",
          message: errorMessage,
          details: errorDetails,
        },
        { status: 500 }
      );
    }

    // robot_code가 있는 경우 equipment_list의 last_used_at 업데이트
    if (robot_code) {
      await supabase
        .from("equipment_list")
        .update({
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("robot_code", robot_code);
    }

    // equipment_status 테이블에 장비명령 기록 저장
    const inputTypeMapping: { [key: string]: string } = {
      coffee_bean: "원두",
      water: "물",
      milk: "우유",
      syrup: "시럽",
      other: "기타",
    };

    const actionName = `${inputTypeMapping[input_type] || input_type} 투입`;
    const actionResponse = `${actualInputAmountKg}kg ${
      inputTypeMapping[input_type] || input_type
    } 투입 완료${
      actualInputAmountKg !== inputAmountKg
        ? ` (일일 한도로 인해 ${inputAmountKg}kg → ${actualInputAmountKg}kg 조정됨)`
        : ""
    }`;

    // 현재 장비 상태를 가져와서 업데이트 (robot_code 기준)
    const { data: currentStatus } = await supabase
      .from("equipment_status")
      .select("*")
      .eq("robot_code", robot_code || "EQUIPMENT_001")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 새로운 equipment_status 레코드 생성 (장비명령 기록 포함)
    await supabase.from("equipment_status").insert({
      robot_code: robot_code || "EQUIPMENT_001",
      total_weight: currentStatus?.total_weight || 0,
      temperature: currentStatus?.temperature || 5,
      device_status: currentStatus?.device_status || "정상",
      action_name: actionName,
      action_response: actionResponse,
      user_id: user.id,
    });

    // 포인트 계산 로직 (하루 최대 2kg까지만 포인트 지급)
    const pointEligibleAmountKg =
      Math.min(finalTotalAmountKg, 2) - Math.min(todayTotalAmountKg, 2);

    if (pointEligibleAmountKg > 0) {
      // 포인트 지급 (0.1kg당 1포인트)
      const pointsToEarn = Math.floor(pointEligibleAmountKg / 0.1);

      // 포인트 기록 생성
      const { error: pointError } = await supabase.from("user_points").insert({
        user_id: user.id,
        points_earned: pointsToEarn,
        points_source: "input_reward",
        source_reference_id: data.id,
        earned_date: today,
      });

      if (pointError) {
        // 포인트 생성 실패해도 투입 기록은 유지
        return NextResponse.json(
          {
            success: true,
            message: "투입 기록이 생성되었지만 포인트 지급에 실패했습니다.",
            data: {
              record: data,
              pointsEarned: 0,
              actualInputAmount: actualInputAmountKg,
              requestedInputAmount: inputAmountKg,
              dailyTotal: finalTotalAmountKg,
            },
          },
          { status: 201 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message:
            actualInputAmountKg !== inputAmountKg
              ? `투입량이 일일 한도에 맞춰 조정되어 ${actualInputAmountKg}kg 투입되었습니다.`
              : "투입 기록이 생성되었습니다.",
          data: {
            record: data,
            pointsEarned: pointsToEarn,
            pointEligibleAmount: pointEligibleAmountKg,
            actualInputAmount: actualInputAmountKg,
            requestedInputAmount: inputAmountKg,
            dailyTotal: finalTotalAmountKg,
          },
        },
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        {
          success: true,
          message:
            actualInputAmountKg !== inputAmountKg
              ? `투입량이 일일 한도에 맞춰 조정되어 ${actualInputAmountKg}kg 투입되었습니다. (일일 포인트 한도 도달)`
              : "투입 기록이 생성되었습니다. (일일 포인트 한도 도달)",
          data: {
            record: data,
            pointsEarned: 0,
            actualInputAmount: actualInputAmountKg,
            requestedInputAmount: inputAmountKg,
            dailyTotal: finalTotalAmountKg,
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

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
        {
          success: false,
          error: "인증이 필요합니다.",
          message: "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const input_type = searchParams.get("input_type");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("input_records")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (input_type) {
      query = query.eq("input_type", input_type);
    }

    if (start_date) {
      query = query.gte("input_date", start_date);
    }

    if (end_date) {
      query = query.lte("input_date", end_date);
    }

    const { data, error } = await query;

    if (error) {
      const errorMessage = error.message || "투입 기록 조회에 실패했습니다.";
      const errorDetails = error.details || "";

      return NextResponse.json(
        {
          success: false,
          error: "투입 기록 조회에 실패했습니다.",
          message: errorMessage,
          details: errorDetails,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { records: data },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
