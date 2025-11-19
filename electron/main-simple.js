const { app, BrowserWindow, session } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";
let mainWindow;

// 배포된 웹 URL (개발/프로덕션 모드에 따라 다른 URL 사용 가능)
const PRODUCTION_URL = "https://coffeecube-window-omega.vercel.app/";
const DEV_URL = "http://localhost:3000";

function createWindow() {
  // 이미 창이 존재하면 생성하지 않음
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("Window already exists, focusing...");
    mainWindow.focus();
    return;
  }

  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

  // 1080x1920 비율 유지하면서 높이를 화면에 맞춤
  const targetRatio = 1080 / 1920;
  const windowHeight = screenHeight;
  const windowWidth = Math.round(windowHeight * targetRatio);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: 0,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false, // 브라우저와 동일한 컨텍스트
      sandbox: true, // 브라우저와 동일한 보안 모델
      // Web Serial API 활성화
      enableBlinkFeatures: "Serial",
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
    fullscreen: false,
    kiosk: false,
    frame: false,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: true,
    alwaysOnTop: !isDev,
    fullscreenable: true,
  });

  // User Agent는 Electron 기본값 사용 (데스크톱 Chrome)

  // 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  console.log(
    `Screen: ${screenWidth}x${screenHeight}, Window: ${windowWidth}x${windowHeight}`
  );

  // 개발 모드면 로컬, 프로덕션 모드면 Vercel URL 사용
  const startUrl = isDev ? DEV_URL : PRODUCTION_URL;
  console.log("Loading URL:", startUrl);

  // URL 로드 (배포된 URL은 재시도 불필요)
  mainWindow.loadURL(startUrl).catch((err) => {
    console.error("Failed to load URL:", err);
  });

  // 로딩 실패 시 에러 로그
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error("Failed to load:", errorCode, errorDescription);
    }
  );

  // 페이지 로드 완료 시 스케일링 적용
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Page loaded successfully");
    applyScaling();
  });

  // 스케일링 적용 함수
  function applyScaling() {
    const bounds = mainWindow.getBounds();
    const currentWidth = bounds.width;
    const currentHeight = bounds.height;

    const scaleX = currentWidth / 1080;
    const scaleY = currentHeight / 1920;
    const scale = Math.min(scaleX, scaleY);

    mainWindow.webContents.setZoomFactor(scale);
    console.log(
      `Applied zoom factor: ${scale} (width: ${currentWidth}, height: ${currentHeight})`
    );
  }

  // F11 키로 전체 화면 토글
  let isInFullScreenMode = false;
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      isInFullScreenMode = !isInFullScreenMode;

      if (isInFullScreenMode) {
        mainWindow.setFullScreen(true);
        mainWindow.setKiosk(false);
        console.log("Entering fullscreen mode");
      } else {
        mainWindow.setFullScreen(false);
        mainWindow.setKiosk(false);
        mainWindow.setBounds({
          width: windowWidth,
          height: windowHeight,
          x: Math.round((screenWidth - windowWidth) / 2),
          y: 0,
        });
        console.log("Exiting fullscreen mode");
      }

      setTimeout(() => {
        applyScaling();
      }, 100);
    }
  });

  // 창 크기 변경 시 스케일링 재적용
  mainWindow.on("resize", () => {
    applyScaling();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Serial API 권한 설정
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission) => {
      console.log(`Permission check: ${permission}`);
      if (permission === "serial") {
        return true;
      }
      return false;
    }
  );

  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log(`Device permission: ${details.deviceType}`);
    if (details.deviceType === "serial") {
      return true;
    }
    return false;
  });

  // select-serial-port 이벤트 핸들러 추가
  session.defaultSession.on(
    "select-serial-port",
    (event, portList, webContents, callback) => {
      console.log("Serial port selection requested");
      console.log("Available ports:", portList);

      // event.preventDefault()를 호출하지 않으면 브라우저 기본 선택 다이얼로그가 표시됨
      // 브라우저와 동일한 동작을 위해 preventDefault 제거
    }
  );

  // 바로 창 생성 (서버 시작 불필요)
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
