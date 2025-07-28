const { spawn } = require('child_process');
const robot = require('robotjs');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require("fs");
const dataFile = path.join(__dirname, "gestures.json");
const axios = require("axios");

const API_KEY = "5ba422352bbc9637d35ff08ff5af681c";
const LAT = 37.5665;
const LON = 126.9780;

const pythonPath = 'D:\\ImmerstionCamp\\Week4\\JAMIM\\jamim_env\\Scripts\\python.exe';
const scriptPath = path.join(__dirname, 'motionCapture', 'motionCapture.py'); 
const LSTMPath = path.join(__dirname, 'motionCapture');
let mainWindow = null;
let pyProc = null;

// 저장 요청
ipcMain.on("save-gestures", (event, data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf-8");
});

// 불러오기 요청
ipcMain.handle("load-gestures", () => {
  if (fs.existsSync(dataFile)) {
    const content = fs.readFileSync(dataFile, "utf-8");
    return JSON.parse(content);
  } else {
    return []; // 빈 배열로 시작
  }
});

//openweather 
ipcMain.handle("get-weather", async () => {
  try {
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&units=metric&appid=${API_KEY}`
    );
    const forecast = res.data.list[0];
    return {
      temp: forecast.main.temp,
      icon: forecast.weather[0].icon,
      description: forecast.weather[0].description,
      pop: Math.round((forecast.pop || 0) * 100),
    };
  } catch (err) {
    console.error("Failed to fetch weather:", err);
    return null;
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:5173');
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('start-python', () => {
  console.log('[IPC] start-python');

  // 만약 이미 pyProc 실행 중이면 중복 방지
  if (pyProc) {
    console.log('python process already active, skipping new start');
    return;
  }

  runPythonMotionProcess()
    .then(() => {
      console.log('Motion capture process over');
    })
    .catch((err) => {
      console.error('Motion capture error', err);
    });
});

// =========== Python 모션 인식 프로세스 실행 ===========
function runPythonMotionProcess() {
  return new Promise((resolve, reject) => {
    if (pyProc) {
      console.log('Motion capture already running');
      return reject('동시 실행 방지');
    }

    pyProc = spawn(pythonPath, [scriptPath], {
      cwd: LSTMPath,
      shell: false
    });

    pyProc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => {
        try {
          if (line.startsWith('{')) {
            // 연속 동작 좌표(JSON): 마우스 이동
            const pos = JSON.parse(line);
            const screen = robot.getScreenSize();
            const x = Math.floor(pos.x * screen.width);
            const y = Math.floor(pos.y * screen.height);
            robot.moveMouse(x, y);
          } else {
            if (line === 'paper') {
              console.log('[Gesture] paper → exit');
              stopPythonProcess();
            } else {
              // 단일 제스처: 단축키 트리거
              console.log(`[Gesture] detected: ${line}`);
              triggerShortcut(line);
            }
          }
        } catch (e) { /* JSON 파싱 안 되면 무시 */ }
      });
    });

    pyProc.stderr.on('data', (data) => {
      console.error(`[Python STDERR] ${data.toString()}`);
    });

    pyProc.on('close', (code) => {
      pyProc = null;
      resolve();
    });

    pyProc.on('error', (err) => {
      console.error('Python 프로세스 실행 에러:', err);
      pyProc = null;
      reject(err);
    });
  });
}

function stopPythonProcess() {
  if (pyProc) {
    pyProc.kill();
    pyProc = null;
  }
}

let isFist = false;
// =========== 단축키 매핑 (수정/확장 가능) ===========
function triggerShortcut(gesture) {
  const normalizeGesture = gesture.trim().toLowerCase();
  switch (normalizeGesture) {
    case 'left_swipe':
      robot.keyTap('tab', ['alt']);
      break;
    case 'fist':
      console.log('[Shortcut] Fist gesture detected');
      if(!isFist) {
        console.log('[Shortcut] acivate mouse down');
        robot.mouseToggle('down', 'left');
        isFist = true;
      }
      break;
    case 'make_fist':
      console.log('[Shortcut] Make fist gesture detected');
      if(!isFist) {
        console.log('[Shortcut] acivate mouse down');
        robot.mouseToggle('down', 'left');
        isFist = true;
      }
      break;
    case 'point':
      console.log('[Shortcut] Point gesture detected');
      if(isFist) {
        console.log('[Shortcut] deactivate mouse down');
        robot.mouseToggle('up', 'left');
        isFist = false;
      }
      break;
    default:
      console.log(`[Shortcut] Unknown gesture: ${gesture}`);
  }
}

// =========== 이벤트 관리 ===========
app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  stopPythonProcess();
  stopClapDetection();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopPythonProcess();
  stopClapDetection();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
