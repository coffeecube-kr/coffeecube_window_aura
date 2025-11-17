"use client";

import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ProgressModal } from "@/components/ui/progress-modal";
import { ErrorModal } from "@/components/ui/error-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { EquipmentStatusData } from "./types";

export default function DashboardPanel() {
  const [activeTab, setActiveTab] = useState<"status" | "command">("status");
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // 장비 상태 데이터
  const [equipmentData, setEquipmentData] = useState<EquipmentStatusData>();

  // 사용자 정보
  const [userId, setUserId] = useState<string | null>(null);
  const [robotCode, setRobotCode] = useState<string>("");

  // Modal 상태 관리
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [showErrorAfterProgress, setShowErrorAfterProgress] = useState(false);

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
    } finally {
      setIsLoading(false);
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

  // 버튼 클릭 핸들러
  const handleCommandClick = async (commandNumber: number) => {
    setModalTitle(`장비명령 ${commandNumber}`);
    setIsModalOpen(true);

    try {
      // 장비명령 API 호출
      const response = await fetch(`/api/equipment/commands/${commandNumber}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ robot_code: robotCode }),
      });
      const result = await response.json();

      if (response.ok) {
        // 성공 시 장비 데이터 업데이트
        if (result.data) {
          setEquipmentData(result.data);
        }
        // 성공/실패에 따라 에러 모달 설정
        setShowErrorAfterProgress(!result.success);
      } else {
        // API 에러 시 에러 모달 표시
        setShowErrorAfterProgress(true);
      }
    } catch {
      // 네트워크 에러 시 에러 모달 표시
      setShowErrorAfterProgress(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (showErrorAfterProgress) {
      setTimeout(() => {
        setIsErrorModalOpen(true);
      }, 500);
    }
  };

  const handleCloseErrorModal = () => {
    setIsErrorModalOpen(false);
    setShowErrorAfterProgress(false);
  };

  const baseTabClass =
    "flex-1 gap-2.5 p-6 text-2xl font-bold leading-8 text-center rounded-3xl cursor-pointer max-md:p-5 max-md:text-2xl max-sm:p-4 max-sm:text-xl h-[82px]";

  const statusTabClass =
    activeTab === "status"
      ? `${baseTabClass} bg-[#D6EED5] text-primary`
      : `${baseTabClass} bg-[#CECECE] text-[#717171]`;

  const commandTabClass =
    activeTab === "command"
      ? `${baseTabClass} bg-[#D6EED5] text-primary`
      : `${baseTabClass} bg-[#CECECE] text-[#717171]`;

  return (
    <>
      <div className="flex gap-4 items-start w-full">
        <button
          className={statusTabClass}
          onClick={() => setActiveTab("status")}
        >
          장비상태
        </button>
        <button
          className={commandTabClass}
          onClick={() => setActiveTab("command")}
        >
          장비명령
        </button>
      </div>

      {activeTab === "status" ? (
        <>
          <div className="flex gap-5 justify-between items-start w-full mt-6 max-md:flex-col max-md:gap-4 max-md:items-center">
            {/* 총 무게 */}
            <div className="box-border flex flex-col gap-5 items-center px-14 py-11 bg-white rounded-xl w-[252px] max-md:px-10 max-md:py-9 max-md:w-full max-md:max-w-[400px] max-sm:gap-4 max-sm:px-6 max-sm:py-8">
              <div className="gap-2.5 px-5 py-1 text-3xl font-bold w-full bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-2xl max-sm:px-4 max-sm:py-1 max-sm:text-xl">
                총 무게
              </div>
              <div className="flex gap-3 justify-center items-center max-sm:gap-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-[56px] w-[120px] max-md:h-[48px] max-md:w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                  </>
                ) : (
                  <>
                    <div>
                      <Image
                        src="/weight.svg"
                        alt="weight"
                        width={40}
                        height={40}
                      />
                    </div>
                    <div className="text-4xl font-bold leading-[56px] text-neutral-800 max-md:text-4xl max-sm:text-3xl">
                      {equipmentData?.total_weight}kg
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 냉장 온도 */}
            <div className="box-border flex flex-col gap-5 items-center py-11 bg-white rounded-xl w-[252px] max-md:px-10 max-md:py-9 max-md:w-full max-md:max-w-[400px] max-sm:gap-4 max-sm:py-8">
              <div className="gap-2.5 px-5 py-1 text-3xl font-bold leading-10 whitespace-nowrap bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-2xl max-sm:px-4 max-sm:py-1 max-sm:text-xl">
                냉장 온도
              </div>
              <div className="flex gap-3 justify-center items-center max-sm:gap-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-[56px] w-[120px] max-md:h-[48px] max-md:w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                  </>
                ) : (
                  <>
                    <div>
                      <Image
                        src="/snow.svg"
                        alt="temperature"
                        width={40}
                        height={40}
                      />
                    </div>
                    <div className="text-4xl font-bold leading-[56px] text-neutral-800 max-md:text-4xl max-sm:text-3xl">
                      {equipmentData?.temperature}°C
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 장비 상태 */}
            <div className="box-border flex flex-col gap-5 items-center py-11 bg-white rounded-xl w-[252px] max-md:py-9  max-sm:gap-4 max-sm:py-8">
              <div className="gap-2.5 px-5 py-1 text-3xl font-bold leading-10 whitespace-nowrap bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-2xl max-sm:px-4 max-sm:py-1 max-sm:text-xl">
                장비 상태
              </div>
              <div className="flex gap-3 justify-center items-center max-sm:gap-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-[56px] w-[120px] max-md:h-[48px] max-md:w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                  </>
                ) : (
                  <>
                    <div>
                      <Image
                        src={
                          equipmentData?.device_status === "정상"
                            ? "/check.svg"
                            : equipmentData?.device_status === "수거필요"
                            ? "/refresh.svg"
                            : "/error.svg"
                        }
                        alt="device"
                        width={40}
                        height={40}
                      />
                    </div>
                    <div
                      className={`text-4xl font-bold leading-[56px] whitespace-nowrap max-md:text-4xl max-sm:text-3xl ${
                        equipmentData?.device_status === "정상"
                          ? "text-primary"
                          : equipmentData?.device_status === "수거필요"
                          ? "text-[#0E8FEB]"
                          : "text-[#DE1443]"
                      }`}
                    >
                      {equipmentData?.device_status}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 최근 명령 기록 */}
        </>
      ) : (
        <div className="grid grid-cols-3 gap-4 w-full max-md:grid-cols-2 max-sm:grid-cols-1">
          {Array.from({ length: 9 }).map((_, index) => (
            <Button
              key={index}
              className="flex items-center justify-center h-[120px] text-[24px] font-extrabold text-white bg-primary rounded-xl"
              onClick={() => handleCommandClick(index + 1)}
            >
              {`장비명령 ${index + 1}`}
            </Button>
          ))}
        </div>
      )}

      <ProgressModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        subtitle="작업이 진행중입니다. 잠시만 기다려주세요."
        progress={50}
        status="진행중"
        robotCode="12345678"
      />

      <ErrorModal isOpen={isErrorModalOpen} onClose={handleCloseErrorModal} />
    </>
  );
}
