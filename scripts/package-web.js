const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

async function packageApp() {
  try {
    console.log("📦 Starting Electron packaging (Web version)...\n");

    // Electron Packager로 패키징 (Next.js 빌드 불필요)
    console.log("Step 1: Packaging with electron-packager...");
    execSync(
      'electron-packager . CoffeeCube --platform=win32 --arch=x64 --out=dist --overwrite --icon=public/favicon.ico --electron-version=39.1.2 --ignore="^/(dist|.git|.next|node_modules/.cache)"',
      { stdio: "inherit" }
    );

    console.log("\nStep 2: Creating README...");

    const distPath = path.join(__dirname, "..", "dist", "CoffeeCube-win32-x64");

    // README 생성
    const readme = `# CoffeeCube 실행 가이드

## 실행 방법

**간단 실행**: \`CoffeeCube.exe\`를 더블클릭하면 됩니다!
- 인터넷 연결이 필요합니다 (Vercel 배포 버전 사용)
- 별도의 Node.js 설치가 필요 없습니다

## 종료 방법
- Electron 창을 닫으면 됩니다

## 문제 해결

### 화면이 표시되지 않는 경우
1. 인터넷 연결을 확인하세요
2. 방화벽 설정을 확인하세요
3. 개발자 도구(F12)를 열어 콘솔 에러를 확인하세요

## 배포 URL
https://coffeecube-window-omega.vercel.app/

## 폴더 구조
- \`CoffeeCube.exe\`: Electron 실행 파일 (이것만 실행하면 됩니다!)
- \`resources/\`: Electron 리소스 파일들
`;

    await fs.writeFile(path.join(distPath, "README.md"), readme);
    console.log("✓ Created README.md");

    console.log("\n✅ Packaging completed successfully!");
    console.log(`📦 Packaged app location: ${distPath}`);
    console.log("\n다음 단계:");
    console.log("1. dist/CoffeeCube-win32-x64 폴더를 현장 컴퓨터로 복사");
    console.log("2. CoffeeCube.exe 실행 (인터넷 연결 필요)");
    console.log("\n💡 Node.js 설치가 필요 없습니다!");
  } catch (error) {
    console.error("❌ Packaging failed:", error);
    process.exit(1);
  }
}

packageApp();
