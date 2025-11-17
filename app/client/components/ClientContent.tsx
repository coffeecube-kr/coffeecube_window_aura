"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import WelcomeMessage from "./WelcomeMessage";
import UserStats from "./UserStats";
import ActionButtons from "./ActionButtons";
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

  // 사용자 인증 정보 가져오기
  const fetchUserInfo = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        setUserId(user.id);
      }
    } catch (error) {
      // 개발 환경에서만 에러 로깅
      if (process.env.NODE_ENV === "development") {
        console.log("User fetch error:", error);
      }
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
      if (!robotCode) return;

      const response = await fetch(
        `/api/equipment/status?robot_code=${robotCode}`
      );
      const data = await response.json();

      if (response.ok) {
        setEquipmentData(data);
      }
    } catch {
      // 에러 발생 시 기본값 유지
    }
  }, [robotCode]);

  useEffect(() => {
    // 초기 데이터 로드만 수행 (저장은 한 번만)
    const initializeData = async () => {
      if (!isInitialized && robotCode) {
        // 사용자 정보와 장비 상태 데이터를 순서대로 가져오기
        await fetchUserInfo();
        await fetchEquipmentStatus();

        setIsInitialized(true);
      }
    };

    initializeData();
  }, [fetchUserInfo, fetchEquipmentStatus, isInitialized, robotCode]);

  // 사용자 정보와 장비 데이터가 모두 로드된 후에 저장 실행
  useEffect(() => {
    const saveInitialData = async () => {
      if (
        isInitialized &&
        equipmentData &&
        userId &&
        !hasSavedInitialData.current
      ) {
        await saveEquipmentStatus();
        hasSavedInitialData.current = true;
      }
    };

    saveInitialData();
  }, [isInitialized, equipmentData, userId, saveEquipmentStatus]);

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
        <div className="w-full h-[920px] px-11 py-20 bg-[#F4F4F4] rounded-[16px]">
          {/* 환영 메시지 */}
          <WelcomeMessage user={user} />

          {/* 사용자 통계 */}
          <UserStats />

          {/* 액션 버튼들 */}
          <ActionButtons />
        </div>
      </div>
    </div>
  );
}
