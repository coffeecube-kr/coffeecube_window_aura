"use client";

import * as React from "react";
import { RobotCodeSelectorModal } from "@/components/ui/robot-code-selector-modal";

export default function RobotCodeDisplay() {
  const [robotCode, setRobotCode] = React.useState<string>("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    const storedCode = localStorage.getItem("robot_code");
    if (storedCode) {
      setRobotCode(storedCode);
    } else {
      // 로봇 코드가 없으면 모달 자동 열기
      setIsModalOpen(true);
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

  const handleSelect = (code: string) => {
    localStorage.setItem("robot_code", code);
    setRobotCode(code);
    window.dispatchEvent(new Event("robot_code_changed"));
  };

  const handleClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="fixed top-8 right-8 z-50 flex items-center gap-3 justify-center">
        <input
          type="text"
          value={robotCode}
          readOnly
          onClick={handleClick}
          className="w-full px-6 py-3 text-lg font-bold text-neutral-700 bg-white border-2 border-neutral-300 rounded-xl cursor-pointer hover:border-primary hover:shadow-lg transition-all shadow-md text-center"
          placeholder="로봇 코드 선택"
        />
      </div>
      <RobotCodeSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}
