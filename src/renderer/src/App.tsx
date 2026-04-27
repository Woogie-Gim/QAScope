import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import html2canvas from 'html2canvas' // 캡처 라이브러리 추가

function App() {
  const [devices, setDevices] = useState<string[]>([])
  const [packages, setPackages] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState<string>('')
  
  // 측정 상태 및 누적 데이터 관리
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false)
  const [currentData, setCurrentData] = useState({ memory: 0, cpu: 0, temperature: 0 })
  const [history, setHistory] = useState<any[]>([]) 
  
  // 리포트 추출 UI 상태 관리
  const [showExport, setShowExport] = useState(false)
  const [exportConfig, setExportConfig] = useState({ memory: true, cpu: true, temperature: true })

  // 차트 캡처를 위한 참조(ref) 변수 생성
  const chartRef = useRef<HTMLDivElement>(null)

  // 초기 기기 목록 로드
  useEffect(() => { fetchDevices() }, [])

  // 1초 단위 리소스 측정 및 데이터 누적
  useEffect(() => {
    let interval: any
    if (isMeasuring && selectedPackage) {
      setShowExport(false)
      interval = setInterval(async () => {
        const data = await window.electron.ipcRenderer.invoke('measure-resources', selectedPackage)
        const timestamp = new Date().toLocaleTimeString()
        
        const newData = { ...data, time: timestamp }
        setCurrentData(data)
        setHistory(prev => [...prev, newData]) 
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isMeasuring, selectedPackage])

  // ADB 기기 및 패키지 목록 갱신
  const fetchDevices = async () => {
    const list = await window.electron.ipcRenderer.invoke('get-devices')
    setDevices(list)
    if (list.length > 0) setPackages(await window.electron.ipcRenderer.invoke('get-packages'))
  }

  // 측정 중단 및 리포트 창 활성화
  const handleStop = () => {
    setIsMeasuring(false)
    if (history.length > 0) setShowExport(true) 
  }

  // 누적 데이터 엑셀 파일 추출 (차트 이미지 캡처)
  const handleExport = async () => {
    let chartImage = ''
    
    // 차트 DOM 영역을 캔버스로 변환 후 Base64 이미지로 인코딩
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#252525' })
      chartImage = canvas.toDataURL('image/png')
    }

    const success = await window.electron.ipcRenderer.invoke('export-excel', { 
      data: history, 
      config: exportConfig,
      chartImage // 캡처된 이미지를 같이 넘김
    })

    if (success) {
      alert('리포트와 차트가 성공적으로 저장되었습니다!')
      setHistory([])
      setShowExport(false)
    }
  }

  return (
    <div style={{ padding: '35px', boxSizing: 'border-box', minHeight: '100vh', color: '#fff', background: 'transparent' }}>
      <h1 style={{ margin: 0, textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>🔍 QAScope Dashboard</h1>
      <p style={{ color: '#8ab4f8', marginBottom: '25px', fontSize: '15px' }}>실시간 성능 분석 및 리포트 자동화 시스템</p>

      {/* 기기 연결 상태 영역 */}
      <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: 'rgba(42, 42, 42, 0.8)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>📱 연결된 기기</h2>
          <button onClick={fetchDevices} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #555', backgroundColor: '#333', color: '#fff' }}>🔄 새로고침</button>
        </div>
        
        {devices.length > 0 ? (
          <ul style={{ marginTop: '15px', paddingLeft: '20px', fontSize: '15px', fontWeight: 'bold', color: '#82ca9d', marginBottom: 0 }}>
            {devices.map(dev => <li key={dev}>{dev} (연결됨)</li>)}
          </ul>
        ) : (
          <p style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '14px', marginTop: '15px', marginBottom: 0 }}>⚠️ 연결된 기기가 없습니다. USB 케이블 연결과 USB 디버깅을 확인해주세요.</p>
        )}
      </div>

      {/* 타겟 앱 설정 및 측정 제어 영역 */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <select value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #555' }} disabled={isMeasuring}>
          <option value="">타겟 앱 선택</option>
          {packages.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => isMeasuring ? handleStop() : setIsMeasuring(true)}
                style={{ padding: '0 40px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
                         backgroundColor: isMeasuring ? '#dc3545' : '#007bff', color: '#fff' }}>
          {isMeasuring ? '🛑 측정 중단' : '🚀 측정 시작'}
        </button>
      </div>

      {/* 실시간 꺾은선 차트 영역 (이중 Y축) */}
      {/* 캡처를 위해 div에 ref={chartRef} 를 연결 */}
      <div ref={chartRef} style={{ backgroundColor: 'rgba(37, 37, 37, 0.7)', padding: '20px', borderRadius: '10px', height: '350px', marginBottom: '25px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history.slice(-30)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="time" stroke="#888" />
            <YAxis yAxisId="left" stroke="#82ca9d" />
            <YAxis yAxisId="right" orientation="right" stroke="#8884d8" />
            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Line yAxisId="left" type="monotone" dataKey="memory" stroke="#82ca9d" name="메모리(MB)" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU(%)" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#ff7300" name="온도(°C)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 실시간 수치 표시 카드 영역 */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {['메모리 (MB)', 'CPU (%)', '온도 (°C)'].map((label, idx) => (
          <div key={label} style={{ flex: 1, padding: '20px', backgroundColor: 'rgba(51, 51, 51, 0.7)', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ color: '#8ab4f8', marginBottom: '10px', fontSize: '15px', whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {idx === 0 ? currentData.memory : idx === 1 ? currentData.cpu : currentData.temperature}
            </div>
          </div>
        ))}
      </div>

      {/* 엑셀 리포트 추출 팝업 (모달 오버레이 방식) */}
      {showExport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 9999, // 배경을 어둡게 덮고 제일 위로 올림
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            padding: '30px', border: '2px solid #8ab4f8', borderRadius: '15px',
            backgroundColor: '#2a2a2a', boxShadow: '0 15px 30px rgba(0,0,0,0.8)',
            width: '400px', textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '22px' }}>📊 측정 리포트 추출</h3>
            <p style={{ color: '#ccc', marginBottom: '25px', fontSize: '15px', lineHeight: '1.5' }}>
              총 <b>{history.length}</b>개의 데이터가 수집되었습니다.<br/>포함할 항목을 선택하세요.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportConfig.memory} onChange={e => setExportConfig({...exportConfig, memory: e.target.checked})} /> 메모리
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportConfig.cpu} onChange={e => setExportConfig({...exportConfig, cpu: e.target.checked})} /> CPU
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportConfig.temperature} onChange={e => setExportConfig({...exportConfig, temperature: e.target.checked})} /> 온도
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              {/* 취소 버튼 */}
              <button onClick={() => setShowExport(false)} style={{ flex: 1, padding: '12px', fontSize: '16px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                취소
              </button>
              {/* 저장 버튼 */}
              <button onClick={handleExport} style={{ flex: 2, padding: '12px', fontSize: '16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Excel 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App