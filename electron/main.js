const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const VERCEL_URL = 'https://coffeecube-window-omega.vercel.app';
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1920,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  // 모바일 viewport 시뮬레이션 설정
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36'
    );
    
    // Viewport를 1080x1920으로 설정
    mainWindow.webContents.executeJavaScript(`
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=1080, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    `);
  });

  // 개발 환경에서는 로컬 서버, 프로덕션에서는 Vercel URL 사용
  const startUrl = isDev ? 'http://localhost:3000' : VERCEL_URL;
  
  console.log('Loading URL:', startUrl);
  
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', err);
  });

  // 로딩 실패 시 에러 로그
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // 페이지 로드 완료 시 로그
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
