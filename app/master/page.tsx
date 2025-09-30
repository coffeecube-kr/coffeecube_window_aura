"use client";
import { useState } from "react";
import Image from "next/image";
import AdminLoginForm from "./components/AdminLoginForm";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
export default function MasterPage() {
  const [activeTab, setActiveTab] = useState<"id" | "barcode">("id");
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-start min-h-screen">
      <div className="w-full h-[880px] relative">
        <Image
          src="/main_master.svg"
          alt="main"
          fill
          className="object-cover"
        />
      </div>
      <div className="flex flex-col justify-center px-20 max-md:px-5 w-full mt-10">
        <div className="overflow-hidden p-11 w-full rounded-2xl bg-zinc-100 max-md:px-5 max-md:max-w-full">
          <div className="text-3xl font-extrabold text-zinc-800 max-md:max-w-full flex flex-row gap-2 justify-between items-center">
            <div>관리자 로그인</div>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="text-[24px] text-black w-[158px] h-[69px] bg-[#E3E3E3]"
            >
              
              홈으로 이동
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 items-start mt-8 w-full text-2xl font-extrabold leading-snug text-center max-md:max-w-full">
            <button
              onClick={() => setActiveTab("id")}
              className={`flex flex-col justify-center items-center px-8 py-2.5 rounded-[30px] max-md:px-5 transition-colors ${
                activeTab === "id"
                  ? "text-[#35A53C] bg-[#D6EED5]"
                  : "bg-neutral-200 text-neutral-500"
              }`}
            >
              <div>ID로 로그인</div>
            </button>
            <button
              onClick={() => setActiveTab("barcode")}
              className={`flex flex-col justify-center items-center px-8 py-2.5 rounded-[30px] max-md:px-5 transition-colors ${
                activeTab === "barcode"
                  ? "text-[#35A53C] bg-[#D6EED5]"
                  : "bg-neutral-200 text-neutral-500"
              }`}
            >
              <div>바코드로 로그인</div>
            </button>
          </div>

          {activeTab === "id" ? (
            <AdminLoginForm activeTab={activeTab} />
          ) : (
            <div className="mt-8 w-full">
              <div className="text-xl text-zinc-600 max-md:max-w-full mb-8">
                스마트폰을 통해 앱 로그인 후, 생성된 바코드를 화면 하단의
                바코드리더기에 스캔해주세요.
              </div>

              {/* 바코드 로그인 탭에서도 ID/Password 로그인 폼 표시 */}
              <AdminLoginForm activeTab={activeTab} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
