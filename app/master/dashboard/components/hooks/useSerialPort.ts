import { useState, useCallback, useRef } from "react";
import { globalTestConfig } from "./testConfig";

interface CommandSequence {
  send: string;
  receive: string | null;
  duration: number;
}

interface SerialPortHook {
  isConnected: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<boolean>;
  executeCommandSequence: (
    commands: CommandSequence[],
    onProgress?: (
      currentCommandIndex: number,
      totalCommands: number,
      stepInCommand: "send" | "receive" | "duration_complete",
      actualReceive?: string
    ) => void,
    buttonName?: string,
    abortSignal?: AbortSignal
  ) => Promise<boolean>;
  error: string | null;
}

export const useSerialPort = (): SerialPortHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );
  const isReadingRef = useRef(false);

  const connect = useCallback(async (): Promise<boolean> => {
    try {
      // Web Serial API 지원 확인
      if (!("serial" in navigator)) {
        setError("Web Serial API가 지원되지 않는 브라우저입니다.");
        return false;
      }

      let port: SerialPort;

      // 이미 권한이 부여된 포트가 있는지 확인
      const ports = await navigator.serial.getPorts();

      if (ports.length > 0) {
        // 이미 권한이 있는 포트 사용 (첫 번째 포트)
        port = ports[0];
      } else {
        // 권한이 없으면 사용자에게 포트 선택 요청
        port = await navigator.serial.requestPort();
      }

      // 포트 열기 (9600,8,N,1)
      await port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      portRef.current = port;

      // DTR/RTS 신호 명시적으로 설정 (디바이스 리셋 방지)
      try {
        await (port as any).setSignals({
          dataTerminalReady: false,
          requestToSend: false,
        });
      } catch (err) {
        // setSignals를 지원하지 않는 브라우저는 무시
        if (globalTestConfig.debugMode) {
          console.log("[DTR/RTS 설정 실패 - 지원하지 않는 브라우저]");
        }
      }

      // 포트 안정화 대기
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reader와 Writer 설정
      if (port.readable) {
        readerRef.current = port.readable.getReader();
      }
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      // 초기 버퍼 비우기
      if (readerRef.current) {
        try {
          const clearStartTime = Date.now();
          while (Date.now() - clearStartTime < 100) {
            const { value, done } = await Promise.race([
              readerRef.current.read(),
              new Promise<{ value: undefined; done: true }>((resolve) =>
                setTimeout(() => resolve({ value: undefined, done: true }), 50)
              ),
            ]);
            if (done || !value) break;
          }
        } catch (err) {
          if (globalTestConfig.debugMode) {
            console.log("[초기 버퍼 비우기 실패]", err);
          }
        }
      }

      setIsConnected(true);
      setError(null);

      if (globalTestConfig.debugMode) {
        console.log("[시리얼 포트 연결 성공] 9600,8,N,1");
      }

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "포트 연결에 실패했습니다.";
      setError(errorMessage);
      return false;
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }

      if (writerRef.current) {
        await writerRef.current.close();
        writerRef.current = null;
      }

      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }

      setIsConnected(false);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "포트 연결 해제에 실패했습니다.";
      setError(errorMessage);
    }
  }, []);

  const sendCommand = useCallback(
    async (command: string, clearBuffer: boolean = true): Promise<boolean> => {
      try {
        if (!writerRef.current || !isConnected) {
          // 연결되어 있지 않으면 자동으로 연결 시도
          try {
            const connected = await connect();
            if (!connected) {
              setError(
                "시리얼 포트 연결 실패\n포트를 선택하거나 연결 상태를 확인해주세요."
              );
              return false;
            }
          } catch (connectErr) {
            // 연결 시도 중 예외 발생 (사용자가 취소한 경우 등)
            setError(
              "시리얼 포트 연결 취소\n포트 선택이 취소되었거나 연결할 수 없습니다."
            );
            return false;
          }
        }

        if (!writerRef.current) {
          setError("시리얼 포트 Writer 오류\n포트 연결을 다시 시도해주세요.");
          return false;
        }

        // 버퍼 비우기 (기존 데이터 제거)
        if (clearBuffer && readerRef.current) {
          try {
            const clearStartTime = Date.now();
            while (Date.now() - clearStartTime < 100) {
              const { value, done } = await Promise.race([
                readerRef.current.read(),
                new Promise<{ value: undefined; done: true }>((resolve) =>
                  setTimeout(
                    () => resolve({ value: undefined, done: true }),
                    50
                  )
                ),
              ]);
              if (done || !value) break;
            }

            if (globalTestConfig.debugMode) {
              console.log("[버퍼 비우기 완료]");
            }
          } catch (err) {
            if (globalTestConfig.debugMode) {
              console.log("[버퍼 비우기 실패]", err);
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        // 명령어를 바이트 배열로 변환 (\r\n 추가)
        const encoder = new TextEncoder();
        const commandWithCRLF = `${command}\r\n`;
        const data = encoder.encode(commandWithCRLF);

        // 명령 전송 로그 출력
        if (globalTestConfig.debugMode) {
          console.log(`[송신] ${command}`);
        }

        // 데이터 전송
        await writerRef.current.write(data);

        // 디바이스 처리 시간 대기
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (globalTestConfig.debugMode) {
          console.log(`[전송 완료, flush 완료]`);
        }

        setError(null);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "명령 전송에 실패했습니다.";
        setError(errorMessage);
        return false;
      }
    },
    [isConnected, connect]
  );

  const waitForReceive = useCallback(
    async (
      expectedReceive: string,
      timeoutMs: number = 10000,
      sendSignal?: string
    ): Promise<{ success: boolean; receivedData: string }> => {
      if (!readerRef.current) {
        setError("시리얼 포트 Reader 오류\n포트 연결을 다시 시도해주세요.");
        return { success: false, receivedData: "" };
      }

      const decoder = new TextDecoder();
      const startTime = Date.now();
      let buffer = "";
      let lastDataTime = Date.now();
      let receivedAnyData = false;
      const responses: string[] = [];

      try {
        while (Date.now() - startTime < timeoutMs) {
          const { value, done } = await Promise.race([
            readerRef.current.read(),
            new Promise<{ value: undefined; done: true }>((resolve) =>
              setTimeout(() => resolve({ value: undefined, done: true }), 100)
            ),
          ]);

          if (done || !value) {
            // 데이터가 없으면 대기
            await new Promise((resolve) => setTimeout(resolve, 50));

            // 응답을 받았고 0.5초간 추가 데이터가 없으면 즉시 종료
            if (responses.length > 0 && Date.now() - lastDataTime > 500) {
              break;
            }
            continue;
          }

          // 데이터 수신
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          lastDataTime = Date.now();
          receivedAnyData = true;

          // 디버그: 받은 원시 데이터 로깅
          if (globalTestConfig.debugMode) {
            console.log(`[수신 데이터] ${buffer}`);
            console.log(`[버퍼 길이] ${buffer.length}`);
          }

          // 괄호로 묶인 응답 추출 (IDON) 형식
          let startIdx = buffer.indexOf("(");
          let endIdx = buffer.indexOf(")", startIdx);

          while (startIdx !== -1 && endIdx !== -1) {
            const response = buffer.substring(startIdx, endIdx + 1);

            if (response) {
              responses.push(response);
              if (globalTestConfig.debugMode) {
                console.log(`[수신] ${response}`);
              }
            }

            // 처리한 부분 제거
            buffer = buffer.substring(endIdx + 1);
            startIdx = buffer.indexOf("(");
            endIdx = buffer.indexOf(")", startIdx);
          }

          // 일반 신호는 정확히 일치해야 함
          const matchedResponse = responses.find((r) =>
            r.includes(expectedReceive)
          );
          if (matchedResponse) {
            if (globalTestConfig.debugMode) {
              console.log(`[응답 일치] ${matchedResponse}`);
            }
            return { success: true, receivedData: matchedResponse };
          }
        }

        // 남은 버퍼 처리
        if (buffer.trim()) {
          if (globalTestConfig.debugMode) {
            console.log(`[남은 버퍼] ${buffer}`);
          }
        }

        // 타임아웃 시 실제 수신한 데이터 표시
        let receivedData = "";
        if (responses.length > 0) {
          receivedData = responses.join(", ");
          if (globalTestConfig.debugMode) {
            console.log(
              `[응답 없음 - 데이터는 수신했으나 일치하지 않음] ${receivedData}`
            );
          }
        } else if (receivedAnyData) {
          receivedData = buffer.trim() || "(괄호 형식 없음)";
          if (globalTestConfig.debugMode) {
            console.log(
              `[응답 없음 - 데이터는 수신했으나 괄호 형식 없음] ${receivedData}`
            );
          }
        } else {
          receivedData = "(응답 없음)";
          if (globalTestConfig.debugMode) {
            console.log(`[응답 없음 - 데이터 미수신]`);
          }
        }

        setError(
          `응답 대기 시간 초과\n기대 응답: ${expectedReceive}\n실제 수신: ${receivedData}`
        );
        return { success: false, receivedData };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "응답 수신 중 오류 발생";
        setError(`응답 수신 오류\n${errorMessage}`);
        return { success: false, receivedData: buffer };
      }
    },
    []
  );

  const executeCommandSequence = useCallback(
    async (
      commands: CommandSequence[],
      onProgress?: (
        currentCommandIndex: number,
        totalCommands: number,
        stepInCommand: "send" | "receive" | "duration_complete",
        actualReceive?: string
      ) => void,
      buttonName?: string,
      abortSignal?: AbortSignal
    ): Promise<boolean> => {
      try {
        // 연결 확인
        if (!writerRef.current || !isConnected) {
          try {
            const connected = await connect();
            if (!connected) {
              setError(
                "시리얼 포트 연결 실패\n포트를 선택하거나 연결 상태를 확인해주세요."
              );
              return false;
            }
          } catch (connectErr) {
            // 연결 시도 중 예외 발생 (사용자가 취소한 경우 등)
            setError(
              "시리얼 포트 연결 취소\n포트 선택이 취소되었거나 연결할 수 없습니다."
            );
            return false;
          }
        }

        // 명령어 순차 실행
        for (let i = 0; i < commands.length; i++) {
          // 취소 확인
          if (abortSignal?.aborted) {
            setError("명령이 취소되었습니다.");
            return false;
          }

          const command = commands[i];

          // send 단계 시작 알림
          if (onProgress) {
            onProgress(i, commands.length, "send");
          }

          // send 명령 전송
          const sendSuccess = await sendCommand(command.send);
          if (!sendSuccess) {
            setError(
              `[${i + 1}/${commands.length}] 명령 전송 실패\n전송 명령: ${
                command.send
              }`
            );
            return false;
          }

          // receive가 있으면 응답 대기, 없으면 duration만큼 대기
          if (command.receive && command.receive.trim() !== "") {
            // 일반 신호: 예상신호와 일치할 때까지 재시도 (최대 3회)
            let receiveSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!receiveSuccess && retryCount < maxRetries) {
              // 재시도 시 로그 출력
              if (retryCount > 0) {
                if (globalTestConfig.debugMode) {
                  console.log(
                    `[재시도 ${retryCount}/${maxRetries - 1}] 1초 후 재전송...`
                  );
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // 명령 재전송
                const resendSuccess = await sendCommand(command.send);
                if (!resendSuccess) {
                  setError(
                    `[${i + 1}/${
                      commands.length
                    }] 명령 재전송 실패\n전송 명령: ${command.send}`
                  );
                  return false;
                }
              }

              const result = await waitForReceive(
                command.receive,
                command.duration * 1000,
                command.send
              );
              receiveSuccess = result.success;

              // receive 단계 알림 (실제 응답 데이터 전달)
              if (onProgress) {
                onProgress(i, commands.length, "receive", result.receivedData);
              }

              if (!receiveSuccess) {
                retryCount++;
                if (retryCount >= maxRetries) {
                  // 모든 재시도 실패
                  if (globalTestConfig.debugMode) {
                    console.log(`✗ 응답 수신 실패 (총 ${maxRetries}회 시도)`);
                  }
                  setError(
                    `[${i + 1}/${commands.length}] 응답 수신 실패\n기대 응답: ${
                      command.receive
                    }\n실제 수신: ${
                      result.receivedData
                    }\n총 ${maxRetries}회 시도`
                  );
                  return false;
                }
              } else {
                // 응답 수신 성공
                if (globalTestConfig.debugMode) {
                  console.log(`✓ 응답 수신 성공 (시도 ${retryCount + 1}회)`);
                }
              }

              // 취소 확인
              if (abortSignal?.aborted) {
                setError("명령이 취소되었습니다.");
                return false;
              }
            }

            // duration 대기 완료 알림
            if (onProgress) {
              onProgress(i, commands.length, "duration_complete");
            }
          } else {
            // receive가 없으면 duration만큼 대기
            if (onProgress) {
              onProgress(i, commands.length, "receive");
            }

            // 취소 가능한 대기
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, command.duration * 1000);
              if (abortSignal) {
                abortSignal.addEventListener("abort", () => {
                  clearTimeout(timeout);
                  reject(new Error("취소됨"));
                });
              }
            });

            // 취소 확인
            if (abortSignal?.aborted) {
              setError("명령이 취소되었습니다.");
              return false;
            }

            // duration 대기 완료 알림
            if (onProgress) {
              onProgress(i, commands.length, "duration_complete");
            }
          }
        }

        setError(null);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "명령 시퀀스 실행에 실패했습니다.";
        setError(errorMessage);
        return false;
      }
    },
    [isConnected, connect, sendCommand, waitForReceive]
  );

  return {
    isConnected,
    connect,
    disconnect,
    sendCommand,
    executeCommandSequence,
    error,
  };
};
