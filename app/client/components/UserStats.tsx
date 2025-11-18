"use client";

import { useState, useEffect } from "react";
import { UserStats as UserStatsType } from "../types";

interface UserStatsProps {
  stats?: UserStatsType;
}

export default function UserStats({ stats: initialStats }: UserStatsProps) {
  const [stats, setStats] = useState<UserStatsType>(
    initialStats || {
      totalInput: "0kg",
      todayInput: "0kg",
      myPoints: "0p",
    }
  );
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/user-stats");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "사용자 통계를 불러오는데 실패했습니다.");
      }

      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
      // 에러 시 기본값 유지
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialStats) {
      return; // 초기 데이터가 있으면 API 호출하지 않음
    }

    fetchUserStats();
  }, [initialStats]);

  // 중량 업데이트 이벤트 리스너
  useEffect(() => {
    const handleWeightUpdate = () => {
      fetchUserStats();
    };

    window.addEventListener("weight_updated", handleWeightUpdate);
    return () => {
      window.removeEventListener("weight_updated", handleWeightUpdate);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 info-container">
        {/* Skeleton 로딩 */}
        <div className="w-full h-[100px] bg-gray-200 animate-pulse rounded-[12px]"></div>
        <div className="w-full h-[100px] bg-gray-200 animate-pulse rounded-[12px]"></div>
        <div className="w-full h-[100px] bg-gray-200 animate-pulse rounded-[12px]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5 info-container">
        <div className="w-full h-[126px] bg-red-50 py-[32px] px-[52px] rounded-[12px] flex flex-row justify-center items-center">
          <p className="text-red-500 text-lg">데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 info-container ">
      <div className="w-full h-[100px] bg-[#E7EDE7] py-[24px] px-[52px] rounded-[12px] flex flex-row justify-between items-center">
        <h3 className="font-semibold text-[24px] text-[#255220]">
          누적 투입량
        </h3>
        <p className="text-[36px] font-bold text-primary">{stats.totalInput}</p>
      </div>

      <div className="w-full h-[100px] bg-[#E7EDE7] py-[24px] px-[52px] rounded-[12px] flex flex-row justify-between items-center">
        <h3 className="font-semibold text-[24px] text-[#255220]">
          오늘 투입량
        </h3>
        <p className="text-[36px] font-bold text-primary">{stats.todayInput}</p>
      </div>

      <div className="w-full h-[100px] bg-[#E7EDE7] py-[24px] px-[52px] rounded-[12px] flex flex-row justify-between items-center">
        <h3 className="font-semibold text-[24px] text-[#255220]">
          마이 포인트
        </h3>
        <p className="text-[36px] font-bold text-primary">{stats.myPoints}</p>
      </div>
    </div>
  );
}
