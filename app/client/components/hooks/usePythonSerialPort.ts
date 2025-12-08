import { useState, useCallback, useRef } from "react";
import { globalTestConfig } from "./testConfig";

interface CommandSequence {
  send: string;
  receive: string | null;
  duration: number;
}

interface PythonSerialPortHook {
  isConnected: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<boolean>;
  executeCommandSequence: (
    commands: CommandSequence[],
    onProgress?: (
      currentCommandIndex: number,
      totalCommands: number,
      stepInCommand: "send" | "receive",
      actualReceive?: string
    ) => void,
    buttonName?: string
  ) => Promise<boolean>;
  cancelExecution: () => Promise<void>;
  error: string | null;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const usePythonSerialPort = (): PythonSerialPortHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(async (): Promise<boolean> => {
    try {
      // 사용 가능한 포트 목록 조회
      const portsResponse = await fetch(`${API_BASE_URL}/ports`);
      if (!portsResponse.ok) {
        throw new Error("포트 목록 조회 실패");
      }

      const ports = await portsResponse.json();
      if (ports.length === 0) {
        setError("사용 가능한 시리얼 포트가 없습니다.");
        return false;
      }

      // 첫 번째 포트로 연결
      const firstPort = ports[0].device;
      const connectResponse = await fetch(`${API_BASE_URL}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ port_name: firstPort }),
      });

      if (!connectResponse.ok) {
        const errorData = await connectResponse.json();
        throw new Error(errorData.detail || "포트 연결 실패");
      }

      const result = await connectResponse.json();

      if (globalTestConfig.debugMode) {
        console.log(`[Python 서버 연결 성공] ${result.message}`);
      }

      setIsConnected(true);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "포트 연결에 실패했습니다.";
      setError(errorMessage);
      if (globalTestConfig.debugMode) {
        console.error("[연결 오류]", err);
      }
      return false;
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await fetch(`${API_BASE_URL}/disconnect`, {
        method: "POST",
      });

      setIsConnected(false);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "포트 연결 해제에 실패했습니다.";
      setError(errorMessage);
    }
  }, []);

  const sendCommand = useCallback(
    async (command: string): Promise<boolean> => {
      try {
        if (!isConnected) {
          const connected = await connect();
          if (!connected) {
            setError("시리얼 포트 연결 실패");
            return false;
          }
        }

        if (globalTestConfig.debugMode) {
          console.log(`[Python 서버로 명령 전송] ${command}`);
        }

        const response = await fetch(`${API_BASE_URL}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command: command,
            timeout: 3.0,
            max_retries: 3,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "명령 전송 실패");
        }

        const result = await response.json();

        if (globalTestConfig.debugMode) {
          console.log(`[Python 서버 응답]`, result);
        }

        if (!result.success) {
          setError(result.error || "응답 수신 실패");
          return false;
        }

        setError(null);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "명령 전송에 실패했습니다.";
        setError(errorMessage);
        if (globalTestConfig.debugMode) {
          console.error("[전송 오류]", err);
        }
        return false;
      }
    },
    [isConnected, connect]
  );

  const cancelExecution = useCallback(async () => {
    setIsCancelled(true);
    cancelledRef.current = true;

    // 진행 중인 fetch 요청 즉시 중단
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // REAL 모드가 아니면 서버 요청 없이 반환
    const mode = process.env.NEXT_PUBLIC_ACTION_MODE || "TEST";
    if (mode !== "REAL") {
      return;
    }

    // Python 서버에 취소 요청 (버퍼 비우기 포함)
    try {
      const response = await fetch(`${API_BASE_URL}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        if (globalTestConfig.debugMode) {
          console.log("[Python 서버 모드] 취소 완료:", result.message);
        }
      } else {
        if (globalTestConfig.debugMode) {
          console.log("[Python 서버 모드] 취소 요청 실패 (서버 응답 오류)");
        }
      }
    } catch (err) {
      // 서버가 실행되지 않은 경우 등 - 에러를 무시하고 계속 진행
      if (globalTestConfig.debugMode) {
        console.log(
          "[Python 서버 모드] 취소 요청 실패 (서버 미실행 또는 네트워크 오류) - 무시하고 계속"
        );
      }
      // 에러를 발생시키지 않고 정상적으로 반환
    }
  }, []);

  const executeCommandSequence = useCallback(
    async (
      commands: CommandSequence[],
      onProgress?: (
        currentCommandIndex: number,
        totalCommands: number,
        stepInCommand: "send" | "receive",
        actualReceive?: string
      ) => void,
      buttonName?: string
    ): Promise<boolean> => {
      // 취소 상태 초기화 (ref와 state 모두)
      setIsCancelled(false);
      cancelledRef.current = false;

      // 새로운 AbortController 생성
      abortControllerRef.current = new AbortController();

      try {
        if (!isConnected) {
          const connected = await connect();
          if (!connected) {
            setError("시리얼 포트 연결 실패");
            return false;
          }
        }

        // Python 서버의 취소 플래그 초기화
        try {
          await fetch(`${API_BASE_URL}/reset`, {
            method: "POST",
          });
          if (globalTestConfig.debugMode) {
            console.log("[Python 서버] 취소 플래그 초기화 완료");
          }
        } catch (err) {
          if (globalTestConfig.debugMode) {
            console.log("[Python 서버] 취소 플래그 초기화 실패 (무시)");
          }
        }

        for (let i = 0; i < commands.length; i++) {
          // ref를 사용하여 즉시 취소 상태 확인
          if (cancelledRef.current) {
            setError("사용자가 작업을 취소했습니다.");
            return false;
          }

          const command = commands[i];

          // send 단계 시작 알림
          if (onProgress) {
            onProgress(i, commands.length, "send");
          }

          // 예상 신호가 없는 경우 ('-' 또는 빈 문자열) 응답 대기 없이 바로 진행
          const hasExpectedResponse =
            command.receive &&
            command.receive.trim() !== "" &&
            command.receive.trim() !== "-";

          // 명령 전송 (프론트엔드 레벨 재시도 포함)
          let result: {
            success: boolean;
            received_data?: string;
            error?: string;
          } | null = null;
          let lastError: string | null = null;
          const maxFrontendRetries = 3; // 프론트엔드에서 최대 3번 재시도

          for (
            let retryCount = 0;
            retryCount < maxFrontendRetries;
            retryCount++
          ) {
            try {
              if (cancelledRef.current) {
                setError("사용자가 작업을 취소했습니다.");
                return false;
              }

              if (globalTestConfig.debugMode && retryCount > 0) {
                console.log(
                  `[재시도 ${retryCount}/${maxFrontendRetries - 1}] ${
                    command.send
                  }`
                );
              }

              const response = await fetch(`${API_BASE_URL}/send`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  command: command.send,
                  timeout: hasExpectedResponse ? 3.0 : 0.1, // 응답 대기: 3초, 응답 없음: 0.1초
                  max_retries: 3, // Python 서버 측 재시도 (1초 간격)
                }),
                signal: abortControllerRef.current?.signal,
              });

              if (!response.ok) {
                const errorData = await response.json();
                lastError = errorData.detail || "명령 전송 실패";

                if (globalTestConfig.debugMode) {
                  console.log(`[API 오류] ${lastError}`);
                }

                // 마지막 재시도가 아니면 1초 대기 후 재시도
                if (retryCount < maxFrontendRetries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  continue;
                }

                setError(lastError);
                return false;
              }

              result = await response.json();

              // success가 false이면 재시도 필요
              if (result && !result.success) {
                lastError = result.error || "응답 수신 실패";

                if (globalTestConfig.debugMode) {
                  console.log(`[응답 실패] ${lastError}`);
                }

                // 마지막 재시도가 아니면 1초 대기 후 재시도
                if (retryCount < maxFrontendRetries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  continue;
                }

                // 마지막 재시도도 실패하면 에러 처리는 아래에서
                break;
              }

              // 성공적으로 응답을 받았으면 재시도 루프 종료
              break;
            } catch (err) {
              // AbortError는 즉시 종료
              if (err instanceof Error && err.name === "AbortError") {
                setError("사용자가 작업을 취소했습니다.");
                return false;
              }

              lastError = err instanceof Error ? err.message : "네트워크 오류";

              if (globalTestConfig.debugMode) {
                console.log(`[네트워크 오류] ${lastError}`);
              }

              // 마지막 재시도가 아니면 1초 대기 후 재시도
              if (retryCount < maxFrontendRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
              }

              setError(lastError);
              return false;
            }
          }

          // 재시도 후에도 result가 없으면 실패
          if (!result) {
            setError(lastError || "명령 전송 실패");
            return false;
          }

          // receive 단계 알림
          if (onProgress) {
            onProgress(i, commands.length, "receive", result.received_data);
          }

          // 예상 신호가 없으면 응답 검증 없이 바로 다음으로
          if (!hasExpectedResponse) {
            // duration만큼 대기 후 다음 단계로
            if (command.duration && command.duration > 0) {
              if (globalTestConfig.debugMode) {
                console.log(
                  `[응답 없음] ${command.send} - ${command.duration}ms 대기 시작`
                );
              }
              await new Promise((resolve) =>
                setTimeout(resolve, command.duration)
              );
              if (globalTestConfig.debugMode) {
                console.log(
                  `[응답 없음] ${command.send} - ${command.duration}ms 대기 완료`
                );
              }
            }
            continue;
          }

          // IWRP 신호인 경우 응답 검증
          if (command.send === "IWRP" || command.send === "(IWRP)") {
            if (globalTestConfig.debugMode) {
              console.log(`[IWRP 응답 수신] ${result.received_data}`);
            }

            // IWRP 중량 업데이트는 ActionButtons.tsx에서 처리
            // 여기서는 응답 성공 여부만 확인
            if (!result.success) {
              setError(
                `[${i + 1}/${
                  commands.length
                }] IWRP 응답 수신 실패\n응답 대기 시간 초과`
              );
              return false;
            }
            // 예상 신호를 받았으므로 duration 대기 없이 즉시 다음 단계로
            if (globalTestConfig.debugMode) {
              console.log(
                `[IWRP 완료] ${command.send} → ${result.received_data} - 즉시 다음 단계로`
              );
            }
            continue;
          } else {
            // 일반 명령의 경우 응답 검증
            if (!result.success) {
              setError(
                `[${i + 1}/${commands.length}] 응답 수신 실패\n기대 응답: ${
                  command.receive
                }\n실제 수신: ${result.received_data}`
              );
              return false;
            }

            // 예상 신호와 실제 수신 신호 비교
            const expectedSignal = command.receive?.trim() || "";
            const receivedSignal = result.received_data?.trim() || "";

            // 예상 신호가 있는 경우 일치 여부 확인
            if (expectedSignal && expectedSignal !== "-") {
              // 괄호 포함 여부에 관계없이 비교 (예: DSCN과 (DSCN) 모두 허용)
              const normalizedExpected = expectedSignal
                .replace(/[()]/g, "")
                .trim();
              const normalizedReceived = receivedSignal
                .replace(/[()]/g, "")
                .trim();

              if (normalizedExpected !== normalizedReceived) {
                setError(
                  `[${i + 1}/${
                    commands.length
                  }] 응답 불일치\n기대 응답: ${expectedSignal}\n실제 수신: ${receivedSignal}`
                );
                return false;
              }
            }

            // 예상 신호를 받았으므로 duration 대기 없이 즉시 다음 단계로
            if (globalTestConfig.debugMode) {
              console.log(
                `[응답 수신 완료] ${command.send} → ${result.received_data} - 즉시 다음 단계로`
              );
            }
            continue;
          }
        }

        setError(null);
        return true;
      } catch (err) {
        // AbortError는 사용자가 취소한 것이므로 별도 처리
        if (err instanceof Error && err.name === "AbortError") {
          setError("사용자가 작업을 취소했습니다.");
          return false;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "명령 시퀀스 실행에 실패했습니다.";
        setError(errorMessage);
        return false;
      } finally {
        // 완료 또는 에러 발생 시 AbortController 정리
        abortControllerRef.current = null;
      }
    },
    [isConnected, connect]
  );

  return {
    isConnected,
    connect,
    disconnect,
    sendCommand,
    executeCommandSequence,
    cancelExecution,
    error,
  };
};
