# 빠른 빌드 가이드

## 한 번에 빌드하기

```bash
# 1. Python 서버 빌드
cd server
pyinstaller build-server.spec
cd ..

# 2. Electron 앱 패키징 (Next.js 빌드 포함)
npm run electron:package

# 3. Python 서버를 패키징된 앱에 복사
New-Item -ItemType Directory -Force -Path "dist\CoffeeCube-win32-x64\resources\app\server\dist"
Copy-Item "server\dist\serial-server.exe" "dist\CoffeeCube-win32-x64\resources\app\server\dist\serial-server.exe"
```

## 빌드 결과

빌드 완료 후 `dist\CoffeeCube-win32-x64\CoffeeCube.exe` 파일을 실행하면:

1. ✅ Python 서버 자동 시작 (localhost:8000)
2. ✅ Next.js 서버 자동 시작 (localhost:3000)
3. ✅ Electron 창 표시
4. ✅ 앱 종료 시 모든 서버 자동 종료

## 배포

`dist\CoffeeCube-win32-x64` 폴더 전체를 압축하여 배포하세요.

### 사용자 PC 요구사항

- Windows 10/11 (64bit)
- Node.js 설치 불필요 ✅
- Python 설치 불필요 ✅

## 테스트

빌드된 앱을 테스트하려면:

```bash
cd dist\CoffeeCube-win32-x64
.\CoffeeCube.exe
```

## 문제 해결

### Python 서버가 포함되지 않은 경우

```bash
# Python 서버만 다시 빌드하고 복사
cd server
pyinstaller build-server.spec
cd ..
Copy-Item "server\dist\serial-server.exe" "dist\CoffeeCube-win32-x64\resources\app\server\dist\serial-server.exe"
```

### 전체 재빌드

```bash
# 모든 빌드 산출물 삭제
Remove-Item -Recurse -Force .next, dist, server/dist, server/build

# 처음부터 다시 빌드
cd server
pyinstaller build-server.spec
cd ..
npm run electron:package
Copy-Item "server\dist\serial-server.exe" "dist\CoffeeCube-win32-x64\resources\app\server\dist\serial-server.exe"
```
