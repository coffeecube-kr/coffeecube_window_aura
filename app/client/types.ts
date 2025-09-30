export interface UserStats {
  totalInput: string;
  todayInput: string;
  myPoints: string;
}

export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
}

export type DeviceStatus = "정상" | "수거필요" | "장애발생";

export interface EquipmentStatusData {
  equipment_id?: string;
  robot_code?: string;
  total_weight: number;
  temperature: number;
  device_status: DeviceStatus;
  action_name?: string;
  action_response?: string;
}
