"use client";
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ButtonType = "usage" | "barcode" | "login";

interface LoginMethodsProps {
  activeButton: ButtonType | null;
}

function LoginMethods({ activeButton }: LoginMethodsProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError(data.error || "로그인 중 오류가 발생했습니다.");
        return;
      }

      // 로그인 성공 시 /client로 리다이렉트
      router.push("/client");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
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
            <form onSubmit={handleLogin}>
              <div className="flex gap-4 mb-6">
                <Input
                  type="email"
                  placeholder="   이메일"
                  className="flex-1 h-12 text-lg bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="   비밀번호"
                  className="flex-1 h-12 text-lg bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="mb-4 p-3 text-red-600 bg-red-50 rounded-md text-sm">
                  {error}
                </div>
              )}
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
          <form onSubmit={handleLogin}>
            <div className="flex gap-4 mb-6">
              <Input
                type="email"
                placeholder="   이메일"
                className="flex-1 h-12 text-lg bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="   비밀번호"
                className="flex-1 h-12 text-lg bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="mb-4 p-3 text-red-600 bg-red-50 rounded-md text-sm">
                {error}
              </div>
            )}
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
    </div>
  );
}

export default LoginMethods;
