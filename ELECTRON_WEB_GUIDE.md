# Electron 웹 버전 빌드 가이드

## 개요

이 방식은 Vercel에 배포된 웹 앱을 Electron 창에서 로드하는 방식입니다.

- Next.js 서버를 내장하지 않아 빌드가 매우 빠르고 간단합니다
- 실행 파일 크기가 작습니다 (약 200MB)
- 인터넷 연결이 필요합니다
- Node.js 설치가 필요 없습니다

## 빌드 방법

### 1. 의존성 설치 (최초 1회만)

```bash
npm install
```

### 2. Windows용 .exe 파일 생성

```bash
npm run electron:web
```

빌드가 완료되면 `dist/CoffeeCube-win32-x64` 폴더에 실행 파일이 생성됩니다.

## 실행 방법

### 개발 모드 (로컬 서버 사용)

```bash
npm run electron:dev
```

- 로컬 Next.js 개발 서버(localhost:3000)를 사용합니다
- 코드 수정 시 자동으로 반영됩니다

### 프로덕션 모드 (Vercel URL 사용)

```bash
# 빌드 후
cd dist/CoffeeCube-win32-x64
CoffeeCube.exe
```

- Vercel 배포 URL(https://coffeecube-window-omega.vercel.app/)을 로드합니다
- 인터넷 연결이 필요합니다

## 배포 방법

1. `dist/CoffeeCube-win32-x64` 폴더 전체를 압축
2. 현장 컴퓨터로 복사
3. 압축 해제 후 `CoffeeCube.exe` 실행

## URL 변경 방법

배포 URL을 변경하려면 `electron/main-simple.js` 파일을 수정하세요:

```javascript
const PRODUCTION_URL = "https://your-new-url.vercel.app/";
```

## 장단점

### 장점

- ✅ 빌드가 매우 빠름 (1분 이내)
- ✅ 실행 파일 크기가 작음
- ✅ Node.js 설치 불필요
- ✅ 웹 앱 업데이트 시 자동 반영 (exe 재배포 불필요)

### 단점

- ❌ 인터넷 연결 필수
- ❌ 오프라인 사용 불가

## 문제 해결

### 빌드 오류 발생 시

```bash
# node_modules 재설치
Remove-Item -Recurse -Force node_modules
npm install
```

### 실행 파일이 시작되지 않을 때

- 인터넷 연결 확인
- 방화벽 설정 확인
- F12로 개발자 도구를 열어 콘솔 확인

### 화면이 표시되지 않을 때

- Vercel 배포 상태 확인
- URL이 올바른지 확인 (https://coffeecube-window-omega.vercel.app/)
