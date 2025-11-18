import { useSerialPort } from "./useSerialPort";
import { useTestMode } from "./useTestMode";

interface CommandSequence {
  send: string;
  receive: string | null;
  duration: number;
}

interface ActionModeHook {
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
 * 환경변수에 따라 테스트 모드 또는 실제 시리얼 통신 모드를 선택하는 훅
 * NEXT_PUBLIC_ACTION_MODE가 'TEST'이면 테스트 모드, 'REAL'이면 실제 시리얼 통신 사용
 */
export const useActionMode = (): ActionModeHook => {
  const mode = process.env.NEXT_PUBLIC_ACTION_MODE || "TEST";

  const serialPort = useSerialPort();
  const testMode = useTestMode();

  // 환경변수에 따라 적절한 훅 반환
  if (mode === "REAL") {
    return serialPort;
  } else {
    return testMode;
  }
};
