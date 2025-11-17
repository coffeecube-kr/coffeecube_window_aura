import { useState, useCallback, useRef } from "react";

interface DeviceStatusHook {
  deviceStatus: "정상" | "수거필요" | "장애발생" | null;
  isChecking: boolean;
  checkDeviceStatus: (bucketWeights: {
    bucket1: number;
    bucket2: number;
    bucket3: number;
    bucket4: number;
  }) => Promise<"정상" | "수거필요" | "장애발생">;
  error: string | null;
}

export const useDeviceStatus = (): DeviceStatusHook => {
  const [deviceStatus, setDeviceStatus] = useState<
    "정상" | "수거필요" | "장애발생" | null
  >(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );

  const connect = useCallback(async (): Promise<boolean> => {
    try {
      if (!("serial" in navigator)) {
        setError("Web Serial API가 지원되지 않는 브라우저입니다.");
        return false;
      }

      let port: SerialPort;
      const ports = await navigator.serial.getPorts();

      if (ports.length > 0) {
        port = ports[0];
      } else {
        port = await navigator.serial.requestPort();
      }

      await port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      portRef.current = port;

      if (port.readable) {
        readerRef.current = port.readable.getReader();
      }
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

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
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "포트 연결 해제에 실패했습니다.";
      setError(errorMessage);
    }
  }, []);

  const checkDeviceStatus = useCallback(
    async (bucketWeights: {
      bucket1: number;
      bucket2: number;
      bucket3: number;
      bucket4: number;
    }): Promise<"정상" | "수거필요" | "장애발생"> => {
      setIsChecking(true);
      setError(null);

      try {
        // 1. 먼저 장애 여부를 확인 (장애발생이 최우선)
        // 연결 확인
        if (!writerRef.current || !readerRef.current) {
          const connected = await connect();
          if (!connected) {
            setError("시리얼 포트 연결 실패");
            setDeviceStatus("장애발생");
            setIsChecking(false);
            return "장애발생";
          }
        }

        if (!writerRef.current || !readerRef.current) {
          setError("시리얼 포트 초기화 실패");
          setDeviceStatus("장애발생");
          setIsChecking(false);
          return "장애발생";
        }

        // RST0 명령 전송
        const encoder = new TextEncoder();
        const command = encoder.encode("RST0");
        await writerRef.current.write(command);

        // RST1 응답 대기
        const decoder = new TextDecoder();
        const startTime = Date.now();
        const timeoutMs = 5000;
        let buffer = "";

        while (Date.now() - startTime < timeoutMs) {
          const { value, done } = await Promise.race([
            readerRef.current.read(),
            new Promise<{ value: undefined; done: true }>((resolve) =>
              setTimeout(() => resolve({ value: undefined, done: true }), 100)
            ),
          ]);

          if (done || !value) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            continue;
          }

          buffer += decoder.decode(value, { stream: true });

          // RST1 응답 확인
          if (buffer.includes("RST1")) {
            // 2. 장비가 정상이면 무게를 확인하여 수거필요 여부 판단
            const allBucketsOverWeight =
              bucketWeights.bucket1 >= 15 &&
              bucketWeights.bucket2 >= 15 &&
              bucketWeights.bucket3 >= 15 &&
              bucketWeights.bucket4 >= 15;

            if (allBucketsOverWeight) {
              setDeviceStatus("수거필요");
              setIsChecking(false);
              return "수거필요";
            }

            // 3. 장비 정상이고 무게도 정상
            setDeviceStatus("정상");
            setIsChecking(false);
            return "정상";
          }
        }

        // 타임아웃 - RST1 응답을 받지 못함 (장애발생)
        setError("장비 응답 대기 시간 초과");
        setDeviceStatus("장애발생");
        setIsChecking(false);
        return "장애발생";
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "장비 상태 확인 실패";
        setError(errorMessage);
        setDeviceStatus("장애발생");
        setIsChecking(false);
        return "장애발생";
      }
    },
    [connect]
  );

  return {
    deviceStatus,
    isChecking,
    checkDeviceStatus,
    error,
  };
};
