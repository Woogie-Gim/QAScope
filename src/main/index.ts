import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { exec } from 'child_process'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', function() {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(function(details) {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(function() {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', function(_, window) {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', function() {
    console.log('pong')
  })

  createWindow()

  // 디바이스 목록 획득
  ipcMain.handle('get-devices', function() {
    return new Promise(function(resolve) {
      exec('adb devices', function(error, stdout) {
        if (error) return resolve([]);
        const lines = stdout.split('\n');
        const devices = lines
          .filter(function(line) { return line.includes('\tdevice'); })
          .map(function(line) { return line.split('\t')[0]; });
        resolve(devices);
      });
    });
  });

  // 서드파티 패키지 목록 획득
  ipcMain.handle('get-packages', function() {
    return new Promise(function(resolve) {
      exec('adb shell pm list packages -3', function(error, stdout) {
        if (error) return resolve([]);
        const packages = stdout.split('\n')
          .filter(function(line) { return line.includes('package:'); })
          .map(function(line) { return line.replace('package:', '').trim(); })
          .sort();
        resolve(packages);
      });
    });
  });

 // PID 기반 리소스 측정 (멀티 프로세스 및 최신 안드로이드 완벽 대응)
  ipcMain.handle('measure-resources', async function(_, pkgName) {
    return new Promise(function(resolve) {
      exec(`adb shell pidof ${pkgName}`, function(pidError, pidStdout) {
        
        // 타겟 설정: PID를 추출하되, 여러 개(예: 1234 1235)면 첫 번째 메인 프로세스만 사용
        // 만약 pidof가 실패하면 최후의 수단으로 패키지명(pkgName)을 그대로 사용
        let target = pkgName; 
        if (!pidError && pidStdout && pidStdout.trim() !== '') {
          target = pidStdout.trim().split(/\s+/)[0]; 
        }

        const getMem = new Promise<string>(function(res) {
          exec(`adb shell dumpsys meminfo ${target}`, function(e, stdout) { res(stdout || ''); });
        });
        const getCpu = new Promise<string>(function(res) {
          exec('adb shell dumpsys cpuinfo', function(e, stdout) { res(stdout || ''); });
        });
        const getBattery = new Promise<string>(function(res) {
          exec('adb shell dumpsys battery', function(e, stdout) { res(stdout || ''); });
        });

        Promise.all([getMem, getCpu, getBattery]).then(function(results) {
          const memRaw = results[0];
          const cpuRaw = results[1];
          const batRaw = results[2];

          // 파싱 로직 개선: 구형(TOTAL:)과 신형(TOTAL PSS:) 포맷 모두 매칭되는 정규식 적용
          const memMatch = memRaw.match(/(?:TOTAL PSS:|TOTAL:)\s+(\d+)/i);
          const memory = memMatch ? parseFloat((parseInt(memMatch[1], 10) / 1024).toFixed(2)) : 0;

          const cpuMatch = cpuRaw.match(/(\d+)%\s+TOTAL/i);
          const cpu = cpuMatch ? parseInt(cpuMatch[1], 10) : 0;

          const batMatch = batRaw.match(/temperature:\s+(\d+)/i);
          const temperature = batMatch ? parseInt(batMatch[1], 10) / 10 : 0;

          resolve({ memory: memory, cpu: cpu, temperature: temperature });
        });
      });
    });
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})