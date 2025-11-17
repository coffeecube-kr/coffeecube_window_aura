import { useState, useCallback, useRef } from "react";

interface TemperatureHook {
  temperature: number | null;
  isReading: boolean;
  readTemperature: () => Promise<number | null>;
  error: string | null;
}

export const useTemperature = (): TemperatureHook => {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [isReading, setIsReading] = useState(false);
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

  const readTemperature = useCallback(async (): Promise<number | null> => {
    setIsReading(true);
    setError(null);

    try {
      // 연결 확인
      if (!writerRef.current || !readerRef.current) {
        const connected = await connect();
        if (!connected) {
          setError("시리얼 포트 연결 실패");
          setIsReading(false);
          return null;
        }
      }

      if (!writerRef.current || !readerRef.current) {
        setError("시리얼 포트 초기화 실패");
        setIsReading(false);
        return null;
      }

      // STRP 명령 전송
      const encoder = new TextEncoder();
      const command = encoder.encode("STRP");
      await writerRef.current.write(command);

      // 응답 대기 (T+xx 또는 T-xx 형식)
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

        // T+xx 또는 T-xx 패턴 찾기
        const tempMatch = buffer.match(/T([+-])(\d{2})/);
        if (tempMatch) {
          const sign = tempMatch[1] === "+" ? 1 : -1;
          const tempValue = parseInt(tempMatch[2], 10);
          const finalTemp = sign * tempValue;

          setTemperature(finalTemp);
          setIsReading(false);
          return finalTemp;
        }
      }

      // 타임아웃
      setError("온도 응답 대기 시간 초과");
      setIsReading(false);
      return null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "온도 읽기 실패";
      setError(errorMessage);
      setIsReading(false);
      return null;
    }
  }, [connect]);

  return {
    temperature,
    isReading,
    readTemperature,
    error,
  };
};
