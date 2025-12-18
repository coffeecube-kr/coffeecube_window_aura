"""
시리얼 포트 통신 FastAPI 서버
Electron 앱에서 localhost:8000으로 호출
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import serial
import serial.tools.list_ports
import time
from typing import Optional, List
import uvicorn

app = FastAPI(title="Serial Port Server", version="1.0.0")

# CORS 설정 (Electron 앱에서 접근 가능하도록)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 시리얼 포트 객체 및 취소 플래그
serial_port: Optional[serial.Serial] = None
is_cancelled = False


class CommandRequest(BaseModel):
    command: str
    timeout: float = 3.0
    max_retries: int = 3


class CommandResponse(BaseModel):
    success: bool
    received_data: str
    responses: List[str]
    error: Optional[str] = None


class PortInfo(BaseModel):
    device: str
    description: str


class ConnectRequest(BaseModel):
    port_name: str


@app.get("/")
async def root():
    """서버 상태 확인"""
    return {
        "status": "running",
        "connected": serial_port is not None and serial_port.is_open if serial_port else False,
        "port": serial_port.port if serial_port and serial_port.is_open else None
    }


@app.get("/ports", response_model=List[PortInfo])
async def list_ports():
    """사용 가능한 시리얼 포트 목록 조회"""
    try:
        ports = serial.tools.list_ports.comports()
        return [
            PortInfo(device=port.device, description=port.description)
            for port in ports
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"포트 목록 조회 실패: {str(e)}")


@app.post("/connect")
async def connect_port(request: ConnectRequest):
    """시리얼 포트 연결"""
    global serial_port, is_cancelled
    
    # 취소 플래그 초기화 (새로운 연결 시작)
    is_cancelled = False
    
    try:
        # 기존 연결 완전히 해제
        if serial_port:
            try:
                if serial_port.is_open:
                    serial_port.reset_input_buffer()
                    serial_port.reset_output_buffer()
                    serial_port.close()
                serial_port = None
            except Exception as e:
                print(f"기존 포트 해제 중 오류 (무시): {e}")
                serial_port = None
        
        # 포트 해제 후 대기
        time.sleep(0.3)
        
        # 새 포트 연결
        serial_port = serial.Serial(
            port=request.port_name,
            baudrate=9600,
            bytesize=8,
            parity=serial.PARITY_NONE,
            stopbits=1,
            xonxoff=False,
            rtscts=False,
            dsrdtr=False,
            timeout=0.1,
            write_timeout=2.0
        )
        
        # DTR/RTS 신호 명시적으로 설정 (디바이스 리셋 방지)
        serial_port.dtr = False
        serial_port.rts = False
        
        time.sleep(0.5)  # 포트 안정화
        
        # 초기 버퍼 완전히 비우기 (여러 번 시도)
        for _ in range(3):
            serial_port.reset_input_buffer()
            serial_port.reset_output_buffer()
            time.sleep(0.05)
            # 남아있는 데이터 완전히 제거
            while serial_port.in_waiting > 0:
                serial_port.read(serial_port.in_waiting)
                time.sleep(0.05)
        
        time.sleep(0.2)
        
        return {
            "success": True,
            "message": f"{request.port_name} 포트 연결 성공 (9600,8,N,1)",
            "port": request.port_name
        }
    
    except serial.SerialException as e:
        raise HTTPException(status_code=400, detail=f"포트 연결 실패: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"연결 중 오류: {str(e)}")


@app.post("/cancel")
async def cancel_operation():
    """진행 중인 작업 취소"""
    global is_cancelled, serial_port
    
    is_cancelled = True
    
    # 시리얼 포트 버퍼 완전히 비우기
    if serial_port and serial_port.is_open:
        try:
            # 여러 번 반복해서 버퍼 비우기
            for _ in range(5):
                serial_port.reset_input_buffer()
                serial_port.reset_output_buffer()
                time.sleep(0.05)
                # 남아있는 데이터 완전히 제거
                while serial_port.in_waiting > 0:
                    serial_port.read(serial_port.in_waiting)
                    time.sleep(0.05)
            time.sleep(0.2)
        except Exception as e:
            print(f"버퍼 비우기 중 오류 (무시): {e}")
    
    return {"success": True, "message": "작업 취소 및 버퍼 초기화 완료"}


@app.post("/reset")
async def reset_cancel_flag():
    """취소 플래그 초기화 (새로운 명령 시퀀스 시작 시 호출)"""
    global is_cancelled
    
    is_cancelled = False
    return {"success": True, "message": "취소 플래그 초기화 완료"}


@app.post("/disconnect")
async def disconnect_port():
    """시리얼 포트 연결 해제"""
    global serial_port, is_cancelled
    
    try:
        # 진행 중인 작업 취소
        is_cancelled = True
        time.sleep(0.2)  # 취소 플래그가 반영될 시간 대기
        
        if serial_port:
            try:
                if serial_port.is_open:
                    # 버퍼 완전히 비우기
                    serial_port.reset_input_buffer()
                    serial_port.reset_output_buffer()
                    time.sleep(0.1)
                    serial_port.close()
                serial_port = None
                return {"success": True, "message": "포트 연결 해제 성공"}
            except Exception as e:
                print(f"포트 해제 중 오류: {e}")
                serial_port = None
                return {"success": True, "message": "포트 연결 해제 완료 (오류 무시)"}
        else:
            return {"success": True, "message": "연결된 포트가 없습니다"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"연결 해제 실패: {str(e)}")


@app.post("/send", response_model=CommandResponse)
async def send_command(request: CommandRequest):
    """명령 전송 및 응답 수신 (재시도 포함)"""
    global serial_port, is_cancelled
    
    if not serial_port or not serial_port.is_open:
        raise HTTPException(status_code=400, detail="시리얼 포트가 연결되어 있지 않습니다")
    
    # 취소 플래그 체크
    if is_cancelled:
        return CommandResponse(
            success=False,
            received_data="(취소됨)",
            responses=["(작업이 취소되었습니다)"],
            error="작업이 취소되었습니다"
        )
    
    try:
        all_responses = []
        
        # (ILXX) 형태의 명령어는 1번만 시도, 나머지는 기본값 사용
        # IL로 시작하는 모든 명령어 (ILBS, ILDP, IL01 등) 포함
        import re
        is_il_command = bool(re.match(r'^\(?IL[A-Z0-9]+\)?$', request.command.strip(), re.IGNORECASE))
        max_retries = 1 if is_il_command else request.max_retries
        
        # 재시도 루프
        for attempt in range(max_retries):
            # 각 재시도마다 취소 플래그 체크
            if is_cancelled:
                return CommandResponse(
                    success=False,
                    received_data="(취소됨)",
                    responses=["(작업이 취소되었습니다)"],
                    error="작업이 취소되었습니다"
                )
            # 재시도 시 대기
            if attempt > 0:
                time.sleep(1.0)  # 1초 대기
            
            # 버퍼 비우기 (기존 데이터 제거) - 여러 번 반복
            # IL 명령어는 빠른 응답이 필요하므로 딜레이 최소화
            buffer_clear_delay = 0.01 if is_il_command else 0.05
            for _ in range(2):
                serial_port.reset_input_buffer()
                serial_port.reset_output_buffer()
                time.sleep(buffer_clear_delay)
            
            # 버퍼에 남은 데이터 완전히 제거
            retry_count = 0
            while serial_port.in_waiting > 0 and retry_count < 10:
                serial_port.read(serial_port.in_waiting)
                time.sleep(buffer_clear_delay)
                retry_count += 1
            
            # IL 명령어는 즉시 전송, 나머지는 안정화 대기
            if not is_il_command:
                time.sleep(0.15)
            
            # 명령 전송
            command_bytes = f"{request.command}\r\n".encode('utf-8')
            serial_port.write(command_bytes)
            serial_port.flush()
            
            # 디바이스 처리 시간 대기 - IL 명령어는 빠른 응답 필요
            device_delay = 0.1 if is_il_command else 0.3
            time.sleep(device_delay)
            
            # 응답 수신 (최대 timeout초)
            start_time = time.time()
            responses = []
            buffer = b''
            last_data_time = time.time()
            received_any_data = False
            
            while (time.time() - start_time) < request.timeout:
                # 취소 플래그 체크
                if is_cancelled:
                    return CommandResponse(
                        success=False,
                        received_data="(취소됨)",
                        responses=["(작업이 취소되었습니다)"],
                        error="작업이 취소되었습니다"
                    )
                
                try:
                    # 데이터 읽기 (바이트 단위)
                    if serial_port.in_waiting > 0:
                        chunk = serial_port.read(serial_port.in_waiting)
                        if chunk:
                            buffer += chunk
                            last_data_time = time.time()
                            received_any_data = True
                            
                            # GUI 업데이트를 위한 짧은 대기 - IL 명령어는 더 빠름
                            gui_delay = 0.005 if is_il_command else 0.01
                            time.sleep(gui_delay)
                            
                            # 괄호로 묶인 응답 추출 (IDON) 형식
                            while b'(' in buffer and b')' in buffer:
                                start_idx = buffer.find(b'(')
                                end_idx = buffer.find(b')', start_idx)
                                
                                if start_idx != -1 and end_idx != -1:
                                    response_bytes = buffer[start_idx:end_idx+1]
                                    response = response_bytes.decode('utf-8', errors='ignore').strip()
                                    
                                    if response:
                                        # ===== 테스트용 (IWRP) 응답 변환 =====
                                        # 실제 운영 시 아래 2줄을 주석 처리하세요 (HIDE)
                                        # if response == "(0000)":
                                        #     response = "(1500)"
                                        # ===== 테스트용 변환 끝 =====
                                        
                                        responses.append(response)
                                    
                                    # 처리한 부분 제거
                                    buffer = buffer[end_idx+1:]
                                else:
                                    break
                    
                    # 데이터가 없으면 대기 (취소 즉시 반응을 위해 짧은 주기)
                    else:
                        wait_delay = 0.005 if is_il_command else 0.01
                        time.sleep(wait_delay)
                        
                        # 응답을 받았고 IL 명령어는 0.2초, 나머지는 0.5초간 추가 데이터가 없으면 즉시 종료
                        timeout_check = 0.2 if is_il_command else 0.5
                        if responses and (time.time() - last_data_time) > timeout_check:
                            break
                
                except Exception as e:
                    break
            
            # 남은 버퍼 처리
            if buffer:
                remaining = buffer.decode('utf-8', errors='ignore').strip()
                if remaining:
                    responses.append(remaining)
            
            # 응답을 받았으면 성공으로 간주하고 종료
            if responses:
                all_responses.extend(responses)
                return CommandResponse(
                    success=True,
                    received_data=", ".join(responses),
                    responses=responses,
                    error=None
                )
            
            # 응답이 없으면 계속
            if received_any_data:
                all_responses.append("(응답 없음 - 데이터는 수신했으나 괄호 형식 없음)")
            else:
                all_responses.append("(응답 없음 - 데이터 미수신)")
        
        # 모든 재시도 실패
        return CommandResponse(
            success=False,
            received_data="(응답 없음)",
            responses=all_responses,
            error=f"응답 수신 실패 (총 {max_retries}회 시도)"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"명령 전송 중 오류: {str(e)}")


@app.get("/status")
async def get_status():
    """현재 연결 상태 조회"""
    if serial_port and serial_port.is_open:
        return {
            "connected": True,
            "port": serial_port.port,
            "baudrate": serial_port.baudrate,
            "in_waiting": serial_port.in_waiting
        }
    else:
        return {
            "connected": False,
            "port": None
        }


if __name__ == "__main__":
    # 서버 실행
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=False,
        reload=False,
        workers=1
    )
