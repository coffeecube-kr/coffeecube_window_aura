"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressModal } from "@/components/ui/progress-modal";
import { ErrorModal } from "@/components/ui/error-modal";
import { useSerialPort } from "./hooks/useSerialPort";
import type { ButtonWithCommands } from "./types";

export default function ActionButtons() {
  const [buttons, setButtons] = useState<ButtonWithCommands[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [showErrorAfterProgress, setShowErrorAfterProgress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [robotCode, setRobotCode] = useState<string>("");

  // Serial Port 훅 사용
  const { executeCommandSequence, error: serialError } = useSerialPort();

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

  // 버튼 데이터 가져오기
  useEffect(() => {
    const fetchButtons = async () => {
      try {
        const response = await fetch("/api/buttons");
        if (!response.ok) {
          setErrorTitle("데이터 로드 오류");
          setErrorMessage("버튼 데이터를 불러오는데 실패했습니다.");
          setIsErrorModalOpen(true);
          return;
        }
        const data = await response.json();
        setButtons(data.buttons || []);
      } catch (error) {
        setErrorTitle("데이터 로드 오류");
        setErrorMessage("버튼 데이터를 불러오는데 실패했습니다.");
        setIsErrorModalOpen(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchButtons();
  }, []);

  // 버튼 클릭 핸들러
  const handleButtonClick = useCallback(
    async (button: ButtonWithCommands) => {
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
        send: cmd.send,
        receive: cmd.receive,
        duration: cmd.duration,
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
      } else {
        // 실패 시 오류 처리
        setErrorTitle("시리얼 통신 오류");
        setErrorMessage(serialError || "명령 실행에 실패했습니다.");
        setShowErrorAfterProgress(true);
      }

      setIsProcessing(false);
    },
    [executeCommandSequence, serialError]
  );

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 w-full mt-20">
        {/* 3개의 행을 Skeleton으로 표시 */}
        {[1, 2, 3].map((row) => (
          <div key={row} className="flex flex-row gap-4 w-full">
            {[1, 2, 3].map((col) => (
              <Skeleton
                key={col}
                className="flex h-[24px] w-[24px] rounded-[16px]"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // 버튼을 3개씩 나누어 행으로 구성
  const buttonRows: ButtonWithCommands[][] = [];
  for (let i = 0; i < buttons.length; i += 3) {
    buttonRows.push(buttons.slice(i, i + 3));
  }

  return (
    <>
      <div className="flex flex-col gap-4 w-full mt-20">
        {buttonRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-row gap-4 w-full">
            {row.map((button) => (
              <Button
                key={button.button_no}
                className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
                onClick={() => handleButtonClick(button)}
                disabled={isProcessing}
              >
                {button.name}
              </Button>
            ))}
          </div>
        ))}
      </div>

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
    </>
  );
}
