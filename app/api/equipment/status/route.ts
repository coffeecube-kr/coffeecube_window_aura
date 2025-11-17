import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 장비 상태 데이터를 모사하는 함수
function generateMockEquipmentData(robotCode: string) {
  return {
    robot_code: robotCode,
    total_weight: Number((Math.random() * 30 + 5).toFixed(2)), // 5kg ~ 35kg
    temperature: 99, // 항상 99 (클라이언트에서 serial 통신으로 덮어씀)
    device_status: "장애발생" as const, // 항상 장애발생 (클라이언트에서 serial 통신으로 덮어씀)
    action_name: null as string | null,
    action_response: null as string | null,
  };
}

// GET: 현재 장비 상태 조회 (equipment_status에서 최신 데이터 + equipment_list의 bucket 데이터)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const robotCode = searchParams.get("robot_code");

    if (!robotCode) {
      return NextResponse.json(
        { error: "robot_code가 필요합니다." },
        { status: 400 }
      );
    }

    // equipment_status에서 최신 데이터 가져오기
    const { data: statusData } = await supabase
      .from("equipment_status")
      .select(
        "total_weight, temperature, device_status, action_name, action_response"
      )
      .eq("robot_code", robotCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // equipment_list에서 bucket 데이터 가져오기
    const { data: equipmentData } = await supabase
      .from("equipment_list")
      .select("bucket1, bucket2, bucket3, bucket4")
      .eq("robot_code", robotCode)
      .single();

    // 데이터가 없으면 기본값 생성
    const mockData = statusData || generateMockEquipmentData(robotCode);

    // bucket 데이터와 함께 응답
    const responseData = {
      robot_code: robotCode,
      total_weight: mockData.total_weight,
      temperature: mockData.temperature,
      device_status: mockData.device_status,
      action_name: mockData.action_name || null,
      action_response: mockData.action_response || null,
      bucket1: equipmentData?.bucket1 || 0,
      bucket2: equipmentData?.bucket2 || 0,
      bucket3: equipmentData?.bucket3 || 0,
      bucket4: equipmentData?.bucket4 || 0,
    };

    return NextResponse.json(responseData);
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
