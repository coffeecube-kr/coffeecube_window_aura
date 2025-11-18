import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: IWRP 응답으로부터 중량 업데이트
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
    const { robot_code, weight_grams } = body;

    // 필수 필드 검증
    if (!robot_code || weight_grams === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "robot_code와 weight_grams가 필요합니다.",
          message: "필수 필드가 누락되었습니다.",
        },
        { status: 400 }
      );
    }

    // 그램을 kg로 변환
    const weightGrams = Number(weight_grams);

    if (isNaN(weightGrams) || weightGrams <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "중량은 0보다 커야 합니다.",
          message: "올바른 중량을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    // kg 단위로 변환
    const weightKg = weightGrams / 1000;

    // equipment_list에서 현재 bucket 정보 가져오기
    const { data: equipmentData, error: equipmentError } = await supabase
      .from("equipment_list")
      .select("bucket1, bucket2, bucket3, bucket4, bucket_active")
      .eq("robot_code", robot_code)
      .single();

    if (equipmentError || !equipmentData) {
      return NextResponse.json(
        {
          success: false,
          error: "장비 정보를 찾을 수 없습니다.",
          message: equipmentError?.message || "장비 조회 오류",
        },
        { status: 404 }
      );
    }

    // 현재 활성 bucket의 중량 업데이트 (kg 단위로 저장)
    let activeBucket = equipmentData.bucket_active || "bucket1";
    const currentWeight =
      Number(equipmentData[activeBucket as keyof typeof equipmentData]) || 0;
    const newWeight = currentWeight + weightKg;

    // 13kg 초과 시 다음 버킷으로 전환
    let nextBucket = activeBucket;
    let isBucketFull = false;
    let bucketSwitched = false;

    if (newWeight > 13) {
      // 다음 버킷으로 전환
      const bucketMap: Record<string, string | null> = {
        bucket1: "bucket2",
        bucket2: "bucket3",
        bucket3: "bucket4",
        bucket4: null, // 마지막 버킷
      };

      const nextBucketName = bucketMap[activeBucket];

      if (nextBucketName) {
        // 다음 버킷이 있는 경우
        nextBucket = nextBucketName;
        bucketSwitched = true;

        // 현재 버킷에 모든 중량을 넣고, 다음 버킷을 활성화만 함
        const updateData = {
          [activeBucket]: newWeight,
          bucket_active: nextBucket,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("equipment_list")
          .update(updateData)
          .eq("robot_code", robot_code);

        if (updateError) {
          return NextResponse.json(
            {
              success: false,
              error: "중량 업데이트에 실패했습니다.",
              message: updateError.message,
            },
            { status: 500 }
          );
        }

        activeBucket = nextBucket;
      } else {
        // 마지막 버킷(bucket4)이 13kg 초과 - 모든 버킷이 가득 참
        isBucketFull = true;

        // equipment_list 업데이트 (bucket 중량 저장 + bucket_active를 bucket5로 변경)
        const updateData = {
          [activeBucket]: newWeight,
          bucket_active: "bucket5", // 모든 수거함이 가득 찬 상태
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("equipment_list")
          .update(updateData)
          .eq("robot_code", robot_code);

        if (updateError) {
          return NextResponse.json(
            {
              success: false,
              error: "중량 업데이트에 실패했습니다.",
              message: updateError.message,
            },
            { status: 500 }
          );
        }

        // equipment_status에 수거필요 상태 기록
        await supabase.from("equipment_status").insert({
          robot_code: robot_code,
          total_weight:
            equipmentData.bucket1 +
            equipmentData.bucket2 +
            equipmentData.bucket3 +
            newWeight,
          temperature: 99,
          device_status: "수거필요" as const,
          action_name: "bucket_full",
          action_response: "모든 수거함이 가득 찼습니다.",
        });

        activeBucket = "bucket5"; // 응답 데이터를 위해 activeBucket도 업데이트
      }
    } else {
      // 13kg 이하인 경우 일반 업데이트
      const updateData = {
        [activeBucket]: newWeight,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("equipment_list")
        .update(updateData)
        .eq("robot_code", robot_code);

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            error: "중량 업데이트에 실패했습니다.",
            message: updateError.message,
          },
          { status: 500 }
        );
      }
    }

    // 오늘 날짜
    const today = new Date().toISOString().split("T")[0];

    // 오늘 총 투입량 조회
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

    // 오늘 총 투입량 계산
    const todayTotalAmountKg = todayRecords.reduce(
      (sum, record) => sum + Number(record.input_amount),
      0
    );

    // 새로운 투입 후 총량 계산
    const newTotalAmountKg = todayTotalAmountKg + weightKg;

    // 일일 한도 체크 (2kg)
    let actualInputAmountKg = weightKg;
    if (todayTotalAmountKg >= 2) {
      // 이미 한도 초과 - 기록은 하되 포인트는 지급하지 않음
      actualInputAmountKg = 0;
    } else if (newTotalAmountKg > 2) {
      // 일부만 포인트 대상
      actualInputAmountKg = 2 - todayTotalAmountKg;
    }

    // 투입 기록 생성
    const { data: inputRecord, error: inputError } = await supabase
      .from("input_records")
      .insert({
        user_id: user.id,
        input_amount: weightKg,
        input_type: "coffee_bean", // IWRP는 원두 투입으로 가정
        input_date: today,
        robot_code: robot_code,
      })
      .select()
      .single();

    if (inputError) {
      return NextResponse.json(
        {
          success: false,
          error: "투입 기록 생성에 실패했습니다.",
          message: inputError.message,
        },
        { status: 500 }
      );
    }

    // 포인트 계산 (일일 한도 내에서만)
    let pointsEarned = 0;
    if (actualInputAmountKg > 0) {
      // 0.1kg당 1포인트
      pointsEarned = Math.floor(actualInputAmountKg / 0.1);

      // 포인트 기록 생성
      const { error: pointError } = await supabase.from("user_points").insert({
        user_id: user.id,
        points_earned: pointsEarned,
        points_source: "input_reward",
        source_reference_id: inputRecord.id,
        earned_date: today,
      });

      if (pointError) {
        // 포인트 실패해도 중량 업데이트는 성공으로 처리
        return NextResponse.json(
          {
            success: true,
            message: "중량이 업데이트되었지만 포인트 지급에 실패했습니다.",
            data: {
              robot_code,
              bucket: activeBucket,
              previousWeight: currentWeight,
              addedWeight: weightKg,
              newWeight: newWeight,
              pointsEarned: 0,
              dailyTotal: newTotalAmountKg,
            },
          },
          { status: 200 }
        );
      }
    }

    // bucket 전환 시 이동 명령어 생성
    let bucketMoveCommand = null;
    if (bucketSwitched && nextBucket) {
      const bucketCommandMap: Record<string, string> = {
        bucket2: "(SB2P)",
        bucket3: "(SB3P)",
        bucket4: "(SB4P)",
      };
      bucketMoveCommand = bucketCommandMap[nextBucket] || null;
    }

    return NextResponse.json(
      {
        success: true,
        message: isBucketFull
          ? "모든 수거함이 가득 찼습니다. 수거가 필요합니다."
          : bucketSwitched
          ? `수거함이 가득 차서 ${nextBucket}으로 전환되었습니다.`
          : "중량이 성공적으로 업데이트되었습니다.",
        data: {
          robot_code,
          bucket: activeBucket,
          previousWeight: currentWeight,
          addedWeight: weightKg,
          newWeight: newWeight,
          pointsEarned,
          dailyTotal: newTotalAmountKg,
          pointEligibleAmount: actualInputAmountKg,
          isBucketFull,
          bucketSwitched,
          bucketMoveCommand, // 버킷 이동 명령어 추가
        },
      },
      { status: 200 }
    );
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
