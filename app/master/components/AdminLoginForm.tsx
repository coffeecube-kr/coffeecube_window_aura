"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AdminLoginFormProps {
  activeTab: "id" | "barcode";
}

export default function AdminLoginForm({ activeTab }: AdminLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"error" | "success">("error");
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);

  // 브라우저 자동완성 방지를 위한 무작위 name 생성
  const randomFieldNames = useMemo(
    () => ({
      email: `admin-email-${Math.random().toString(36).substring(2, 15)}`,
      password: `admin-password-${Math.random().toString(36).substring(2, 15)}`,
    }),
    []
  );

  // activeTab이 변경될 때마다 이메일 입력 필드에 포커스
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [activeTab]);

  const showModal = (
    title: string,
    message: string,
    type: "error" | "success" = "error"
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        switch (data.error) {
          case "login_failed":
            showModal(
              "로그인 실패",
              "이메일 또는 비밀번호가 올바르지 않습니다."
            );
            break;
          case "insufficient_permissions":
            showModal("권한 없음", "관리자 계정으로 로그인해주세요.");
            break;
          case "profile_not_found":
            showModal("계정 오류", "사용자 프로필을 찾을 수 없습니다.");
            break;
          case "user_not_found":
            showModal("계정 오류", "사용자를 찾을 수 없습니다.");
            break;
          default:
            showModal(
              "서버 오류",
              "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            );
        }
        return;
      }

      // 로그인 성공 시 바로 대시보드로 이동
      router.push("/master/dashboard");
    } catch (error) {
      showModal("네트워크 오류", "네트워크 연결을 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <form
        onSubmit={handleLogin}
        className="mt-8 w-full leading-snug whitespace-nowrap max-md:max-w-full"
        autoComplete="off"
      >
        <div className="flex flex-wrap gap-5 items-start w-full text-base font-semibold text-neutral-400 max-md:max-w-full">
          <div className="flex flex-col flex-1 shrink justify-center p-6 rounded-xl border border-gray-200 border-solid basis-0 bg-zinc-50 min-w-60 max-md:px-5">
            <input
              ref={emailInputRef}
              type="text"
              name={randomFieldNames.email}
              placeholder="아이디"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent outline-none placeholder:text-neutral-400 text-neutral-700"
              autoComplete="nope"
              data-form-type="other"
              required
            />
          </div>
          <div className="flex flex-1 shrink justify-between items-center px-6 py-6 rounded-xl border border-gray-200 border-solid basis-0 bg-zinc-50 min-w-60 max-md:px-5">
            <input
              type="password"
              name={randomFieldNames.password}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent outline-none placeholder:text-neutral-400 text-neutral-700 w-full"
              autoComplete="new-password"
              data-form-type="other"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="flex flex-col justify-center items-center p-6 mt-6 w-full text-[24px] font-extrabold text-center text-white bg-green-600 rounded-xl h-[82px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div>{isLoading ? "로그인 중..." : "로그인"}</div>
        </button>
      </form>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md !data-[state=open]:animate-none !data-[state=closed]:animate-none opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-black">
              {modalTitle}
            </DialogTitle>
            <DialogDescription className="text-base text-gray-700 mt-3">
              {modalMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-6">
            <Button
              onClick={closeModal}
              className="px-6 py-2 text-white"
              style={{ backgroundColor: "#35A53C" }}
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
