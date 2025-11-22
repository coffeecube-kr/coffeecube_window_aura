const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = process.env.NODE_ENV === "development";
let mainWindow;
let pythonProcess = null;

// 배포된 웹 URL (개발/프로덕션 모드에 따라 다른 URL 사용 가능)
const PRODUCTION_URL = "https://coffeecube-window-omega.vercel.app/";
const DEV_URL = "http://localhost:3000";

// Python 서버 시작 함수
function startPythonServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // 개발 모드에서는 수동으로 실행한 서버 사용
      console.log("Development mode: Using manually started Python server");
      resolve();
      return;
    }

    // 프로덕션 모드에서 Python 서버 시작
    const isPackaged = app.isPackaged;
    const appPath = isPackaged
      ? path.join(process.resourcesPath, "app")
      : app.getAppPath();

    const serverExePath = path.join(
      appPath,
      "server",
      "dist",
      "serial-server.exe"
    );

    console.log("Starting Python server...");
    console.log("Server path:", serverExePath);

    // 파일 존재 확인
    const fs = require("fs");
    if (!fs.existsSync(serverExePath)) {
      console.error("ERROR: serial-server.exe not found at:", serverExePath);
      console.warn("⚠ Python server will not be available");
      resolve(); // 서버 없이도 계속 진행
      return;
    }
    console.log("✓ serial-server.exe found");

    // Python 서버 실행
    pythonProcess = spawn(serverExePath, [], {
      cwd: path.dirname(serverExePath),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true, // Windows에서 콘솔 창 숨김
    });

    pythonProcess.stdout.on("data", (data) => {
      console.log(`[Python Server] ${data.toString()}`);

      // 서버가 시작되었는지 확인
      if (data.toString().includes("Uvicorn running")) {
        console.log("Python server started successfully");
        resolve();
      }
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`[Python Server Error] ${data.toString()}`);
    });

    pythonProcess.on("close", (code) => {
      console.log(`Python server exited with code ${code}`);
      pythonProcess = null;
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start Python server:", err);
    });

    pythonProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Python server exited with code ${code}`);
      }
    });

    // 서버가 실제로 준비될 때까지 대기
    const checkServer = async () => {
      const http = require("http");
      for (let i = 0; i < 30; i++) {
        try {
          await new Promise((resolveCheck, rejectCheck) => {
            const req = http.get(`${API_BASE_URL}`, (res) => {
              resolveCheck();
            });
            req.on("error", rejectCheck);
            req.setTimeout(1000, () => {
              req.destroy();
              rejectCheck(new Error("Timeout"));
            });
          });
          console.log("✓ Python server is ready!");
          resolve();
          return;
        } catch (err) {
          console.log(`Waiting for Python server... (${i + 1}/30)`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      console.warn("⚠ Python server failed to start (timeout)");
      resolve(); // 타임아웃되어도 계속 진행
    };

    checkServer();
  });
}

// Python 서버 종료 함수
function stopPythonServer() {
  if (pythonProcess) {
    console.log("Stopping Python server...");
    pythonProcess.kill();
    pythonProcess = null;
  }
}

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

  // Python 서버 시작 후 창 생성
  startPythonServer()
    .then(() => {
      console.log("Python server is ready, creating window...");
      createWindow();
    })
    .catch((err) => {
      console.error(
        "Failed to start Python server, but creating window anyway:",
        err
      );
      createWindow();
    });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  // Python 서버 종료
  stopPythonServer();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // 앱 종료 전 Python 서버 종료
  stopPythonServer();
});
