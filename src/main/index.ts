import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { exec } from 'child_process'
import ExcelJS from 'exceljs'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 900,
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
        
        let target = pkgName; 
        if (!pidError && pidStdout && pidStdout.trim() !== '') {
          target = pidStdout.trim().split(/\s+/)[0]; 
        }

        // 앱의 UID 획득
        const getUid = new Promise<string>(function(res) {
          exec(`adb shell dumpsys package ${pkgName} | grep userId=`, function(_, stdout) {
            const match = stdout.match(/userId=(\d+)/);
            res(match ? match[1] : '');
          });
        });

        const getMem = new Promise<string>(function(res) {
          exec(`adb shell dumpsys meminfo ${target}`, function(_, stdout) { res(stdout || ''); });
        });
        const getCpu = new Promise<string>(function(res) {
          exec('adb shell dumpsys cpuinfo', function(_, stdout) { res(stdout || ''); });
        });
        const getBattery = new Promise<string>(function(res) {
          exec('adb shell dumpsys battery', function(_, stdout) { res(stdout || ''); });
        });

        // 앱의 UID 획득 로직 삭제 (더 이상 필요 없음)
        
        // 기기 전체의 네트워크(Wi-Fi, 데이터) 누적 바이트 합산 (안드로이드 11+ 권한 우회)
        const getNetwork = new Promise<number>(function(res) {
          exec('adb shell cat /proc/net/dev', function(_, stdout) {
            let totalBytes = 0;
            if (stdout && stdout.trim() !== '') {
              stdout.split('\n').forEach(function(line) {
                // 내부 루프백(lo) 제외 및 실제 활성화된 네트워크 인터페이스 필터링
                if (line.includes(':') && !line.includes('lo:')) {
                  const parts = line.split(':')[1].trim().split(/\s+/);
                  if (parts.length >= 9) {
                    const rxBytes = parseInt(parts[0], 10); // 수신 바이트
                    const txBytes = parseInt(parts[8], 10); // 송신 바이트
                    if (!isNaN(rxBytes) && !isNaN(txBytes)) {
                      totalBytes += (rxBytes + txBytes);
                    }
                  }
                }
              });
            }
            res(totalBytes);
          });
        });

        Promise.all([getMem, getCpu, getBattery, getNetwork]).then(function(results) {
          const memRaw = results[0];
          const cpuRaw = results[1];
          const batRaw = results[2];
          const networkBytes = results[3]; // 누적 네트워크 바이트

          const memMatch = memRaw.match(/(?:TOTAL PSS:|TOTAL:)\s+(\d+)/i);
          const memory = memMatch ? parseFloat((parseInt(memMatch[1], 10) / 1024).toFixed(2)) : 0;

          const cpuMatch = cpuRaw.match(/(\d+)%\s+TOTAL/i);
          const cpu = cpuMatch ? parseInt(cpuMatch[1], 10) : 0;

          const batMatch = batRaw.match(/temperature:\s+(\d+)/i);
          const temperature = batMatch ? parseInt(batMatch[1], 10) / 10 : 0;

          // 백엔드는 누적 바이트만 프론트엔드로 전달
          resolve({ memory: memory, cpu: cpu, temperature: temperature, networkBytes: networkBytes });
        });
      });
    });
  });

  // 엑셀 리포트 생성 및 저장 (단 1개만 존재해야 함!)
  ipcMain.handle('export-excel', async function(_, { data, config, chartImage }) {
    const { filePath } = await dialog.showSaveDialog({
      title: 'QAScope 리포트 저장',
      defaultPath: `QAScope_Report_${new Date().getTime()}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!filePath) return false;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('성능 측정 데이터');

    // 헤더 설정
    const columns = [{ header: '시간', key: 'time', width: 15 }] as Partial<ExcelJS.Column>[];
    if (config.memory) columns.push({ header: '메모리 (MB)', key: 'memory', width: 15 });
    if (config.cpu) columns.push({ header: 'CPU (%)', key: 'cpu', width: 15 });
    if (config.temperature) columns.push({ header: '온도 (°C)', key: 'temperature', width: 15 });
    if (config.network) columns.push({ header: '네트워크 (KB/s)', key: 'network', width: 15 });

    sheet.columns = columns;

    // 데이터 삽입
    data.forEach(function(item) {
      sheet.addRow(item);
    });

    // 헤더 스타일링
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };

    // 이미지 첨부 로직
    if (chartImage) {
      const base64Data = chartImage.replace(/^data:image\/png;base64,/, "");
      const imageId = workbook.addImage({
        base64: base64Data,
        extension: 'png',
      });
      
      // G열(6) 2행(1) 위치에 800x400 크기로 차트 이미지 삽입
      sheet.addImage(imageId, {
        tl: { col: 6, row: 1 },
        ext: { width: 800, height: 400 }
      });
    }

    await workbook.xlsx.writeFile(filePath);
    return true;
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