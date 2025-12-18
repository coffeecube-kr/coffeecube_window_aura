"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import WelcomeMessage from "./WelcomeMessage";
import UserStats from "./UserStats";
import ActionButtons from "./ActionButtons";
import BucketStatus from "./BucketStatus";
import { User, EquipmentStatusData } from "../types";
import { useRouter } from "next/navigation";

interface ClientContentProps {
  user: User;
}

export default function ClientContent({ user }: ClientContentProps) {
  const router = useRouter();

  // 장비 상태 관련 state
  const [isInitialized, setIsInitialized] = useState(false);
  const [equipmentData, setEquipmentData] = useState<EquipmentStatusData>();
  const [userId, setUserId] = useState<string | null>(null);
  const [robotCode, setRobotCode] = useState<string>("");

  // 중복 요청 방지를 위한 ref
  const hasSavedInitialData = useRef(false);

  // localStorage에서 robot_code 가져오기
  useEffect(() => {
    const storedCode = localStorage.getItem("robot_code");
    if (storedCode) {
      setRobotCode(storedCode);
    }

    // robot_code 변경 이벤트 리스너
    const handleRobotCodeChange = () => {
      const newCode = localStorage.getItem("robot_code");
      if (newCode) {
        setRobotCode(newCode);
      }
    };

    window.addEventListener("robot_code_changed", handleRobotCodeChange);
    return () => {
      window.removeEventListener("robot_code_changed", handleRobotCodeChange);
    };
  }, []);

  const handleSettingsClick = () => {
    router.push("/master");
  };

  // 특정 device_status로 장비 상태 저장
  const saveEquipmentStatusWithDeviceStatus = useCallback(
    async (
      deviceStatus: string,
      equipmentData: EquipmentStatusData,
      userId: string,
      errorDescription?: string
    ) => {
      try {
        if (!equipmentData || !robotCode || !userId) {
          return;
        }

        const saveData = {
          robot_code: robotCode,
          total_weight: equipmentData.total_weight,
          temperature: equipmentData.temperature,
          device_status: deviceStatus,
          action_name: equipmentData.action_name || null,
          action_response: equipmentData.action_response || null,
          user_id: userId,
          description: errorDescription || null,
        };

        const response = await fetch("/api/equipment/status/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saveData),
        });

        if (!response.ok && process.env.NODE_ENV === "development") {
          console.log("Device Status Save Error:", await response.json());
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.log("Device Status Save Network Error:", error);
        }
      }
    },
    [robotCode]
  );

  // RST0 전송 및 RST1 응답 확인 함수
  const checkDeviceStatusWithRST = useCallback(
    async (
      currentEquipmentData: EquipmentStatusData,
      currentUserId: string
    ) => {
      try {
        if (!robotCode) return;

        // Python 서버에 RST0 명령 전송
        const rstResponse = await fetch("http://localhost:8000/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command: "(RST0)",
            timeout: 3.0,
            max_retries: 1,
          }),
        });

        if (!rstResponse.ok) {
          // Python 서버 연결 실패 시 장애 상태로 저장
          const errorMsg = `Python 서버 연결 실패: ${rstResponse.status} ${rstResponse.statusText}`;
          console.log(errorMsg + " - 장애발생 상태로 저장");
          await saveEquipmentStatusWithDeviceStatus(
            "장애발생",
            currentEquipmentData,
            currentUserId,
            errorMsg
          );
          return;
        }

        const rstResult = await rstResponse.json();

        // RST1 응답 확인
        if (rstResult.success && rstResult.responses.includes("(RST1)")) {
          // RST1 수신 성공 - STRP 명령 전송하여 온도값 확인
          console.log("RST1 응답 수신 - STRP 명령 전송하여 온도 확인");

          const strpResponse = await fetch("http://localhost:8000/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              command: "(STRP)",
              timeout: 3.0,
              max_retries: 1,
            }),
          });

          if (!strpResponse.ok) {
            // STRP 전송 실패 시 장애 상태로 저장
            const errorMsg = `STRP 전송 실패: ${strpResponse.status} ${strpResponse.statusText}`;
            console.log(errorMsg + " - 장애발생 상태로 저장");
            await saveEquipmentStatusWithDeviceStatus(
              "장애발생",
              currentEquipmentData,
              currentUserId,
              errorMsg
            );
            return;
          }

          const strpResult = await strpResponse.json();

          if (strpResult.success && strpResult.responses.length > 0) {
            // STRP 응답에서 온도값 파싱 (예: "(T+25)")
            const tempResponse = strpResult.responses[0];
            const tempMatch = tempResponse.match(/\(T\+(\d+)\)/);

            if (tempMatch) {
              // 온도값 추출 성공
              const temperature = parseInt(tempMatch[1], 10);
              console.log(`온도값 확인: ${temperature}°C`);

              // 온도값을 덮어쓴 장비 데이터로 정상 상태 저장
              const updatedEquipmentData = {
                ...currentEquipmentData,
                temperature: temperature,
                device_status: "정상" as const,
              };

              setEquipmentData(updatedEquipmentData);

              await saveEquipmentStatusWithDeviceStatus(
                "정상",
                updatedEquipmentData,
                currentUserId
              );
            } else {
              // 온도값 파싱 실패 시 장애 상태로 저장
              const errorMsg = `온도값 파싱 실패: 응답값 ${tempResponse}`;
              console.log(errorMsg + " - 장애발생 상태로 저장");
              await saveEquipmentStatusWithDeviceStatus(
                "장애발생",
                currentEquipmentData,
                currentUserId,
                errorMsg
              );
            }
          } else {
            // STRP 응답 없음 - 장애 상태로 저장
            const errorMsg = `STRP 응답 없음: ${JSON.stringify(strpResult)}`;
            console.log(errorMsg + " - 장애발생 상태로 저장");
            await saveEquipmentStatusWithDeviceStatus(
              "장애발생",
              currentEquipmentData,
              currentUserId,
              errorMsg
            );
          }
        } else {
          // RST1 미수신 - 장애 상태로 저장
          const errorMsg = `RST1 응답 없음: ${JSON.stringify(rstResult)}`;
          console.log(errorMsg + " - 장애발생 상태로 저장");
          await saveEquipmentStatusWithDeviceStatus(
            "장애발생",
            currentEquipmentData,
            currentUserId,
            errorMsg
          );
        }
      } catch (error) {
        // 에러 발생 시 장애 상태로 저장
        const errorMsg = `RST0/RST1/STRP 체크 오류: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.log(errorMsg + " - 장애발생 상태로 저장:", error);
        await saveEquipmentStatusWithDeviceStatus(
          "장애발생",
          currentEquipmentData,
          currentUserId,
          errorMsg
        );
      }
    },
    [robotCode, saveEquipmentStatusWithDeviceStatus]
  );

  const fetchUserInfo = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        setUserId(user.id);
        return user.id;
      }
      return null;
    } catch (error) {
      // 개발 환경에서만 에러 로깅
      if (process.env.NODE_ENV === "development") {
        console.log("User fetch error:", error);
      }
      return null;
    }
  }, []);

  // 장비 상태 데이터 저장 API 호출
  const saveEquipmentStatus = useCallback(async () => {
    try {
      if (!equipmentData || !robotCode) {
        return;
      }

      const saveData = {
        robot_code: robotCode,
        total_weight: equipmentData.total_weight,
        temperature: equipmentData.temperature,
        device_status: equipmentData.device_status,
        action_name: equipmentData.action_name || null,
        action_response: equipmentData.action_response || null,
        user_id: userId, // 사용자 ID 추가
      };

      const response = await fetch("/api/equipment/status/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saveData),
      });

      const result = await response.json();

      if (!response.ok && process.env.NODE_ENV === "development") {
        // 개발 환경에서 에러 정보 로깅
        console.log("Save API Error:", {
          status: response.status,
          error: result.error,
          sentData: saveData,
          receivedData: result.received_data,
        });
      }
    } catch (error) {
      // 개발 환경에서만 에러 로깅
      if (process.env.NODE_ENV === "development") {
        console.log("Save API Network Error:", error);
      }
    }
  }, [equipmentData, userId, robotCode]);

  // API에서 장비 상태 데이터 가져오기
  const fetchEquipmentStatus = useCallback(async () => {
    try {
      if (!robotCode) return null;

      const response = await fetch(
        `/api/equipment/status?robot_code=${robotCode}`
      );
      const data = await response.json();

      if (response.ok) {
        // 데이터만 반환 (setEquipmentData는 호출하지 않음)
        return data;
      }
      return null;
    } catch {
      // 에러 발생 시 기본값 유지
      return null;
    }
  }, [robotCode]);

  useEffect(() => {
    // 초기 데이터 로드만 수행 (저장은 한 번만)
    const initializeData = async () => {
      if (!isInitialized && robotCode) {
        // 사용자 정보와 장비 상태 데이터를 순서대로 가져오기
        const fetchedUserId = await fetchUserInfo();
        const fetchedEquipmentData = await fetchEquipmentStatus();

        // 초기 장비 데이터 설정
        if (fetchedEquipmentData) {
          setEquipmentData(fetchedEquipmentData);
        }

        // 장비 상태 체크 (RST0 전송 및 RST1 응답 확인)
        // checkDeviceStatusWithRST에서 온도와 장비 상태를 모두 업데이트하고 /save 호출
        if (fetchedEquipmentData && fetchedUserId) {
          await checkDeviceStatusWithRST(fetchedEquipmentData, fetchedUserId);
        }

        setIsInitialized(true);
      }
    };

    initializeData();
  }, [isInitialized, robotCode]); // 초기 진입 시에만 실행

  // 중량 업데이트 이벤트 리스너
  useEffect(() => {
    const handleWeightUpdate = () => {
      fetchEquipmentStatus();
    };

    window.addEventListener("weight_updated", handleWeightUpdate);
    return () => {
      window.removeEventListener("weight_updated", handleWeightUpdate);
    };
  }, [fetchEquipmentStatus]);

  return (
    <div className="relative flex flex-col items-center justify-start h-screen">
      {/* 설정 버튼 */}
      <Button
        className="absolute bottom-10 left-20 w-20 h-20 bg-[#CECECE] rounded-[20px]"
        onClick={handleSettingsClick}
      >
        <Image
          src="/mdi_gear.svg"
          alt="settings"
          width={32}
          height={32}
          className="text-white"
        />
      </Button>

      {/* 상단 이미지 */}
      <div className="w-full h-[880px] relative">
        <Image src="/main.png" alt="main" fill className="object-cover" />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 w-full mt-10 px-20">
        <div className="w-full min-h-[920px] px-11 py-12 bg-[#F4F4F4] rounded-[16px] flex flex-col">
          {/* 환영 메시지 */}
          <WelcomeMessage user={user} />

          {/* 수거함 상태 */}
          <div className="mt-6">
            <BucketStatus
              equipmentData={equipmentData}
              loading={!isInitialized}
            />
          </div>

          {/* 사용자 통계 */}
          <div className="mt-6">
            <UserStats />
          </div>

          {/* 액션 버튼들 */}
          <div className="mt-8">
            <ActionButtons />
          </div>
        </div>
      </div>
    </div>
  );
}
