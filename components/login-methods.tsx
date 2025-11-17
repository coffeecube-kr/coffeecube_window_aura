"use client";
import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RobotCodeSelectorModal } from "@/components/ui/robot-code-selector-modal";
import { toast } from "sonner";

type ButtonType = "usage" | "barcode" | "login";

interface LoginMethodsProps {
  activeButton: ButtonType | null;
}

function LoginMethods({ activeButton }: LoginMethodsProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showRobotCodeModal, setShowRobotCodeModal] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(false);
  const router = useRouter();
  const barcodeEmailInputRef = useRef<HTMLInputElement>(null);
  const loginEmailInputRef = useRef<HTMLInputElement>(null);

  // 바코드 로그인 또는 ID 로그인 버튼이 활성화되면 이메일 입력 필드에 포커스
  useEffect(() => {
    if (activeButton === "barcode" && barcodeEmailInputRef.current) {
      barcodeEmailInputRef.current.focus();
    } else if (activeButton === "login" && loginEmailInputRef.current) {
      loginEmailInputRef.current.focus();
    }
  }, [activeButton]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // robot_code 체크
    const robotCode = localStorage.getItem("robot_code");
    if (!robotCode) {
      setIsLoading(false);
      setPendingLogin(true);
      setShowRobotCodeModal(true);
      toast.error("장비 번호를 선택 후 로그인해주세요.", {
        duration: 3000,
        position: "top-center",
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.error || "로그인 중 오류가 발생했습니다.";

        // Invalid credentials 에러를 한국어로 변환
        if (
          errorMessage.toLowerCase().includes("invalid") &&
          (errorMessage.toLowerCase().includes("credential") ||
            errorMessage.toLowerCase().includes("login"))
        ) {
          errorMessage = "아이디/비밀번호가 일치하지 않습니다.";
        }

        setError(errorMessage);
        setShowErrorModal(true);
        return;
      }

      // 로그인 성공 시 /client로 리다이렉트
      router.push("/client");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다."
      );
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRobotCodeSelect = async (robotCode: string) => {
    localStorage.setItem("robot_code", robotCode);
    toast.success("장비가 선택되었습니다.", {
      duration: 3000,
      position: "top-center",
    });

    // 로그인 대기 중이었다면 로그인 진행
    if (pendingLogin) {
      setPendingLogin(false);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          let errorMessage = data.error || "로그인 중 오류가 발생했습니다.";

          if (
            errorMessage.toLowerCase().includes("invalid") &&
            (errorMessage.toLowerCase().includes("credential") ||
              errorMessage.toLowerCase().includes("login"))
          ) {
            errorMessage = "아이디/비밀번호가 일치하지 않습니다.";
          }

          setError(errorMessage);
          setShowErrorModal(true);
          return;
        }

        router.push("/client");
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다."
        );
        setShowErrorModal(true);
      } finally {
        setIsLoading(false);
      }
    }
  };
  // 바코드 로그인이 선택되었을 때의 UI
  if (activeButton === "barcode") {
    return (
      <div className="overflow-hidden p-11 rounded-2xl bg-zinc-100 w-full text-zinc-800 max-md:px-5">
        <div
          className="text-3xl font-extrabold max-md:max-w-full"
          data-name="바코드로 로그인"
        >
          바코드로 로그인
        </div>
        <div className="mt-5 w-full max-md:mt-10 max-md:max-w-full">
          <div
            className="text-xl mb-6 max-md:max-w-full"
            data-name="스마트폰을 통해 앱 로그인 후, 생성된 바코드를 화면 하단의 바코드리더기에 스캔해주세요."
          >
            스마트폰을 통해 앱 로그인 후, 생성된 바코드를 화면 하단의
            바코드리더기에 스캔해주세요.
          </div>

          {/* 아이디/비밀번호 로그인 섹션 추가 */}
          <div className="">
            <form onSubmit={handleLogin} autoComplete="off">
              <div className="flex gap-4 mb-6">
                <Input
                  ref={barcodeEmailInputRef}
                  type="text"
                  name="barcode-email-field"
                  placeholder="   이메일"
                  className="flex-1 h-12 text-lg bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="nope"
                  data-form-type="other"
                  required
                />
                <Input
                  type="password"
                  name="barcode-password-field"
                  placeholder="   비밀번호"
                  className="flex-1 h-12 text-lg bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  data-form-type="other"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-[82px] text-[24px] font-bold bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </div>
        </div>
        <Modal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title="로그인 실패"
          description={error || "로그인 중 오류가 발생했습니다."}
          confirmText="확인"
          variant="default"
        />
        <RobotCodeSelectorModal
          isOpen={showRobotCodeModal}
          onClose={() => {
            setShowRobotCodeModal(false);
            setPendingLogin(false);
          }}
          onSelect={handleRobotCodeSelect}
        />
      </div>
    );
  }

  // ID 로그인이 선택되었을 때의 UI
  if (activeButton === "login") {
    return (
      <div className="overflow-hidden p-11 rounded-2xl bg-zinc-100 w-full text-zinc-800 max-md:px-5">
        <div
          className="text-3xl font-extrabold max-md:max-w-full"
          data-name="ID 로그인"
        >
          ID 로그인
        </div>
        <div className="mt-5 w-full max-md:mt-10 max-md:max-w-full">
          <div
            className="text-xl mb-6 max-md:max-w-full"
            data-name="회원가입 시 사용한 이메일을 통해 로그인 할 수 있습니다."
          >
            회원가입 시 사용한 이메일을 통해 로그인 할 수 있습니다.
          </div>
          <form onSubmit={handleLogin} autoComplete="off">
            <div className="flex gap-4 mb-6">
              <Input
                ref={loginEmailInputRef}
                type="text"
                name="login-email-field"
                placeholder="   이메일"
                className="flex-1 h-12 text-lg bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="nope"
                data-form-type="other"
                required
              />
              <Input
                type="password"
                name="login-password-field"
                placeholder="   비밀번호"
                className="flex-1 h-12 text-lg bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                data-form-type="other"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-[82px] text-[24px] font-bold bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
        <Modal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title="로그인 실패"
          description={error || "로그인 중 오류가 발생했습니다."}
          confirmText="확인"
          variant="default"
        />
        <RobotCodeSelectorModal
          isOpen={showRobotCodeModal}
          onClose={() => {
            setShowRobotCodeModal(false);
            setPendingLogin(false);
          }}
          onSelect={handleRobotCodeSelect}
        />
      </div>
    );
  }

  // 기본 UI (바코드 로그인이 선택되지 않았을 때)
  return (
    <div className="overflow-hidden p-11 rounded-2xl bg-zinc-100 max-w-[920px] text-zinc-800 max-md:px-5">
      <div
        className="text-3xl font-extrabold max-md:max-w-full"
        data-name="로그인 방법"
      >
        로그인 방법
      </div>
      <div className="mt-5 w-full max-md:mt-5 max-md:max-w-full">
        <div className="w-full max-md:max-w-full">
          <div className="flex gap-2.5 justify-center items-center px-4 py-2.5 w-full text-2xl font-bold rounded bg-zinc-300 min-h-12 max-md:max-w-full">
            <div className="self-stretch my-auto" data-name="바코드 로그인">
              바코드 로그인
            </div>
          </div>
          <div
            className="mt-6 text-xl max-md:max-w-full"
            data-name="스마트폰을 통해 앱 로그인 후, 생성된 바코드를 화면 하단의 바코드리더기에 스캔해주세요."
          >
            스마트폰을 통해 앱 로그인 후, 생성된 바코드를 화면 하단의
            바코드리더기에 스캔해주세요.{" "}
          </div>
        </div>
        <div className="flex flex-col justify-center mt-6 w-full max-md:max-w-full">
          <div className="flex gap-2.5 justify-center items-center px-4 py-2 w-full text-2xl font-bold rounded bg-zinc-300 min-h-[45px] max-md:max-w-full">
            <div className="self-stretch my-auto" data-name="ID 로그인">
              ID 로그인
            </div>
          </div>
          <div
            className="mt-6 text-xl max-md:max-w-full"
            data-name="회원가입 시 사용한 ID를 통해 로그인 할 수 있습니다."
          >
            회원가입 시 사용한 ID를 통해 로그인 할 수 있습니다.
          </div>
        </div>
      </div>
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="로그인 실패"
        description={error || "로그인 중 오류가 발생했습니다."}
        confirmText="확인"
        variant="destructive"
      />
      <RobotCodeSelectorModal
        isOpen={showRobotCodeModal}
        onClose={() => {
          setShowRobotCodeModal(false);
          setPendingLogin(false);
        }}
        onSelect={handleRobotCodeSelect}
      />
    </div>
  );
}

export default LoginMethods;
