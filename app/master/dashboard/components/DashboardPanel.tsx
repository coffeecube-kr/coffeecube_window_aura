"use client";

import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ProgressModal } from "@/components/ui/progress-modal";
import { ErrorModal } from "@/components/ui/error-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { RobotCodeSelectorModal } from "@/components/ui/robot-code-selector-modal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { EquipmentStatusData, AdminButton } from "./types";
import { useSerialPort } from "./hooks/useSerialPort";
import { useTemperature } from "./hooks/useTemperature";
import { useDeviceStatus } from "./hooks/useDeviceStatus";

export default function DashboardPanel() {
  const [activeTab, setActiveTab] = useState<"status" | "command">("status");
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // 장비 상태 데이터
  const [equipmentData, setEquipmentData] = useState<EquipmentStatusData>();

  // 버튼 데이터
  const [buttons, setButtons] = useState<AdminButton[]>([]);

  // 사용자 정보
  const [userId, setUserId] = useState<string | null>(null);
  const [robotCode, setRobotCode] = useState<string>("");

  // Modal 상태 관리
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [showErrorAfterProgress, setShowErrorAfterProgress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRobotCodeModalOpen, setIsRobotCodeModalOpen] = useState(false);

  // 중복 요청 방지를 위한 ref
  const hasSavedInitialData = useRef(false);

  // Serial Port 훅 사용
  const { executeCommandSequence, error: serialError } = useSerialPort();

  // Temperature 훅 사용
  const {
    temperature: serialTemperature,
    readTemperature,
    isReading: isTempReading,
  } = useTemperature();

  // DeviceStatus 훅 사용
  const {
    deviceStatus: serialDeviceStatus,
    checkDeviceStatus,
    isChecking: isStatusChecking,
  } = useDeviceStatus();

  // localStorage에서 robot_code 가져오기
  useEffect(() => {
    const storedCode = localStorage.getItem("robot_code");
    if (storedCode) {
      setRobotCode(storedCode);
    } else {
      // robot_code가 없으면 toast 띄우고 모달 열기
      toast.error("장비 번호를 선택해주세요.", {
        duration: 3000,
        position: "top-center",
      });
      setIsRobotCodeModalOpen(true);
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

  // robot_code 선택 핸들러
  const handleRobotCodeSelect = (selectedRobotCode: string) => {
    localStorage.setItem("robot_code", selectedRobotCode);
    setRobotCode(selectedRobotCode);
    window.dispatchEvent(new Event("robot_code_changed"));
    toast.success("장비가 선택되었습니다.", {
      duration: 3000,
      position: "top-center",
    });
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

      // serial 통신으로 읽은 온도 사용, 없으면 99
      const currentTemp =
        serialTemperature !== null
          ? serialTemperature
          : equipmentData.temperature;
      // serial 통신으로 확인한 장비 상태 사용
      const currentStatus = serialDeviceStatus || equipmentData.device_status;

      const saveData = {
        robot_code: robotCode,
        total_weight: equipmentData.total_weight,
        temperature: currentTemp,
        device_status: currentStatus,
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
  }, [equipmentData, userId, robotCode, serialTemperature, serialDeviceStatus]);

  // API에서 장비 상태 데이터 가져오기
  const fetchEquipmentStatus = useCallback(async () => {
    try {
      if (!robotCode) return;

      const response = await fetch(
        `/api/equipment/status?robot_code=${robotCode}`
      );
      const data = await response.json();

      if (response.ok) {
        // API에서 받은 온도와 장비 상태를 무시하고 초기화 (serial 통신으로만 설정)
        setEquipmentData({
          ...data,
          temperature: 99,
          device_status: "장애발생",
        });
      }
    } catch {
      // 에러 발생 시 기본값 유지
    } finally {
      setIsLoading(false);
    }
  }, [robotCode]);

  // 온도 업데이트 함수
  const updateTemperature = useCallback(async () => {
    if (!robotCode || isTempReading) return;

    const temp = await readTemperature();
    // 온도를 못 가져오면 99로 설정
    const finalTemp = temp !== null ? temp : 99;

    if (equipmentData) {
      setEquipmentData({
        ...equipmentData,
        temperature: finalTemp,
      });
    }
  }, [robotCode, isTempReading, readTemperature, equipmentData]);

  // 장비 상태 업데이트 함수
  const updateDeviceStatus = useCallback(async () => {
    if (!robotCode || isStatusChecking || !equipmentData) return;

    const status = await checkDeviceStatus({
      bucket1: equipmentData.bucket1 || 0,
      bucket2: equipmentData.bucket2 || 0,
      bucket3: equipmentData.bucket3 || 0,
      bucket4: equipmentData.bucket4 || 0,
    });

    if (equipmentData) {
      setEquipmentData({
        ...equipmentData,
        device_status: status,
      });
    }
  }, [robotCode, isStatusChecking, checkDeviceStatus, equipmentData]);

  // admin 버튼 데이터 가져오기
  const fetchAdminButtons = useCallback(async () => {
    try {
      const response = await fetch("/api/buttons/admin");
      const data = await response.json();

      if (response.ok && data.buttons) {
        setButtons(data.buttons);
      }
    } catch {
      // 에러 발생 시 빈 배열 유지
    }
  }, []);

  useEffect(() => {
    // 초기 데이터 로드만 수행 (저장은 한 번만)
    const initializeData = async () => {
      if (!isInitialized && robotCode) {
        // 사용자 정보와 장비 상태 데이터를 순서대로 가져오기
        await fetchUserInfo();
        await fetchEquipmentStatus();
        await fetchAdminButtons();

        // 초기 온도 읽기
        await updateTemperature();

        // 초기 장비 상태 확인
        await updateDeviceStatus();

        setIsInitialized(true);
      }
    };

    initializeData();
  }, [
    fetchUserInfo,
    fetchEquipmentStatus,
    fetchAdminButtons,
    updateTemperature,
    updateDeviceStatus,
    isInitialized,
    robotCode,
  ]);

  // 온도 및 장비 상태 주기적 업데이트 (30초마다)
  useEffect(() => {
    if (!isInitialized || !robotCode) return;

    const intervalId = setInterval(() => {
      updateTemperature();
      updateDeviceStatus();
    }, 30000); // 30초

    return () => clearInterval(intervalId);
  }, [isInitialized, robotCode, updateTemperature, updateDeviceStatus]);

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
  const handleCommandClick = async (button: AdminButton) => {
    setModalTitle(button.name);
    setIsModalOpen(true);
    setIsProcessing(true);
    setProgress(0);

    if (button.commands.length === 0) {
      setErrorTitle("명령 오류");
      setErrorMessage("실행할 명령이 없습니다.");
      setShowErrorAfterProgress(true);
      setIsProcessing(false);
      return;
    }

    // 명령 시퀀스 준비
    const commandSequence = button.commands.map((cmd) => ({
      send: cmd.send || "",
      receive: cmd.receive,
      duration: cmd.duration || 0,
    }));

    // 총 단계 수 계산: 각 명령마다 send + receive(또는 duration 대기) = 2단계
    const totalSteps = commandSequence.length * 2;

    // 순차 실행
    const success = await executeCommandSequence(
      commandSequence,
      (commandIndex, totalCommands, stepInCommand) => {
        // 현재 단계 계산: 명령 인덱스 * 2 + (send=0, receive=1)
        const currentStep =
          commandIndex * 2 + (stepInCommand === "send" ? 0 : 1);
        const progressPercent = Math.round((currentStep / totalSteps) * 100);
        setProgress(progressPercent);
      }
    );

    if (success) {
      // 성공 시에만 100%로 설정
      setProgress(100);

      // 장비 상태 업데이트
      await fetchEquipmentStatus();
    } else {
      // 실패 시 오류 처리
      setErrorTitle("시리얼 통신 오류");
      setErrorMessage(serialError || "명령 실행에 실패했습니다.");
      setShowErrorAfterProgress(true);
    }

    setIsProcessing(false);
  };

  const handleCompleteModal = useCallback(() => {
    setIsProcessing(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setIsProcessing(false);
    if (showErrorAfterProgress) {
      setTimeout(() => {
        setIsErrorModalOpen(true);
      }, 500);
    }
  }, [showErrorAfterProgress]);

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
          {/* 1행: 4개의 통 무게 */}
          <div className="grid grid-cols-4 gap-4 w-full mt-6 max-md:grid-cols-2 max-sm:grid-cols-1">
            {/* 통 1 */}
            <div className="box-border flex flex-col gap-3 items-center px-6 py-8 bg-white rounded-xl max-sm:gap-2 max-sm:px-4 max-sm:py-6">
              <div className="gap-2.5 px-4 py-1 text-2xl font-bold bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-xl max-sm:text-lg">
                수거함 1
              </div>
              <div className="flex gap-2 justify-center items-center">
                {isLoading ? (
                  <Skeleton className="h-[48px] w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                ) : (
                  <>
                    <Image
                      src="/weight.svg"
                      alt="weight"
                      width={32}
                      height={32}
                    />
                    <div className="text-3xl font-bold text-neutral-800 max-md:text-2xl max-sm:text-xl">
                      {equipmentData?.bucket1 || 0}kg
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 통 2 */}
            <div className="box-border flex flex-col gap-3 items-center px-6 py-8 bg-white rounded-xl max-sm:gap-2 max-sm:px-4 max-sm:py-6">
              <div className="gap-2.5 px-4 py-1 text-2xl font-bold bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-xl max-sm:text-lg">
                수거함 2
              </div>
              <div className="flex gap-2 justify-center items-center">
                {isLoading ? (
                  <Skeleton className="h-[48px] w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                ) : (
                  <>
                    <Image
                      src="/weight.svg"
                      alt="weight"
                      width={32}
                      height={32}
                    />
                    <div className="text-3xl font-bold text-neutral-800 max-md:text-2xl max-sm:text-xl">
                      {equipmentData?.bucket2 || 0}kg
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 통 3 */}
            <div className="box-border flex flex-col gap-3 items-center px-6 py-8 bg-white rounded-xl max-sm:gap-2 max-sm:px-4 max-sm:py-6">
              <div className="gap-2.5 px-4 py-1 text-2xl font-bold bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-xl max-sm:text-lg">
                수거함 3
              </div>
              <div className="flex gap-2 justify-center items-center">
                {isLoading ? (
                  <Skeleton className="h-[48px] w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                ) : (
                  <>
                    <Image
                      src="/weight.svg"
                      alt="weight"
                      width={32}
                      height={32}
                    />
                    <div className="text-3xl font-bold text-neutral-800 max-md:text-2xl max-sm:text-xl">
                      {equipmentData?.bucket3 || 0}kg
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 통 4 */}
            <div className="box-border flex flex-col gap-3 items-center px-6 py-8 bg-white rounded-xl max-sm:gap-2 max-sm:px-4 max-sm:py-6">
              <div className="gap-2.5 px-4 py-1 text-2xl font-bold bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-xl max-sm:text-lg">
                수거함 4
              </div>
              <div className="flex gap-2 justify-center items-center">
                {isLoading ? (
                  <Skeleton className="h-[48px] w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                ) : (
                  <>
                    <Image
                      src="/weight.svg"
                      alt="weight"
                      width={32}
                      height={32}
                    />
                    <div className="text-3xl font-bold text-neutral-800 max-md:text-2xl max-sm:text-xl">
                      {equipmentData?.bucket4 || 0}kg
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2행: 냉장온도와 장비상태 */}
          <div className="grid grid-cols-2 gap-4 w-full mt-4 max-sm:grid-cols-1">
            {/* 냉장 온도 */}
            <div className="box-border flex flex-col gap-5 items-center py-11 bg-white rounded-xl max-md:py-9 max-sm:gap-4 max-sm:py-8">
              <div className="gap-2.5 px-5 py-1 text-3xl font-bold leading-10 whitespace-nowrap bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-2xl max-sm:px-4 max-sm:py-1 max-sm:text-xl">
                냉장 온도
              </div>
              <div className="flex gap-3 justify-center items-center max-sm:gap-2">
                {isLoading || isTempReading ? (
                  <Skeleton className="h-[56px] w-[120px] max-md:h-[48px] max-md:w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                ) : (
                  <>
                    <Image
                      src="/snow.svg"
                      alt="temperature"
                      width={40}
                      height={40}
                    />
                    <div className="text-4xl font-bold leading-[56px] text-neutral-800 max-md:text-4xl max-sm:text-3xl">
                      {serialTemperature !== null
                        ? serialTemperature
                        : equipmentData?.temperature}
                      °C
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 장비 상태 */}
            <div className="box-border flex flex-col gap-5 items-center py-11 bg-white rounded-xl max-md:py-9 max-sm:gap-4 max-sm:py-8">
              <div className="gap-2.5 px-5 py-1 text-3xl font-bold leading-10 whitespace-nowrap bg-gray-200 rounded-[100px] text-zinc-500 max-md:text-2xl max-sm:px-4 max-sm:py-1 max-sm:text-xl">
                장비 상태
              </div>
              <div className="flex gap-3 justify-center items-center max-sm:gap-2">
                {isLoading ? (
                  <Skeleton className="h-[56px] w-[120px] max-md:h-[48px] max-md:w-[100px] max-sm:h-[40px] max-sm:w-[80px]" />
                ) : (
                  <>
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
          {buttons.length > 0 ? (
            buttons.map((button) => (
              <Button
                key={button.button_no}
                className="flex items-center justify-center h-[120px] text-[24px] font-extrabold text-white bg-primary rounded-xl disabled:opacity-50"
                onClick={() => handleCommandClick(button)}
                disabled={isProcessing}
              >
                {button.name}
              </Button>
            ))
          ) : (
            <div className="col-span-3 text-center text-gray-500 py-8">
              사용 가능한 명령이 없습니다.
            </div>
          )}
        </div>
      )}

      <ProgressModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onComplete={handleCompleteModal}
        title={modalTitle}
        subtitle="작업이 진행중입니다. 잠시만 기다려주세요."
        progress={progress}
        status={isProcessing ? "진행중" : "완료"}
        robotCode={robotCode}
      />

      <ErrorModal
        isOpen={isErrorModalOpen}
        onClose={handleCloseErrorModal}
        title={errorTitle}
        message={errorMessage}
      />

      <RobotCodeSelectorModal
        isOpen={isRobotCodeModalOpen}
        onClose={() => setIsRobotCodeModalOpen(false)}
        onSelect={handleRobotCodeSelect}
      />
    </>
  );
}
