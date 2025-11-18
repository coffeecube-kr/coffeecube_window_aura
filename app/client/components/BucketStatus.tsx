"use client";

import Image from "next/image";
import { EquipmentStatusData } from "../types";

interface BucketStatusProps {
  equipmentData?: EquipmentStatusData;
  loading?: boolean;
}

export default function BucketStatus({
  equipmentData,
  loading = false,
}: BucketStatusProps) {
  // bucket_active 값을 기반으로 활성 버킷 번호 추출
  const getActiveBucketNumber = (): number => {
    if (!equipmentData?.bucket_active) return 1;
    const match = equipmentData.bucket_active.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  };

  const activeBucketNumber = getActiveBucketNumber();
  const isAllBucketsFull = activeBucketNumber === 5; // bucket5면 모든 수거함이 가득 찬 상태

  const buckets = [
    { id: 1, weight: equipmentData?.bucket1 || 0 },
    { id: 2, weight: equipmentData?.bucket2 || 0 },
    { id: 3, weight: equipmentData?.bucket3 || 0 },
    { id: 4, weight: equipmentData?.bucket4 || 0 },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 w-full">
      {buckets.map((bucket) => {
        const isActive = !isAllBucketsFull && activeBucketNumber === bucket.id;
        const isPrevious = !isAllBucketsFull && bucket.id < activeBucketNumber;
        const isDimmed = isAllBucketsFull || isPrevious; // bucket5이거나 이전 수거함이면 dimmed

        return (
          <div
            key={bucket.id}
            className={`box-border flex flex-col gap-3 items-center px-6 py-6 rounded-xl transition-all ${
              isActive
                ? "border-4 border-primary bg-white"
                : isDimmed
                ? "border-4 border-transparent bg-gray-100 opacity-60"
                : "border-4 border-transparent bg-white"
            }`}
          >
            <div
              className={`gap-2.5 px-4 py-1 text-xl font-bold rounded-[100px] ${
                isDimmed
                  ? "bg-gray-300 text-gray-400"
                  : "bg-gray-200 text-zinc-500"
              }`}
            >
              수거함 {bucket.id}
            </div>
            <div className="flex gap-2 justify-center items-center">
              {loading ? (
                <div className="h-[40px] w-[80px] bg-gray-200 animate-pulse rounded" />
              ) : (
                <>
                  <Image
                    src="/weight.svg"
                    alt="weight"
                    width={28}
                    height={28}
                    className={isDimmed ? "opacity-50" : ""}
                  />
                  <div
                    className={`text-2xl font-bold ${
                      isDimmed ? "text-gray-400" : "text-neutral-800"
                    }`}
                  >
                    {bucket.weight}kg
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
