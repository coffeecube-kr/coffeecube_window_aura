export type DeviceStatus = "정상" | "수거필요" | "장애발생";

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
}

export interface EquipmentStatusResponse {
  message?: string;
  data?: EquipmentStatusData;
  error?: string;
}

export interface ButtonCommand {
  id: number;
  button_no: number;
  send: string | null;
  receive: string | null;
  duration: number | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminButton {
  button_no: number;
  name: string;
  button_type: "client" | "admin";
  created_at: string;
  updated_at: string;
  commands: ButtonCommand[];
}
