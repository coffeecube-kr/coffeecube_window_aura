import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 장비 상태 데이터를 모사하는 함수
function generateMockEquipmentData(robotCode: string) {
  const statuses = ["정상", "수거필요", "장애발생"] as const;
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

  return {
    robot_code: robotCode,
    total_weight: Number((Math.random() * 30 + 5).toFixed(2)), // 5kg ~ 35kg
    temperature: Number((Math.random() * 8 + 1).toFixed(1)), // 1°C ~ 9°C
    device_status: randomStatus,
  };
}

// GET: 현재 장비 상태 조회 (임의 데이터 반환)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const robotCode = searchParams.get("robot_code");

    if (!robotCode) {
      return NextResponse.json(
        { error: "robot_code가 필요합니다." },
        { status: 400 }
      );
    }

    // 항상 임의의 장비 상태 데이터 생성 및 반환
    const mockData = generateMockEquipmentData(robotCode);
    return NextResponse.json(mockData);
  } catch (error) {
    return NextResponse.json(
      { error: "장비 상태 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 새로운 장비 상태 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { robot_code, total_weight, temperature, device_status } = body;

    // 필수 필드 검증
    if (
      !robot_code ||
      total_weight === undefined ||
      temperature === undefined ||
      !device_status
    ) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 장비 상태 저장
    const { data, error } = await supabase
      .from("equipment_status")
      .insert({
        robot_code,
        total_weight,
        temperature,
        device_status,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "장비 상태가 성공적으로 저장되었습니다.",
      data: {
        robot_code: data.robot_code,
        total_weight: Number(data.total_weight),
        temperature: Number(data.temperature),
        device_status: data.device_status,
        action_name: data.action_name,
        action_response: data.action_response,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "장비 상태 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 장비 상태 업데이트 (모사 데이터 생성 후 저장)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { robot_code } = body;

    if (!robot_code) {
      return NextResponse.json(
        { error: "robot_code가 필요합니다." },
        { status: 400 }
      );
    }

    // 새로운 모사 데이터 생성
    const mockData = generateMockEquipmentData(robot_code);

    // 장비 상태 저장
    const { data, error } = await supabase
      .from("equipment_status")
      .insert(mockData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "새로운 장비 상태가 생성되었습니다.",
      data: {
        robot_code: data.robot_code,
        total_weight: Number(data.total_weight),
        temperature: Number(data.temperature),
        device_status: data.device_status,
        action_name: data.action_name,
        action_response: data.action_response,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "장비 상태 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
