"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ProgressModal } from "@/components/ui/progress-modal";
import { ErrorModal } from "@/components/ui/error-modal";

export default function ActionButtons() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [showErrorAfterProgress, setShowErrorAfterProgress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [todayInputAmount, setTodayInputAmount] = useState(0);
  const [isLoadingTodayAmount, setIsLoadingTodayAmount] = useState(true);

  // 오늘 투입량 조회 함수
  const fetchTodayInputAmount = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `/api/input-records?start_date=${today}&end_date=${today}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.records) {
          const totalToday = data.data.records.reduce(
            (sum: number, record: { input_amount: number }) =>
              sum + Number(record.input_amount),
            0
          );
          setTodayInputAmount(totalToday);
        }
      }
    } catch {
      // 조회 실패 시 기본값 유지
    } finally {
      setIsLoadingTodayAmount(false);
    }
  };

  // 컴포넌트 마운트 시 오늘 투입량 조회
  useEffect(() => {
    fetchTodayInputAmount();
  }, []);

  // 투입 가능 여부 확인 함수
  const canInput = (amount: number) => {
    return todayInputAmount < 2 && todayInputAmount + amount > 0;
  };

  // 실제 투입 가능한 양 계산
  const getActualInputAmount = (requestedAmount: number) => {
    if (todayInputAmount >= 2) {
      return 0;
    }
    return Math.min(requestedAmount, 2 - todayInputAmount);
  };

  const createInputRecord = async (inputType: string, amount: number) => {
    try {
      const response = await fetch("/api/input-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input_type: inputType,
          input_amount: amount,
          input_date: new Date().toISOString().split("T")[0],
          robot_code: process.env.NEXT_PUBLIC_ROBOT_CODE,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // API에서 받은 에러 정보를 활용
        const errorInfo = {
          title: data.error || "오류 발생",
          message: data.message || "투입 기록 생성에 실패했습니다.",
          details: data.details || "",
          ...data,
        };
        throw errorInfo;
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  const handleCommand1Click = async () => {
    setModalTitle("원두 투입");
    setIsModalOpen(true);
    setShowErrorAfterProgress(false);
    setIsProcessing(true);

    try {
      // 원두 2.5kg 투입
      await createInputRecord("coffee_bean", 2.5);

      // 성공 시 모달 닫기
      setTimeout(() => {
        setIsModalOpen(false);
        setIsProcessing(false);
        // 오늘 투입량 다시 조회
        fetchTodayInputAmount();
        // 페이지 새로고침으로 통계 업데이트
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      setIsModalOpen(false);
      setIsProcessing(false);
      const errorObj = error as {
        title?: string;
        error?: string;
        message?: string;
      };
      setErrorTitle(errorObj.title || errorObj.error || "오류 발생");
      setErrorMessage(errorObj.message || "투입 중 오류가 발생했습니다.");
      setIsErrorModalOpen(true);
    }
  };

  const handleCommand2Click = async () => {
    setModalTitle("물 투입");
    setIsModalOpen(true);
    setShowErrorAfterProgress(false);
    setIsProcessing(true);

    try {
      // 물 1.0kg 투입
      await createInputRecord("coffee_bean", 1.0);

      // 성공 시 모달 닫기
      setTimeout(() => {
        setIsModalOpen(false);
        setIsProcessing(false);
        // 오늘 투입량 다시 조회
        fetchTodayInputAmount();
        // 페이지 새로고침으로 통계 업데이트
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      setIsModalOpen(false);
      setIsProcessing(false);
      const errorObj = error as {
        title?: string;
        error?: string;
        message?: string;
      };
      setErrorTitle(errorObj.title || errorObj.error || "오류 발생");
      setErrorMessage(errorObj.message || "투입 중 오류가 발생했습니다.");
      setIsErrorModalOpen(true);
    }
  };

  const handleCommand3Click = async () => {
    setModalTitle("우유 투입");
    setIsModalOpen(true);
    setShowErrorAfterProgress(false);
    setIsProcessing(true);

    try {
      // 우유 0.8kg 투입
      await createInputRecord("coffee_bean", 0.8);

      // 성공 시 모달 닫기
      setTimeout(() => {
        setIsModalOpen(false);
        setIsProcessing(false);
        // 오늘 투입량 다시 조회
        fetchTodayInputAmount();
        // 페이지 새로고침으로 통계 업데이트
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      setIsModalOpen(false);
      setIsProcessing(false);
      const errorObj = error as {
        title?: string;
        error?: string;
        message?: string;
      };
      setErrorTitle(errorObj.title || errorObj.error || "오류 발생");
      setErrorMessage(errorObj.message || "투입 중 오류가 발생했습니다.");
      setIsErrorModalOpen(true);
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

  return (
    <>
      <div className="flex flex-row gap-4 w-full mt-20">
        <Button
          className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] font-bold disabled:opacity-50"
          onClick={handleCommand1Click}
          disabled={isProcessing || isLoadingTodayAmount || !canInput(2.5)}
          title={
            todayInputAmount >= 2
              ? "오늘 일일 투입량 한도(2kg)에 도달했습니다."
              : !canInput(2.5) && todayInputAmount < 2
              ? `투입 가능량: ${getActualInputAmount(2.5).toFixed(1)}kg`
              : ""
          }
        >
          2.5kg 투입
          {!isLoadingTodayAmount &&
            todayInputAmount < 2 &&
            getActualInputAmount(2.5) < 2.5 && (
              <span className="block text-xs opacity-80">
                (가능: {getActualInputAmount(2.5).toFixed(1)}kg)
              </span>
            )}
        </Button>

        <Button
          className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] font-bold disabled:opacity-50"
          onClick={handleCommand2Click}
          disabled={isProcessing || isLoadingTodayAmount || !canInput(1.0)}
          title={
            todayInputAmount >= 2
              ? "오늘 일일 투입량 한도(2kg)에 도달했습니다."
              : !canInput(1.0) && todayInputAmount < 2
              ? `투입 가능량: ${getActualInputAmount(1.0).toFixed(1)}kg`
              : ""
          }
        >
          1.0kg 투입
          {!isLoadingTodayAmount &&
            todayInputAmount < 2 &&
            getActualInputAmount(1.0) < 1.0 && (
              <span className="block text-xs opacity-80">
                (가능: {getActualInputAmount(1.0).toFixed(1)}kg)
              </span>
            )}
        </Button>

        <Button
          className="flex-1 h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] font-bold disabled:opacity-50"
          onClick={handleCommand3Click}
          disabled={isProcessing || isLoadingTodayAmount || !canInput(0.8)}
          title={
            todayInputAmount >= 2
              ? "오늘 일일 투입량 한도(2kg)에 도달했습니다."
              : !canInput(0.8) && todayInputAmount < 2
              ? `투입 가능량: ${getActualInputAmount(0.8).toFixed(1)}kg`
              : ""
          }
        >
          0.8kg 투입
          {!isLoadingTodayAmount &&
            todayInputAmount < 2 &&
            getActualInputAmount(0.8) < 0.8 && (
              <span className="block text-xs opacity-80">
                (가능: {getActualInputAmount(0.8).toFixed(1)}kg)
              </span>
            )}
        </Button>
      </div>

      <ProgressModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
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
