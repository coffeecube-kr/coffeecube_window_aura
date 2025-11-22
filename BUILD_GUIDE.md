# CoffeeCube Electron 빌드 가이드

## 개요

이 프로젝트는 Next.js 앱과 Python 시리얼 서버를 Electron으로 패키징하여 데스크톱 애플리케이션으로 만듭니다.
패키징된 exe 파일을 실행하면 자동으로 Python 서버(localhost:8000)와 Next.js 서버(localhost:3000)가 시작되고 Electron 창이 표시됩니다.

## 사전 요구사항

### 1. Node.js 설치

- Node.js 20 이상 필요
- npm이 함께 설치됨

### 2. Python 설치

- Python 3.8 이상 필요
- pip가 함께 설치됨

### 3. PyInstaller 설치

```bash
pip install pyinstaller
```

## 빌드 프로세스

### 방법 1: 자동 빌드 (권장)

```bash
npm run electron:package
```

이 명령은 다음을 자동으로 수행합니다:

1. Python 서버를 단일 실행 파일로 빌드 (serial-server.exe)
2. Next.js 앱을 standalone 모드로 빌드
3. 정적 파일 복사
4. Electron으로 패키징
5. 모든 필요한 파일을 패키징된 앱에 복사

### 방법 2: 단계별 빌드

#### 1단계: Python 서버 빌드

```bash
cd server
build.bat
```

빌드 결과: `server/dist/serial-server.exe`

#### 2단계: Next.js 빌드

```bash
npm run build
```

#### 3단계: Electron 패키징

```bash
npm run electron:package
```

## 빌드 결과

빌드가 완료되면 `dist/CoffeeCube-win32-x64` 폴더에 다음이 생성됩니다:

```
CoffeeCube-win32-x64/
├── CoffeeCube.exe          # 메인 실행 파일
├── resources/
│   └── app/
│       ├── .next/
│       │   └── standalone/  # Next.js 서버
│       ├── server/
│       │   └── dist/
│       │       └── serial-server.exe  # Python 서버
│       ├── electron/
│       │   └── main.js
│       └── .env.local       # 환경 변수
└── ... (기타 Electron 파일들)
```

## 실행 흐름

패키징된 `CoffeeCube.exe` 실행 시:

1. **Electron 앱 시작**
2. **Python 서버 자동 시작** (localhost:8000)
   - 시리얼 포트 통신 API 제공
3. **Next.js 서버 자동 시작** (localhost:3000)
   - 웹 UI 제공
4. **Electron 창 생성 및 표시**
   - localhost:3000 로드
5. **앱 종료 시 모든 서버 자동 종료**

## 개발 모드

### Python 서버 + Next.js 개발 서버 동시 실행

```bash
npm run dev:all
```

### Electron 개발 모드

```bash
npm run electron:dev
```

## 배포

빌드된 `dist/CoffeeCube-win32-x64` 폴더 전체를 압축하여 배포합니다.

### 배포 패키지에 포함되는 것:

- ✅ Electron 런타임
- ✅ Next.js 서버 (Node.js 불필요)
- ✅ Python 서버 (Python 설치 불필요)
- ✅ 모든 정적 파일
- ✅ 환경 변수 (.env.local)

### 사용자 PC 요구사항:

- ✅ Windows 10/11 (64bit)
- ❌ Node.js 설치 불필요
- ❌ Python 설치 불필요
- ❌ 추가 의존성 설치 불필요

## 문제 해결

### Python 서버 빌드 실패

```bash
# PyInstaller 재설치
pip uninstall pyinstaller
pip install pyinstaller

# 수동 빌드
cd server
pyinstaller build-server.spec
```

### Next.js 서버가 시작되지 않는 경우

- 콘솔 로그 확인 (서버 경로, 패키징 상태 등)
- `.next/standalone/server.js` 파일 존재 확인
- `.next` 폴더 삭제 후 재빌드

### Python 서버가 시작되지 않는 경우

- `server/dist/serial-server.exe` 파일 존재 확인
- 수동으로 실행하여 오류 확인
- 방화벽 설정 확인 (localhost:8000)

### 화면이 표시되지 않는 경우

- localhost:3000 포트가 사용 중인지 확인
- 방화벽 설정 확인

### 빌드 실패 시

```bash
# 클린 빌드
Remove-Item -Recurse -Force node_modules, .next, dist, server/dist, server/build
npm install
npm run electron:package
```

## 주요 설정 파일

- `next.config.ts`: Next.js standalone 모드 설정
- `electron/main.js`: Electron 메인 프로세스, 서버 시작 로직
- `electron-builder.yml`: Electron 패키징 설정
- `scripts/package-electron.js`: 패키징 스크립트
- `server/build-server.spec`: PyInstaller 설정
- `server/build.bat`: Python 서버 빌드 스크립트

## 포트 정보

- **Next.js 서버**: http://localhost:3000
- **Python 서버**: http://localhost:8000

## 로그 확인

프로덕션 빌드 실행 시 콘솔 로그를 확인하려면:

- 개발자 도구 열기: `F12` 키
- 또는 `CoffeeCube.exe`를 명령 프롬프트에서 실행

## 추가 정보

- Python 서버는 FastAPI + uvicorn으로 구현
- 시리얼 포트 통신은 pyserial 사용
- Next.js는 standalone 모드로 빌드되어 Node.js 설치 불필요
- Python 서버는 PyInstaller로 단일 실행 파일로 빌드되어 Python 설치 불필요
