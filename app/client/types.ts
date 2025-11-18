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
export type BucketType =
  | "bucket1"
  | "bucket2"
  | "bucket3"
  | "bucket4"
  | "bucket5";

export interface EquipmentStatusData {
  equipment_id?: string;
  robot_code?: string;
  total_weight: number;
  temperature: number;
  device_status: DeviceStatus;
  action_name?: string;
  action_response?: string;
  bucket1?: number;
  bucket2?: number;
  bucket3?: number;
  bucket4?: number;
  bucket_active?: BucketType;
}
