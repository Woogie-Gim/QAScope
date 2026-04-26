import { useState, useEffect } from 'react'

function App() {
  const [devices, setDevices] = useState<string[]>([])
  const [packages, setPackages] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState<string>('')
  // 측정 상태 및 실시간 데이터 저장용 State 
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false)
  const [currentData, setCurrentData] = useState({ memory: 0, cpu: 0, temperature: 0 })

  // 앱이 켜질 때 자동으로 기기 상태 확인
  useEffect(() => {
    fetchDevices()
  }, [])

  // 측정 상태(isMeasuring)가 true일 때 1초마다 데이터 갱신
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isMeasuring && selectedPackage) {
      interval = setInterval(async () => {
        const data = await window.electron.ipcRenderer.invoke('measure-resources', selectedPackage)
        setCurrentData(data)
      }, 1000)
    }
    // 컴포넌트 언마운트 또는 측정 중지 시 타이머 정리
    return () => clearInterval(interval)
  }, [isMeasuring, selectedPackage])

  // 백엔드에 'adb devices' 결과 요청
  const fetchDevices = async () => {
    const deviceList = await window.electron.ipcRenderer.invoke('get-devices')
    setDevices(deviceList)

    // 기기가 연결되어 있으면 패키지 목록도 가져오기
    if (deviceList.length > 0) {
      const packageList = await window.electron.ipcRenderer.invoke('get-packages')
      setPackages(packageList)
    } else {
      setPackages([])
      setSelectedPackage('')
      setIsMeasuring(false)
    }
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', color: '#333' }}>
      <h1 style={{ color: '#ffffff', margin: '0 0 10px 0', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>
        🔍 QAScope Dashboard
      </h1>
      <p style={{ color: '#8ab4f8', fontSize: '16px', marginTop: 0, marginBottom: '30px' }}>
        안드로이드 앱 성능(메모리 · CPU · 발열) 실시간 모니터링 및 분석 도구
      </p>

      {/* 디바이스 연결 상태 영역 */}
      <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f4f4f4', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📱 연결된 기기</h2>
          <button onClick={fetchDevices} style={{ padding: '8px 12px', cursor: 'pointer' }}>🔄 새로고침</button>
        </div>
        
        {devices.length > 0 ? (
          <ul style={{ marginTop: '15px', paddingLeft: '20px', fontSize: '16px', fontWeight: 'bold', color: '#28a745' }}>
            {devices.map(dev => <li key={dev}>{dev} (연결됨)</li>)}
          </ul>
        ) : (
          <p style={{ color: '#dc3545', fontWeight: 'bold' }}>⚠️ 연결된 기기가 없습니다. USB 케이블 연결과 USB 디버깅을 확인해주세요.</p>
        )}
      </div>

      {/* 타겟 앱 선택 영역 */}
      <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#e6f7ff', borderRadius: '10px' }}>
        <h2 style={{ marginTop: 0 }}>🎯 타겟 앱 선택</h2>
        <select
          value={selectedPackage}
          onChange={(e) => setSelectedPackage(e.target.value)}
          style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
          disabled={devices.length === 0}
        >
          <option value="">테스트할 앱을 선택하세요</option>
          {packages.map(pkg => (
            <option key={pkg} value={pkg}>{pkg}</option>
          ))}
        </select>
      </div>

      {/* 측정 시작 버튼 */}
      <button
        disabled={!selectedPackage}
        style={{
          width: '100%', padding: '18px', fontSize: '20px', fontWeight: 'bold',
          backgroundColor: selectedPackage ? (isMeasuring ? '#dc3545' : '#007bff') : '#cccccc',
          color: 'white', border: 'none', borderRadius: '10px', 
          cursor: selectedPackage ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.3s'
        }}
        onClick={() => setIsMeasuring(!isMeasuring)}
      >
        {isMeasuring ? '🛑 측정 중지' : '🚀 측정 시작'}
      </button>

      {/* 측정 중일 때 나타나는 실시간 데이터 패널 */}
      {isMeasuring && (
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
          <div style={{ flex: 1, padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '10px', textAlign: 'center', color: '#fff' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#a8c7fa', whiteSpace: 'nowrap', fontSize: '18px' }}>메모리 (MB)</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{currentData.memory}</div>
        </div>
        <div style={{ flex: 1, padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '10px', textAlign: 'center', color: '#fff' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#a8c7fa', whiteSpace: 'nowrap', fontSize: '18px' }}>CPU (%)</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{currentData.cpu}</div>
        </div>
        <div style={{ flex: 1, padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '10px', textAlign: 'center', color: '#fff' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#a8c7fa', whiteSpace: 'nowrap', fontSize: '18px' }}>배터리 온도 (°C)</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{currentData.temperature}</div>
        </div>
</div>
      )}
    </div>
  )
}

export default App