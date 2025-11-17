export interface Button {
  button_no: number;
  name: string;
  button_type: "client" | "admin";
  created_at: string;
  updated_at: string;
}

export interface ButtonCommand {
  id: number;
  button_no: number;
  send: string;
  receive: string | null;
  duration: number;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

export interface ButtonWithCommands extends Button {
  commands: ButtonCommand[];
}
