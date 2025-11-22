# Serial Port Communication Server

Python FastAPI 서버로 시리얼 포트 통신을 처리합니다.

## 설치

```bash
cd server
pip install -r requirements.txt
```

## 개발 모드 실행

```bash
python main.py
```

서버가 `http://localhost:8000`에서 실행됩니다.

## API 엔드포인트

### 1. 서버 상태 확인

```
GET /
```

### 2. 포트 목록 조회

```
GET /ports
```

### 3. 포트 연결

```
POST /connect
Body: { "port_name": "COM3" }
```

### 4. 포트 연결 해제

```
POST /disconnect
```

### 5. 명령 전송

```
POST /send
Body: {
  "command": "(IWBP)",
  "timeout": 3.0,
  "max_retries": 3
}
```

응답:

```json
{
  "success": true,
  "received_data": "(IDON)",
  "responses": ["(IDON)"],
  "error": null
}
```

### 6. 연결 상태 조회

```
GET /status
```

## Electron 통합

Electron 앱이 시작될 때 자동으로 Python 서버가 실행됩니다.
웹앱에서는 `http://localhost:8000` API를 통해 시리얼 포트와 통신합니다.

## 패키징

Electron 앱을 패키징할 때 Python 실행 파일과 서버 코드가 함께 포함됩니다.

### 필요한 파일:

- `server/main.py` - FastAPI 서버
- `server/requirements.txt` - Python 의존성
- Python 실행 파일 (PyInstaller로 빌드)

### PyInstaller로 빌드:

```bash
pip install pyinstaller
pyinstaller --onefile --add-data "main.py;." main.py
```
