"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ProgressModal } from "@/components/ui/progress-modal";
import { ErrorModal } from "@/components/ui/error-modal";
import { useSerialPort } from "./hooks/useSerialPort";

export default function ActionButtons() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [showErrorAfterProgress, setShowErrorAfterProgress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Serial Port 훅 사용
  const { sendCommand, error: serialError } = useSerialPort();

  // 열기 버튼 핸들러
  const handleOpenClick = async () => {
    setModalTitle("열기");
    setIsModalOpen(true);
    setIsProcessing(true);
    
    // COM1에 (IBNP) 전송
    const success = await sendCommand("(IBNP)");
    
    if (!success) {
      setErrorTitle("시리얼 통신 오류");
      setErrorMessage(serialError || "명령 전송에 실패했습니다.");
      setShowErrorAfterProgress(true);
    }
  };

  // 닫기 버튼 핸들러
  const handleCloseClick = async () => {
    setModalTitle("닫기");
    setIsModalOpen(true);
    setIsProcessing(true);
    
    // COM1에 (IBMP) 전송
    const success = await sendCommand("(IBMP)");
    
    if (!success) {
      setErrorTitle("시리얼 통신 오류");
      setErrorMessage(serialError || "명령 전송에 실패했습니다.");
      setShowErrorAfterProgress(true);
    }
  };

  // 한번더 버튼 핸들러
  const handleRepeatClick = async () => {
    setModalTitle("한번더");
    setIsModalOpen(true);
    setIsProcessing(true);
    
    // COM1에 (IBNP) 전송
    const success = await sendCommand("(IBNP)");
    
    if (!success) {
      setErrorTitle("시리얼 통신 오류");
      setErrorMessage(serialError || "명령 전송에 실패했습니다.");
      setShowErrorAfterProgress(true);
    }
  };

  // 종료 버튼 핸들러
  const handleExitClick = async () => {
    setModalTitle("종료");
    setIsModalOpen(true);
    setIsProcessing(true);
  };

  // 비상정지 버튼 핸들러
  const handleEmergencyStopClick = async () => {
    setModalTitle("비상정지");
    setIsModalOpen(true);
    setIsProcessing(true);
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

  return (
    <>
      <div className="flex flex-col gap-4 w-full mt-20">
        {/* 1행: 3개 버튼 */}
        <div className="flex flex-row gap-4 w-full">
          <Button
            className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
            onClick={handleOpenClick}
            disabled={isProcessing}
          >
            열기
          </Button>

          <Button
            className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
            onClick={handleCloseClick}
            disabled={isProcessing}
          >
            닫기
          </Button>

          <Button
            className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
            onClick={handleRepeatClick}
            disabled={isProcessing}
          >
            한번더
          </Button>
        </div>

        {/* 2행: 2개 버튼 */}
        <div className="flex flex-row gap-4 w-full">
          <Button
            className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
            onClick={handleExitClick}
            disabled={isProcessing}
          >
            종료
          </Button>

          <Button
            className="flex-1 h-[82px] font-bold rounded-[16px] bg-destructive hover:bg-destructive/90 text-white text-[24px] disabled:opacity-50"
            onClick={handleEmergencyStopClick}
            disabled={isProcessing}
          >
            비상정지
          </Button>
        </div>
      </div>

      <ProgressModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onComplete={handleCompleteModal}
        title={modalTitle}
        subtitle="작업이 진행중입니다. 잠시만 기다려주세요."
        progress={50}
        status="진행중"
        robotCode="12345678"
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
