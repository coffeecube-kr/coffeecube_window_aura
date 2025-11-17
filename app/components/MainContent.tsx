"use client";

import { Button } from "@/components/ui/button";
import LoginMethods from "@/components/login-methods";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import WayIcon from "./icons/WayIcon";
import BarcodeIcon from "./icons/BarcodeIcon";
import LoginIcon from "./icons/LoginIcon";
import { RobotCodeSelectorModal } from "@/components/ui/robot-code-selector-modal";

type ButtonType = "usage" | "barcode" | "login";

export default function MainContent() {
  const router = useRouter();
  const [activeButton, setActiveButton] = useState<ButtonType | null>(null);
  const [hoveredButton, setHoveredButton] = useState<ButtonType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [robotCode, setRobotCode] = useState<string>("");

  useEffect(() => {
    const storedCode = localStorage.getItem("robot_code");
    if (storedCode) {
      setRobotCode(storedCode);
    } else {
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

  const handleRobotCodeSelect = (code: string) => {
    localStorage.setItem("robot_code", code);
    setRobotCode(code);
    window.dispatchEvent(new Event("robot_code_changed"));
  };

  const getTopImage = () => {
    switch (activeButton) {
      case "usage":
        return "/howtouse.svg";
      case "barcode":
        return "/howtobarcode.svg";
      case "login":
        return "/main.png";
      default:
        return "/main.png";
    }
  };

  const getButtonStyle = (buttonType: ButtonType) => {
    const isActive = activeButton === buttonType;
    return isActive
      ? "group w-full h-[120px] text-[32px] text-white font-bold rounded-[16px] bg-primary"
      : "group w-full h-[120px] text-[32px] text-primary font-bold rounded-[16px] bg-white border border-primary hover:text-white hover:bg-primary transition-colors";
  };

  const getIconColor = (buttonType: ButtonType) => {
    const isActive = activeButton === buttonType;
    const isHovered = hoveredButton === buttonType;
    return isActive || isHovered ? "white" : "hsl(142 61% 44%)"; // primary 색상
  };

  return (
    <>
      <div className="relative flex flex-col items-center justify-start w-full h-full">
        <Button
          className="absolute bottom-10 left-10 w-20 h-20 bg-[#CECECE] rounded-[20px] z-10"
          onClick={() => router.push("/master")}
        >
          <Image
            src="/mdi_gear.svg"
            alt="logo"
            width={32}
            height={32}
            className="text-white "
          />
        </Button>
        <div className="w-full h-[880px] relative">
          <Image src={getTopImage()} alt="logo" fill className="object-cover" />
          <input
            type="text"
            value={robotCode}
            readOnly
            onClick={() => setIsModalOpen(true)}
            className="absolute top-8 right-8 px-6 py-3 text-lg font-bold text-neutral-700 bg-white border-2 border-neutral-300 rounded-xl cursor-pointer hover:border-primary hover:shadow-lg transition-all shadow-md z-10"
            placeholder="로봇 코드 선택"
          />
        </div>
        <div className="flex-1 w-full mt-10">
          <div className="w-full h-[537px] flex px-20 flex-col gap-y-9 mb-[463px]">
            <div className="flex flex-row gap-x-5 w-full">
              <Button
                className={getButtonStyle("usage")}
                onClick={() => setActiveButton("usage")}
                onMouseEnter={() => setHoveredButton("usage")}
                onMouseLeave={() => setHoveredButton(null)}
              >
                <WayIcon
                  className="mr-2 transition-colors"
                  fill={getIconColor("usage")}
                  style={{
                    width: "40px",
                    height: "40px",
                    minWidth: "40px",
                    minHeight: "40px",
                  }}
                />
                사용 방법
              </Button>
              <Button
                className={getButtonStyle("barcode")}
                onClick={() => setActiveButton("barcode")}
                onMouseEnter={() => setHoveredButton("barcode")}
                onMouseLeave={() => setHoveredButton(null)}
              >
                <BarcodeIcon
                  className="mr-2 transition-colors"
                  fill={getIconColor("barcode")}
                  style={{
                    width: "40px",
                    height: "40px",
                    minWidth: "40px",
                    minHeight: "40px",
                  }}
                />
                바코드 로그인
              </Button>
              <Button
                className={getButtonStyle("login")}
                onClick={() => setActiveButton("login")}
                onMouseEnter={() => setHoveredButton("login")}
                onMouseLeave={() => setHoveredButton(null)}
              >
                <LoginIcon
                  className="mr-2 transition-colors group-hover:!fill-white"
                  fill={getIconColor("login")}
                  style={{
                    width: "40px",
                    height: "40px",
                    minWidth: "40px",
                    minHeight: "40px",
                  }}
                />
                ID 로그인
              </Button>
            </div>
            <LoginMethods activeButton={activeButton} />
          </div>
        </div>
      </div>
      <RobotCodeSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleRobotCodeSelect}
      />
    </>
  );
}
