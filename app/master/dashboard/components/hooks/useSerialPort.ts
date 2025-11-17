import { useState, useCallback, useRef } from "react";

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
      stepInCommand: "send" | "receive"
    ) => void
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

      // 포트 열기
      await port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      portRef.current = port;

      // Reader와 Writer 설정
      if (port.readable) {
        readerRef.current = port.readable.getReader();
      }
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      setIsConnected(true);
      setError(null);
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
    async (command: string): Promise<boolean> => {
      try {
        if (!writerRef.current || !isConnected) {
          // 연결되어 있지 않으면 자동으로 연결 시도
          const connected = await connect();
          if (!connected) {
            setError(
              "시리얼 포트 연결 실패\n포트를 선택하거나 연결 상태를 확인해주세요."
            );
            return false;
          }
        }

        if (!writerRef.current) {
          setError("시리얼 포트 Writer 오류\n포트 연결을 다시 시도해주세요.");
          return false;
        }

        // 명령어를 바이트 배열로 변환
        const encoder = new TextEncoder();
        const data = encoder.encode(command);

        // 데이터 전송
        await writerRef.current.write(data);
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
      timeoutMs: number = 10000
    ): Promise<boolean> => {
      if (!readerRef.current) {
        setError("시리얼 포트 Reader 오류\n포트 연결을 다시 시도해주세요.");
        return false;
      }

      const decoder = new TextDecoder();
      const startTime = Date.now();
      let buffer = "";

      try {
        while (Date.now() - startTime < timeoutMs) {
          const { value, done } = await Promise.race([
            readerRef.current.read(),
            new Promise<{ value: undefined; done: true }>((resolve) =>
              setTimeout(() => resolve({ value: undefined, done: true }), 100)
            ),
          ]);

          if (done || !value) {
            // 짧은 대기 후 계속
            await new Promise((resolve) => setTimeout(resolve, 50));
            continue;
          }

          buffer += decoder.decode(value, { stream: true });

          // 예상 응답이 버퍼에 포함되어 있는지 확인
          if (buffer.includes(expectedReceive)) {
            return true;
          }
        }

        // 타임아웃 시 실제 수신한 데이터 표시
        const receivedData = buffer.trim() || "(응답 없음)";
        setError(
          `응답 대기 시간 초과\n기대 응답: ${expectedReceive}\n실제 수신: ${receivedData}`
        );
        return false;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "응답 수신 중 오류 발생";
        setError(`응답 수신 오류\n${errorMessage}`);
        return false;
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
        stepInCommand: "send" | "receive"
      ) => void
    ): Promise<boolean> => {
      try {
        // 연결 확인
        if (!writerRef.current || !isConnected) {
          const connected = await connect();
          if (!connected) {
            setError(
              "시리얼 포트 연결 실패\n포트를 선택하거나 연결 상태를 확인해주세요."
            );
            return false;
          }
        }

        // 명령어 순차 실행
        for (let i = 0; i < commands.length; i++) {
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

          // receive 단계 시작 알림
          if (onProgress) {
            onProgress(i, commands.length, "receive");
          }

          // receive가 있으면 응답 대기, 없으면 duration만큼 대기
          if (command.receive && command.receive.trim() !== "") {
            const receiveSuccess = await waitForReceive(
              command.receive,
              command.duration * 1000
            );
            if (!receiveSuccess) {
              setError(
                `[${i + 1}/${commands.length}] 응답 수신 실패\n기대 응답: ${
                  command.receive
                }\n대기 시간: ${command.duration}초 초과`
              );
              return false;
            }
          } else {
            // receive가 없으면 duration만큼 대기
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
