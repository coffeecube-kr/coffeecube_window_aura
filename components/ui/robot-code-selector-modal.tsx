"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Equipment {
  id: string;
  name: string;
  robot_code: string;
  install_location: string;
  region_si: string;
}

interface RobotCodeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (robotCode: string) => void;
}

const RobotCodeSelectorModal = React.forwardRef<
  HTMLDivElement,
  RobotCodeSelectorModalProps
>(({ isOpen, onClose, onSelect }, ref) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [equipmentList, setEquipmentList] = React.useState<Equipment[]>([]);
  const [filteredList, setFilteredList] = React.useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedRobotCode, setSelectedRobotCode] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedRobotCode(null);
      fetchEquipmentList("");
    }
  }, [isOpen]);

  React.useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEquipmentList(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const fetchEquipmentList = async (search: string) => {
    setIsLoading(true);
    try {
      const url = search
        ? `/api/equipment/list?search=${encodeURIComponent(search)}`
        : "/api/equipment/list";
      const response = await fetch(url);

      if (!response.ok) {
        const result = await response.json();
        console.log("API 에러:", result.error);
        setEquipmentList([]);
        setFilteredList([]);
        return;
      }

      const result = await response.json();

      if (result.data) {
        setEquipmentList(result.data);
        setFilteredList(result.data);
      } else {
        setEquipmentList([]);
        setFilteredList([]);
      }
    } catch (error) {
      console.log("장비 목록 조회 실패:", error);
      setEquipmentList([]);
      setFilteredList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = (robotCode: string) => {
    setSelectedRobotCode(robotCode);
  };

  const handleConfirm = () => {
    if (selectedRobotCode) {
      onSelect(selectedRobotCode);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={ref}
        className="box-border inline-flex flex-col gap-6 items-center p-10 rounded-3xl bg-zinc-100 w-[600px] max-h-[80vh] max-md:w-full max-md:max-w-[480px] max-sm:w-full max-sm:max-w-[360px] max-sm:p-6"
      >
        <div className="flex flex-col gap-3 justify-center items-center w-full">
          <div className="text-3xl font-bold text-neutral-600 max-md:text-2xl max-sm:text-xl">
            장비 선택
          </div>
          <div className="text-base font-semibold text-center text-neutral-400 max-sm:text-sm">
            설치 위치를 검색하여 장비를 선택하세요
          </div>
        </div>

        <div className="w-full">
          <Input
            type="text"
            placeholder="설치 위치, 장비명, 로봇 코드로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 text-base bg-white px-4 rounded-xl border-2 border-neutral-300 focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-3 w-full overflow-y-auto max-h-[400px] pr-2">
          {isLoading ? (
            <div className="text-center py-8 text-neutral-400">로딩 중...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              검색 결과가 없습니다
            </div>
          ) : (
            filteredList.map((equipment) => (
              <button
                key={equipment.id}
                onClick={() => handleItemClick(equipment.robot_code)}
                className={`flex flex-col gap-1 p-4 rounded-xl transition-colors text-left border-2 ${
                  selectedRobotCode === equipment.robot_code
                    ? "bg-primary/20 border-primary"
                    : "bg-white hover:bg-primary/10 border-neutral-200 hover:border-primary"
                }`}
              >
                <div className="text-lg font-bold text-neutral-700">
                  {equipment.install_location}
                </div>
                <div className="text-sm text-neutral-500">
                  {equipment.name} | {equipment.robot_code}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 w-full">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-14 text-xl font-black rounded-xl border-2 border-neutral-300 hover:bg-neutral-100"
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedRobotCode}
            className="flex-1 h-14 text-xl font-black rounded-xl bg-primary hover:bg-primary/80 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            확인
          </Button>
        </div>
      </div>
    </div>
  );
});

RobotCodeSelectorModal.displayName = "RobotCodeSelectorModal";

export { RobotCodeSelectorModal };
