"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressModal } from "@/components/ui/progress-modal";
import { ErrorModal } from "@/components/ui/error-modal";
import { createClient } from "@/lib/supabase/client";
import { useActionMode } from "./hooks/useActionMode";
import type { ButtonWithCommands } from "./types";

export default function ActionButtons() {
  const router = useRouter();
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
  const [currentSendSignal, setCurrentSendSignal] = useState<string>("-");
  const [currentExpectedSignal, setCurrentExpectedSignal] =
    useState<string>("-");
  const [currentReceiveSignal, setCurrentReceiveSignal] = useState<string>("-");
  const [allSendSignals, setAllSendSignals] = useState<string[]>([]);
  const [currentCommandIndex, setCurrentCommandIndex] = useState<number>(-1);
  const [isBucketFull, setIsBucketFull] = useState(false);
  const [originalCommandCount, setOriginalCommandCount] = useState<number>(0);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const bucketMoveCommandRef = useRef<string | null>(null);
  const transactionUuidRef = useRef<string | null>(null);

  // Action Mode 훅 사용 (환경변수에 따라 테스트/실제 모드 선택)
  const {
    executeCommandSequence,
    cancelExecution,
    error: serialError,
  } = useActionMode();

  const handleTerminateClick = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }, [router]);

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

  // 장비 상태 및 일일 한도 확인
  useEffect(() => {
    const checkStatus = async () => {
      const storedCode = localStorage.getItem("robot_code");
      if (!storedCode) return;

      try {
        // 장비 상태 확인
        const equipmentResponse = await fetch(
          `/api/equipment/status?robot_code=${storedCode}`
        );
        if (equipmentResponse.ok) {
          const data = await equipmentResponse.json();
          // bucket1~4가 모두 13kg 초과인지 확인
          const allBucketsFull =
            data.bucket1 > 13 &&
            data.bucket2 > 13 &&
            data.bucket3 > 13 &&
            data.bucket4 > 13;
          setIsBucketFull(allBucketsFull);
        }

        // 일일 투입량 한도 확인
        const dailyResponse = await fetch(
          "/api/input-records?check_daily=true"
        );
        if (dailyResponse.ok) {
          const dailyData = await dailyResponse.json();
          setIsDailyLimitReached(dailyData.data?.isLimitReached || false);
        }
      } catch (error) {
        // 에러 무시 (상태 확인 실패 시 기본값 유지)
      }
    };

    checkStatus();

    // 주기적으로 상태 확인 (30초마다)
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [robotCode]);

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
      // 진행 상태 완전 초기화
      setProgress(0);
      setCurrentSendSignal("-");
      setCurrentExpectedSignal("-");
      setCurrentReceiveSignal("-");
      setCurrentCommandIndex(-1);
      setAllSendSignals([]);
      setOriginalCommandCount(0);
      bucketMoveCommandRef.current = null;

      // 이 버튼 클릭에 대한 고유 UUID 생성 (중복 방지용)
      transactionUuidRef.current = crypto.randomUUID();

      // 모달 열기
      setModalTitle(button.name);
      setIsModalOpen(true);
      setIsProcessing(true);

      if (button.commands.length === 0) {
        // setErrorTitle("명령 오류");
        // setErrorMessage("실행할 명령이 없습니다.");
        // setShowErrorAfterProgress(true);
        setIsProcessing(false);
        return;
      }

      // 명령 시퀀스 준비 (duration을 초 단위에서 밀리초로 변환)
      const commandSequence = button.commands.map((cmd) => ({
        send: cmd.send,
        receive: cmd.receive,
        duration: cmd.duration * 1000, // 초를 밀리초로 변환
      }));

      // 전체 송신신호 리스트 설정
      const sendSignals = commandSequence.map((cmd) => cmd.send);
      setAllSendSignals(sendSignals);
      setCurrentCommandIndex(-1);
      setOriginalCommandCount(sendSignals.length); // 원래 명령어 개수 저장
      bucketMoveCommandRef.current = null; // 버킷 이동 명령어 초기화

      try {
        // 순차 실행 (버튼명 전달)
        const success = await executeCommandSequence(
          commandSequence,
          async (commandIndex, totalCommands, stepInCommand, actualReceive) => {
            // 현재 명령 인덱스 업데이트
            setCurrentCommandIndex(commandIndex);

            // 현재 송신/예상/수신 신호 업데이트
            const currentCommand = commandSequence[commandIndex];
            if (stepInCommand === "send") {
              // 송신 시에만 프로그레스바 업데이트 (최대 99%까지만)
              const progressPercent = Math.min(
                99,
                Math.round(((commandIndex + 1) / commandSequence.length) * 99)
              );
              setProgress(progressPercent);

              setCurrentSendSignal(currentCommand.send || "-");
              setCurrentExpectedSignal(currentCommand.receive || "-");
              setCurrentReceiveSignal("-"); // 송신 시작 시 수신 신호 초기화
            } else {
              // 수신 시에는 신호 정보만 업데이트 (프로그레스바는 변경하지 않음)
              // actualReceive가 있으면 사용 (테스트 모드의 mock 응답 또는 실제 응답)
              setCurrentReceiveSignal(actualReceive || "-");

              // IWRP 명령 감지 시 update-weight API 호출
              // 송신 명령어가 IWRP인지 확인 (응답이 아니라 송신 명령 체크)
              if (
                currentCommand.send === "IWRP" ||
                currentCommand.send === "(IWRP)"
              ) {
                console.log(
                  "[IWRP 명령 감지] send:",
                  currentCommand.send,
                  "receive:",
                  actualReceive
                );

                // 응답에서 중량 추출 (괄호 안의 숫자)
                const match = actualReceive?.match(/\((\d+)\)/);
                if (match) {
                  const weightGrams = parseInt(match[1]);
                  console.log("[IWRP 파싱] weightGrams:", weightGrams);
                  const storedCode = localStorage.getItem("robot_code");

                  if (storedCode && transactionUuidRef.current) {
                    try {
                      // 버튼 클릭 시 생성된 UUID 재사용 (중복 방지)
                      const transactionUuid = transactionUuidRef.current;
                      console.log("[IWRP API 호출 시작]", {
                        robot_code: storedCode,
                        weight_grams: weightGrams,
                        transaction_uuid: transactionUuid,
                      });
                      const response = await fetch(
                        "/api/equipment/update-weight",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            robot_code: storedCode,
                            weight_grams: weightGrams,
                            transaction_uuid: transactionUuid,
                          }),
                        }
                      );

                      if (response.ok) {
                        const result = await response.json();
                        console.log("[IWRP 응답]", result);
                        // bucket 전환 시 이동 명령어 저장
                        if (
                          result.data?.bucketSwitched &&
                          result.data?.bucketMoveCommand
                        ) {
                          const moveCmd = result.data.bucketMoveCommand;
                          bucketMoveCommandRef.current = moveCmd;
                          console.log(
                            "[버킷 전환 감지] bucketMoveCommand 저장:",
                            moveCmd
                          );
                        } else {
                          console.log(
                            "[버킷 전환 없음] bucketSwitched:",
                            result.data?.bucketSwitched
                          );
                        }
                      } else {
                        console.error(
                          "[IWRP API 오류] status:",
                          response.status
                        );
                      }
                    } catch (error) {
                      console.error("[IWRP API 예외]", error);
                      // 에러 무시 (중량 업데이트 실패해도 명령은 계속 진행)
                    }
                  } else {
                    console.warn("[IWRP] robot_code 없음");
                  }
                } else {
                  console.warn("[IWRP] 중량 파싱 실패:", actualReceive);
                }
              }
            }
          },
          button.name
        );

        if (success) {
          const bucketMoveCommand = bucketMoveCommandRef.current;
          console.log(
            "[모든 명령 완료] bucketMoveCommand 값:",
            bucketMoveCommand
          );
          // 버킷 이동 명령어가 있으면 hooks를 통해 Python 서버로 직접 전송
          if (bucketMoveCommand) {
            console.log(`[버킷 이동] 명령어 송신: ${bucketMoveCommand}`);

            // 버킷 이동 명령 실행 (FLOW에 표시하지 않음)
            const bucketMoveSuccess = await executeCommandSequence(
              [
                {
                  send: bucketMoveCommand,
                  receive: null,
                  duration: 3000, // 3초 대기
                },
              ],
              () => {
                // 진행률 업데이트 없이 조용히 실행
              },
              button.name
            );

            if (bucketMoveSuccess) {
              console.log(`[버킷 이동] 명령어 송신 완료: ${bucketMoveCommand}`);
            } else {
              console.error(
                `[버킷 이동] 명령어 송신 실패: ${bucketMoveCommand}`
              );
            }
          }

          // 성공 시에만 100%로 설정
          setProgress(100);
        } else {
          // 취소가 아닌 경우만 오류 처리
          // const isCancelled = serialError?.includes("취소");
          // if (!isCancelled) {
          //   setErrorTitle("시리얼 통신 오류");
          //   setErrorMessage(serialError || "명령 실행에 실패했습니다.");
          //   setShowErrorAfterProgress(true);
          // }
        }
      } catch (error) {
        // 예외 발생 시에도 에러 메시지만 표시하고 모달은 유지
        // setErrorTitle("시리얼 통신 오류");
        // setErrorMessage(
        //   error instanceof Error
        //     ? error.message
        //     : "명령 실행 중 오류가 발생했습니다."
        // );
        // setShowErrorAfterProgress(true);
      }

      setIsProcessing(false);
    },
    [executeCommandSequence]
  );

  const handleCompleteModal = useCallback(() => {
    setIsProcessing(false);
  }, []);

  const handleCancelModal = useCallback(async () => {
    // 취소 요청 즉시 실행 (응답 대기 없이)
    if (isProcessing) {
      cancelExecution(); // await 제거하여 즉시 다음 단계로
    }

    // 상태 즉시 리셋
    setIsCancelling(false);
    setIsModalOpen(false);
    setIsProcessing(false);
    setProgress(0);
    setCurrentSendSignal("-");
    setCurrentExpectedSignal("-");
    setCurrentReceiveSignal("-");
    setCurrentCommandIndex(-1);
    setAllSendSignals([]);
    setOriginalCommandCount(0);
    bucketMoveCommandRef.current = null;
  }, [cancelExecution, isProcessing]);

  const handleCloseModal = useCallback(async () => {
    setIsModalOpen(false);
    setIsProcessing(false);

    // 모달 종료 후 장비 상태 및 일일 한도 재조회
    const storedCode = localStorage.getItem("robot_code");
    if (storedCode) {
      try {
        // 장비 상태 확인
        const response = await fetch(
          `/api/equipment/status?robot_code=${storedCode}`
        );
        if (response.ok) {
          const data = await response.json();
          // bucket1~4가 모두 13kg 초과인지 확인
          const allBucketsFull =
            data.bucket1 > 13 &&
            data.bucket2 > 13 &&
            data.bucket3 > 13 &&
            data.bucket4 > 13;
          setIsBucketFull(allBucketsFull);

          // weight_updated 이벤트 발생시켜 ClientContent의 BucketStatus도 업데이트
          window.dispatchEvent(new Event("weight_updated"));
        }

        // 일일 투입량 한도 재확인
        const dailyResponse = await fetch(
          "/api/input-records?check_daily=true"
        );
        if (dailyResponse.ok) {
          const dailyData = await dailyResponse.json();
          setIsDailyLimitReached(dailyData.data?.isLimitReached || false);
        }
      } catch (error) {
        // 에러 무시 (상태 확인 실패 시 기본값 유지)
      }
    }

    // if (showErrorAfterProgress) {
    //   setTimeout(() => {
    //     setIsErrorModalOpen(true);
    //   }, 500);
    // }
  }, []);

  const handleCloseErrorModal = () => {
    setIsErrorModalOpen(false);
    setShowErrorAfterProgress(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 w-full">
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

  const emergencyButton = buttons.find((button) => button.name === "비상종료");
  const regularButtons = emergencyButton
    ? buttons.filter((button) => button.button_no !== emergencyButton.button_no)
    : buttons;

  const renderRegularButton = (button: ButtonWithCommands) => {
    const isTerminateButton = button.name === "종료";
    if (isTerminateButton) {
      return (
        <Button
          key={button.button_no}
          className="h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
          onClick={handleTerminateClick}
          disabled={isProcessing || isBucketFull || isDailyLimitReached}
        >
          {button.name}
        </Button>
      );
    }

    return (
      <Button
        key={button.button_no}
        className="h-[82px] font-bold rounded-[16px] bg-primary hover:bg-primary/90 text-white text-[24px] disabled:opacity-50"
        onClick={() => handleButtonClick(button)}
        disabled={isProcessing || isBucketFull || isDailyLimitReached}
      >
        {button.name}
      </Button>
    );
  };

  // 버튼을 3개씩 나누어 행으로 구성 (비상종료 버튼이 없을 때 사용)
  const buttonRows: ButtonWithCommands[][] = [];
  if (!emergencyButton) {
    for (let i = 0; i < regularButtons.length; i += 3) {
      buttonRows.push(regularButtons.slice(i, i + 3));
    }
  }

  return (
    <>
      <div className="relative flex flex-col gap-4 w-full">
        {emergencyButton ? (
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 items-stretch max-lg:grid-cols-1">
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              {regularButtons.length > 0 ? (
                regularButtons.map((button) => renderRegularButton(button))
              ) : (
                <div className="col-span-2 h-[82px] rounded-[16px] bg-zinc-100 flex items-center justify-center text-lg font-semibold text-zinc-500 max-sm:col-span-1">
                  다른 명령 버튼이 없습니다.
                </div>
              )}
            </div>

            <Button
              key={emergencyButton.button_no}
              className="w-full h-full min-h-[200px] font-extrabold rounded-[24px] text-white text-[28px] bg-[#D7373F] hover:bg-[#bf1f28] focus-visible:ring-red-400 disabled:opacity-50"
              onClick={
                emergencyButton.name === "종료"
                  ? handleTerminateClick
                  : () => handleButtonClick(emergencyButton)
              }
              disabled={isProcessing || isBucketFull || isDailyLimitReached}
            >
              {emergencyButton.name}
            </Button>
          </div>
        ) : (
          buttonRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-row gap-4 w-full">
              {row.map((button) => (
                <div key={button.button_no} className="flex-1">
                  {renderRegularButton(button)}
                </div>
              ))}
            </div>
          ))
        )}

        {isBucketFull && (
          <div className="absolute inset-0 bg-red-500/95 text-white flex items-center justify-center rounded-[16px] backdrop-blur-sm z-10">
            <div className="text-center">
              <p className="font-bold text-[28px] leading-tight">
                모든 수거함이 가득 찼습니다.
              </p>
              <p className="font-bold text-[28px] leading-tight mt-2">
                수거가 필요합니다.
              </p>
            </div>
          </div>
        )}

        {!isBucketFull && isDailyLimitReached && (
          <div className="absolute inset-0 bg-orange-500/95 text-white flex items-center justify-center rounded-[16px] backdrop-blur-sm z-10">
            <div className="text-center">
              <p className="font-bold text-[28px] leading-tight">
                오늘 투입량 한도(2kg)에 도달했습니다.
              </p>
              <p className="font-bold text-[28px] leading-tight mt-2">
                내일 다시 이용해주세요.
              </p>
            </div>
          </div>
        )}
      </div>

      <ProgressModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onComplete={handleCompleteModal}
        onCancel={handleCancelModal}
        title={modalTitle}
        subtitle="작업이 진행중입니다. 잠시만 기다려주세요."
        progress={progress}
        status={isProcessing ? "진행중" : "완료"}
        robotCode={robotCode}
        sendSignal={currentSendSignal}
        expectedSignal={currentExpectedSignal}
        receiveSignal={currentReceiveSignal}
        allSendSignals={allSendSignals}
        currentCommandIndex={currentCommandIndex}
        originalCommandCount={originalCommandCount}
        isCancelling={isCancelling}
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
