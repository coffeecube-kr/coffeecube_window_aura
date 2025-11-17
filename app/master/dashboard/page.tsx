import Image from "next/image";
import DashboardPanel from "./components/DashboardPanel";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 현재 로그인한 사용자 정보 가져오기
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // profiles 테이블에서 이메일 가져오기
  let userEmail = "관리자";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (profile?.email) {
      userEmail = profile.email;
    }
  }

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
      <div className="box-border flex flex-col gap-11 justify-center items-center px-20 py-0 mx-auto my-0 w-full max-w-[1080px] min-h-[555px] max-md:px-10 max-md:py-0 max-md:max-w-[991px] max-sm:px-5 max-sm:py-0 max-sm:max-w-screen-sm">
        <div className="box-border flex flex-col gap-8 items-start px-11 py-20 w-full rounded-2xl bg-zinc-100 max-md:gap-7 max-md:px-8 max-md:py-16 max-sm:gap-6 max-sm:px-6 max-sm:py-10 mt-10 min-h-[555px] h-full">
          <div className="flex justify-between items-center w-full">
            <div className="text-3xl font-bold text-zinc-800 max-md:text-3xl max-sm:text-2xl">
              {userEmail}님, 환영합니다.
            </div>
            <LogoutButton />
          </div>

          <DashboardPanel />
        </div>
      </div>
    </div>
  );
}
