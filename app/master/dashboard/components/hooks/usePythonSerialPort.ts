import { useState, useCallback } from "react";
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
      stepInCommand: "send" | "receive" | "duration_complete",
      actualReceive?: string
    ) => void,
    buttonName?: string,
    abortSignal?: AbortSignal
  ) => Promise<boolean>;
  error: string | null;
}

const API_BASE_URL = "http://localhost:8000";

export const usePythonSerialPort = (): PythonSerialPortHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!isConnected) {
          const connected = await connect();
          if (!connected) {
            setError("시리얼 포트 연결 실패");
            return false;
          }
        }

        for (let i = 0; i < commands.length; i++) {
          if (abortSignal?.aborted) {
            setError("명령이 취소되었습니다.");
            return false;
          }

          const command = commands[i];

          // send 단계 시작 알림
          if (onProgress) {
            onProgress(i, commands.length, "send");
          }

          // 명령 전송
          const response = await fetch(`${API_BASE_URL}/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              command: command.send,
              timeout: command.duration,
              max_retries: 3,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            setError(errorData.detail || "명령 전송 실패");
            return false;
          }

          const result = await response.json();

          // receive 단계 알림
          if (onProgress) {
            onProgress(i, commands.length, "receive", result.received_data);
          }

          if (command.receive && command.receive.trim() !== "") {
            if (!result.success) {
              setError(
                `[${i + 1}/${commands.length}] 응답 수신 실패\n기대 응답: ${
                  command.receive
                }\n실제 수신: ${result.received_data}`
              );
              return false;
            }
          }

          // duration 대기 완료 알림
          if (onProgress) {
            onProgress(i, commands.length, "duration_complete");
          }

          // duration 대기
          if (command.duration > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, command.duration * 1000)
            );
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
    [isConnected, connect]
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
