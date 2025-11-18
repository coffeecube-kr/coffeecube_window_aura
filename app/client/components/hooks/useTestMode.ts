import { useState, useCallback } from "react";
import {
  getNextMockResponse,
  resetResponseIndex,
  globalTestConfig,
} from "./testConfig";

// IWRP 응답 처리 함수
async function handleIWRPResponse(response: string): Promise<void> {
  try {
    // (xxxx) 형식에서 숫자 추출
    const match = response.match(/\((\d+)\)/);
    if (!match || !match[1]) {
      return;
    }

    const weightGrams = parseInt(match[1], 10);
    if (isNaN(weightGrams) || weightGrams <= 0) {
      return;
    }

    // robot_code 가져오기
    const robotCode = localStorage.getItem("robot_code");
    if (!robotCode) {
      return;
    }

    // API 호출하여 중량 업데이트
    const apiResponse = await fetch("/api/equipment/update-weight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        robot_code: robotCode,
        weight_grams: weightGrams,
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      if (globalTestConfig.debugMode) {
        console.error(
          "중량 업데이트 실패:",
          errorData.message || "알 수 없는 오류"
        );
      }
    } else {
      // 성공 시 화면 업데이트를 위한 이벤트 발생
      const updateEvent = new CustomEvent("weight_updated", {
        detail: { weightGrams, robotCode },
      });
      window.dispatchEvent(updateEvent);
    }
  } catch (error) {
    // 에러가 발생해도 시리얼 통신은 계속 진행
    if (globalTestConfig.debugMode) {
      console.error("IWRP 응답 처리 중 오류:", error);
    }
  }
}

interface CommandSequence {
  send: string;
  receive: string | null;
  duration: number;
}

interface TestModeHook {
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
  error: string | null;
}

/**
 * 테스트 모드용 훅
 * 실제 시리얼 통신 없이 응답을 시뮬레이션합니다.
 */
export const useTestMode = (): TestModeHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (): Promise<boolean> => {
    // 테스트 모드에서는 즉시 연결 성공
    await new Promise((resolve) => setTimeout(resolve, 100));
    setIsConnected(true);
    setError(null);
    return true;
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    // 테스트 모드에서는 즉시 연결 해제
    await new Promise((resolve) => setTimeout(resolve, 100));
    setIsConnected(false);
    setError(null);
  }, []);

  const sendCommand = useCallback(
    async (command: string): Promise<boolean> => {
      // 테스트 모드에서는 자동 연결
      if (!isConnected) {
        await connect();
      }

      // 명령 전송 로그 출력
      if (globalTestConfig.debugMode) {
        console.log(`[테스트 모드 - 시리얼 송신] ${command}`);
      }

      // 명령 전송 시뮬레이션 (짧은 지연)
      await new Promise((resolve) => setTimeout(resolve, 50));
      setError(null);
      return true;
    },
    [isConnected, connect]
  );

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
      // 테스트 모드에서는 자동 연결
      if (!isConnected) {
        await connect();
      }

      // 응답 인덱스 초기화 (새로운 시퀀스 시작)
      resetResponseIndex(buttonName);

      if (globalTestConfig.debugMode) {
        console.log(
          `[테스트 모드] 명령 시퀀스 시작 (총 ${commands.length}개, 버튼: ${
            buttonName || "기본"
          })`
        );
      }

      // 명령어 순차 실행 시뮬레이션
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];

        // 다음 Mock 응답 가져오기 (버튼별로)
        const mockResponse = getNextMockResponse(buttonName);

        if (globalTestConfig.debugMode) {
          console.log(`\n[테스트 모드] 명령 ${i + 1}/${commands.length}`);
          console.log(`  Send (실제): ${command.send}`);
          console.log(`  Receive (DB 설정): ${command.receive || "없음"}`);
          console.log(`  Receive (Mock): ${mockResponse.receive}`);
          console.log(`  Should Succeed: ${mockResponse.shouldSucceed}`);
          console.log(`  Delay: ${mockResponse.delayMs}ms`);
        }

        // send 단계 시작 알림
        if (onProgress) {
          onProgress(i, commands.length, "send");
        }

        // send 명령 전송 시뮬레이션
        await sendCommand(command.send);

        // send 단계 완료 후 짧은 지연
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 실패 시뮬레이션
        if (!mockResponse.shouldSucceed) {
          setError(
            `[테스트 모드] 명령 실패 시뮬레이션\n전송: ${command.send}\nMock 응답: ${mockResponse.receive}`
          );
          return false;
        }

        // 응답 대기 시뮬레이션 (설정된 지연 시간 사용)
        await new Promise((resolve) =>
          setTimeout(resolve, mockResponse.delayMs)
        );

        // receive 단계 시작 알림 (mock 응답 전달)
        if (onProgress) {
          onProgress(i, commands.length, "receive", mockResponse.receive);
        }

        // IWRP 신호인 경우 응답 형식만 확인 (API 호출은 ActionButtons에서 처리)
        if (command.send === "IWRP" || command.send === "(IWRP)") {
          // IWRP는 (xxxx) 형식만 확인하고 다음으로 진행
          const iwrpMatch = mockResponse.receive.match(/\(\d+\)/);
          if (iwrpMatch) {
            if (globalTestConfig.debugMode) {
              console.log(`  ✓ IWRP 응답 수신: ${mockResponse.receive}`);
              console.log(`  ℹ IWRP API 호출은 ActionButtons에서 처리됨`);
            }
            // API 호출은 ActionButtons의 onProgress 콜백에서 처리
            // 다음 명령으로 진행 (receive 검증 건너뛰기)
            continue;
          } else {
            // IWRP 형식이 아니면 실패
            setError(
              `[테스트 모드] IWRP 응답 형식 오류\n기대 형식: (숫자)\n실제 수신: ${mockResponse.receive}`
            );
            return false;
          }
        }

        // DB에 설정된 receive 값과 mock 응답 비교 (IWRP가 아닌 경우만)
        if (command.receive && command.receive.trim() !== "") {
          // 예상신호와 일치할 때까지 계속 대기
          while (mockResponse.receive !== command.receive) {
            if (globalTestConfig.debugMode) {
              console.log(
                `  ⚠ 응답 불일치: 기대=${command.receive}, 실제=${mockResponse.receive}`
              );
              console.log(`  ${command.duration}초 대기 후 재시도...`);
            }
            setError(
              `[테스트 모드] 응답 불일치\n기대 응답: ${command.receive}\n실제 수신: ${mockResponse.receive}\n${command.duration}초 후 재시도...`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, command.duration * 1000)
            );
            // 다음 mock 응답 가져오기 (버튼별로)
            const newMockResponse = getNextMockResponse(buttonName);
            if (newMockResponse.receive === command.receive) {
              break;
            }
          }
        }

        if (globalTestConfig.debugMode) {
          console.log(`  ✓ 명령 완료`);
        }
      }

      if (globalTestConfig.debugMode) {
        console.log(`\n[테스트 모드] 명령 시퀀스 완료`);
      }

      setError(null);
      return true;
    },
    [isConnected, connect, sendCommand]
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
