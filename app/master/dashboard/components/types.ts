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

export interface EquipmentStatusResponse {
  message?: string;
  data?: EquipmentStatusData;
  error?: string;
}
