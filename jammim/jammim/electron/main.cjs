const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const robot = require('robotjs');
const brightness = require('brightness');
const defaultGesturesPath = path.join(__dirname,'motionCapture','data', 'gestures.json');
const addCustomPath= path.join(__dirname,'motionCapture','addCustomGesture.py');
console.log("dir name: ", __dirname);
console.log("default gestures path: ", defaultGesturesPath);
const axios = require("axios");

const API_KEY = "5ba422352bbc9637d35ff08ff5af681c";
const LAT = 37.5665;
const LON = 126.9780;

const pythonPath = '/Users/hyeongjeongyi/madcamp/jammim_ui/jammim/jammim/jamim_env/bin/python3';
const scriptPath = path.join(__dirname, 'motionCapture', 'motionCapture.py'); 
const LSTMPath = path.join(__dirname, 'motionCapture');
let mainWindow = null;
let pyProc = null;
const customDataPath = path.join(__dirname, 'motionCapture/data/customData.json');
let customGestures = [];
try {
  customGestures = JSON.parse(fs.readFileSync(customDataPath, 'utf-8'));
} catch (e) {
  console.error('customData.json parse error:', e);
  customGestures = [];
}



ipcMain.handle('load-default-gestures', () => {
  if (fs.existsSync(defaultGesturesPath)) {
    const content = fs.readFileSync(defaultGesturesPath, 'utf-8');
    return JSON.parse(content);
  }
  return [];
});

ipcMain.handle('load-custom-gestures', () => {
  if (fs.existsSync(customDataPath)) {
    const content = fs.readFileSync(customDataPath, 'utf-8');
    return JSON.parse(content);
  }
  return [];
});

ipcMain.on('save-custom-gestures', (event, data) => {
  fs.writeFileSync(customDataPath, JSON.stringify(data, null, 2), 'utf-8');
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

const isMac = process.platform === 'darwin';
let isVolumeChange = false;
let isBrightnessChange = false;
let isSettingBrightness = false;
let prev_y = 0;
const volumeStep = 2;  // 볼륨 조절 단위 (%)

// 볼륨 정보 가져오는 AppleScript 함수
function getCurrentVolume(callback) {
  exec('osascript -e "output volume of (get volume settings)"', (err, stdout, stderr) => {
    if (err) {
      console.error('Failed to get volume:', err);
      callback(null);
      return;
    }
    const volume = parseInt(stdout.trim(), 10);
    callback(volume);
  });
}

// 볼륨 변경 AppleScript 실행 함수
function setVolume(newVolume) {
  // newVolume는 0~100 범위 내로 제한
  const vol = Math.min(100, Math.max(0, newVolume));
  const cmd = `osascript -e "set volume output volume ${vol}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error('Failed to set volume:', err);
    } else {
      console.log(`Volume set to ${vol}%`);
    }
  });
}

const MODIFIERS = new Set(['shift', 'ctrl', 'alt', 'meta', 'control']);

function splitModifiers(keys) {
  const modifiers = [];
  const normalKeys = [];
  
  for (const key of keys) {
    if (MODIFIERS.has(key.toLowerCase())) {
      modifiers.push(key);
    } else {
      normalKeys.push(key);
    }
  }
  
  return { modifiers, normalKeys };
}



async function handleBrightnessChange(isDown) {
  if (isSettingBrightness) {
    return;
  }
  console.log('Now setting brightness:', isDown ? 'down' : 'up');
  isSettingBrightness = true;
  try {

    await brightness.get(async function (err, level) {
      console.log('Current brightness level:', level);

      if (isDown) {
      console.log('[Gesture] Brightness Down');
      const newLevel = level > 0.05 ? level - 0.05 : 0;
      await brightness.set(newLevel, function (err) {
        console.log('Changed brightness to', newLevel * 100, '%');});
    } else {
      console.log('[Gesture] Brightness Up');
      const newLevel = level < 0.95 ? level + 0.05 : 1;
      await brightness.set(newLevel, function (err) {
        console.log('Changed brightness to', newLevel * 100, '%');});
    }
    });

  } catch (err) {
    console.error('Brightness change error:', err);
  } finally {
    isSettingBrightness = false;
  }
}

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
            const pos = JSON.parse(line);
            const screen = robot.getScreenSize();
            const x = Math.floor(pos.x * screen.width);
            const y = Math.floor(pos.y * screen.height);
            if( isVolumeChange ) {
              if( prev_y === 0 ) {
                prev_y = y;
              }
              if( y > prev_y + 0.02 ) {
                console.log('[Gesture] Volume Down');
                if (isMac) {
                  getCurrentVolume((currentVolume) => {
                    if (currentVolume !== null) {
                      setVolume(currentVolume - volumeStep);
                    }
                  })
                } else {
                  robot.keyTap('audio_vol_down');
                }
              } else if( y < prev_y - 0.02 ) {
                console.log('[Gesture] Volume Up');
                if (isMac) {
                  getCurrentVolume((currentVolume) => {
                    if (currentVolume !== null) {
                      setVolume(currentVolume + volumeStep);
                    }
                  })
                } else {
                  robot.keyTap('audio_vol_up');
                }
              }
            } else if( isBrightnessChange ) {
              if( prev_y === 0 ) {
                prev_y = y;
              }
              if( y > prev_y + 0.1 ) {
                console.log('[Gesture] Brightness Down');
                handleBrightnessChange(true);
              } else if( y < prev_y - 0.1 ) {
                console.log('[Gesture] Brightness Up');
                handleBrightnessChange(false);
              }
            } else{
              robot.moveMouse(x, y);
            }
          } else {
            const normalizeLine = line.trim().toLowerCase();
            if (normalizeLine === 'paper') {
              prev_y = 0;
              isBrightnessChange = false;
              isVolumeChange = false;
              console.log('[Gesture] paper → exit');
              stopPythonProcess();
            } else {
              // 단일 제스처: 단축키 트리거
              console.log(`[Gesture] detected: ${normalizeLine}`);
              if(isMac) {
                triggerShortcutMac(normalizeLine);
              } else {
                triggerShortcutWindow(normalizeLine);
              }
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
// =========== 단축키 매핑 ===========
function triggerShortcutWindow(gesture) {

  const customAction = customGestures.find(item => item.name === gesture);

  if (customAction) {
    if (customAction.type === 'shortcut') {
      const keys = customAction.value;
      if (!Array.isArray(keys) || keys.length === 0) {
        console.warn('Invalid shortcut value!');
        return;
      }
      const { modifiers, normalKeys } = splitModifiers(keys);
      if (normalKeys.length === 0) {
        console.warn('No normal key specified for shortcut!');
        return;
      }

      // 첫 번째 일반 키를 메인 키로 사용
      const mainKey = normalKeys[0];
      robot.keyTap(mainKey, modifiers);
      console.log(`[Custom Shortcut] keyTap: ${mainKey} + [${modifiers.join(', ')}]`);
    } else if (customAction.type === 'url') {
      // 링크 열기
      shell.openExternal(customAction.value);
      console.log(`[Custom Link] Open: ${customAction.value}`);
    } else {
      console.warn(`Unknown custom gesture type: ${customAction.type}`);
    }
    return;
  }
  isBrightnessChange = false;
  isVolumeChange = false;
  switch (gesture) {
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
    case 'erm', 'point':
      console.log('[Shortcut] Point gesture detected');
      if(isFist) {
        console.log('[Shortcut] deactivate mouse down');
        robot.mouseToggle('up', 'left');
        isFist = false;
      }
      break;
    case 'left_ok':
      console.log('[Shortcut] left_ok gesture detected');
      if(!isVolumeChange) {
        isVolumeChange = true;
      }
      break;
    case 'right_ok':
      console.log('[Shortcut] right_ok gesture detected');
      if(!isBrightnessChange) {
        isBrightnessChange = true;
      }
      break;
    case 'zoom_in':
      robot.keyTap('f');
      break;
    case 'zoom_out':
      robot.keyTap('f');
      break;
    case 'v':
      exec('start microsoft.windows.camera:', (err) => {
        console.log('[Shortcut] open Camera App');
      });
      break;
    case 'spider':
      shell.openExternal('https://www.youtube.com/watch?v=B9synWjqBn8&list=RDB9synWjqBn8&start_radio=1');
      break;
    case 'thumbsup':
      robot.keyTap('space');
      break;
    default:
      console.log(`[Shortcut] Unknown gesture: ${gesture}`);
  }
}

function triggerShortcutMac(gesture) {

  const customAction = customGestures.find(item => item.name === gesture);

  if (customAction) {
    if (customAction.type === 'shortcut') {
      const keys = customAction.value;
      if (!Array.isArray(keys) || keys.length === 0) {
        console.warn('Invalid shortcut value!');
        return;
      }
      const { modifiers, normalKeys } = splitModifiers(keys);
      if (normalKeys.length === 0) {
        console.warn('No normal key specified for shortcut!');
        return;
      }

      // 첫 번째 일반 키를 메인 키로 사용
      const mainKey = normalKeys[0];
      robot.keyTap(mainKey, modifiers);
      console.log(`[Custom Shortcut] keyTap: ${mainKey} + [${modifiers.join(', ')}]`);
    } else if (customAction.type === 'url') {
      // 링크 열기
      shell.openExternal(customAction.value);
      console.log(`[Custom Link] Open: ${customAction.value}`);
    } else {
      console.warn(`Unknown custom gesture type: ${customAction.type}`);
    }
    return;
  }
  isBrightnessChange = false;
  isVolumeChange = false;
  switch (gesture) {
    case 'left_swipe':
      robot.keyTap('tab', ['command']);
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
    case 'erm', 'point':
      console.log('[Shortcut] Point gesture detected');
      if(isFist) {
        console.log('[Shortcut] deactivate mouse down');
        robot.mouseToggle('up', 'left');
        isFist = false;
      }
      break;
    case 'left_ok':
      console.log('[Shortcut] left_ok gesture detected');
      if(!isVolumeChange) {
        isVolumeChange = true;
      }
      break;
    case 'right_ok':
      console.log('[Shortcut] right_ok gesture detected');
      if(!isBrightnessChange) {
        isBrightnessChange = true;
      }
      break;
    case 'zoom_in':
      robot.keyTap('f');
      break;
    case 'zoom_out':
      robot.keyTap('f');
      robot.keyTap('esc');
      break;
    case 'v':
      exec('open -a "Photo Booth"', (err) => {
        console.log('[Shortcut] open Camera App');
      });
      break;
    case 'spider':
      shell.openExternal('https://www.youtube.com/watch?v=B9synWjqBn8&list=RDB9synWjqBn8&start_radio=1');
      break;
    case 'thumbsup':
      robot.keyTap('space');
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
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopPythonProcess();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

ipcMain.on('start-webcam-script', () => {
  console.log("opening python file..", addCustomPath);
  const python = spawn(pythonPath, [addCustomPath]);

  python.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  python.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  python.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
  });
});

//이거 보내는거 만들어야됨 버튼 만들어줘잉
ipcMain.on('train-LSTM-script', () => {
  console.log('Now training LSTM model');
  const trainLSTM = spawn(pythonPath, [path.join(__dirname, 'motionCapture', 'trainLSTM.py')]);

  trainLSTM.stdout.on('data', (data) => {
    console.log(`trainLSTM stdout: ${data}`);
  });

  trainLSTM.stderr.on('data', (data) => {
    console.error(`trainLSTM stderr: ${data}`);
  });

  trainLSTM.on('close', (code) => {
    console.log(`TrainLSTM script exited with code ${code}`);
  });
});


