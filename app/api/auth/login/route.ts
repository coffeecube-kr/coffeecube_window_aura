import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptPassword } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 로그인 시도
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "로그인에 실패했습니다." },
        { status: 401 }
      );
    }

    // 비밀번호 암호화
    const encryptedPasswordValue = encryptPassword(password);

    // 로그인 성공 시 profiles 테이블 업데이트 (last_at, last_access_date, 암호화된 비밀번호)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        last_at: new Date().toISOString(),
        last_access_date: new Date().toISOString(),
        encrypted_password: encryptedPasswordValue,
      })
      .eq("id", authData.user.id);

    if (updateError) {
      // 프로필 업데이트 실패해도 로그인은 성공으로 처리 (로그만 기록)
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      message: "로그인에 성공했습니다.",
    });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
