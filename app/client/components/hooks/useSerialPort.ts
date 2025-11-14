import { useState, useCallback, useRef } from 'react';

interface SerialPortHook {
  isConnected: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendCommand: (command: string) => Promise<boolean>;
  error: string | null;
}

export const useSerialPort = (): SerialPortHook => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  const connect = useCallback(async (): Promise<boolean> => {
    try {
      // Web Serial API 지원 확인
      if (!('serial' in navigator)) {
        setError('Web Serial API가 지원되지 않는 브라우저입니다.');
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
        parity: 'none'
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
      const errorMessage = err instanceof Error ? err.message : '포트 연결에 실패했습니다.';
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
      const errorMessage = err instanceof Error ? err.message : '포트 연결 해제에 실패했습니다.';
      setError(errorMessage);
    }
  }, []);

  const sendCommand = useCallback(async (command: string): Promise<boolean> => {
    try {
      if (!writerRef.current || !isConnected) {
        // 연결되어 있지 않으면 자동으로 연결 시도
        const connected = await connect();
        if (!connected) {
          setError('시리얼 포트가 연결되지 않았습니다.');
          return false;
        }
      }

      if (!writerRef.current) {
        setError('Writer를 사용할 수 없습니다.');
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
      const errorMessage = err instanceof Error ? err.message : '명령 전송에 실패했습니다.';
      setError(errorMessage);
      return false;
    }
  }, [isConnected, connect]);

  return {
    isConnected,
    connect,
    disconnect,
    sendCommand,
    error,
  };
};
