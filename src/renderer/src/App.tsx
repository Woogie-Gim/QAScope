import { useState, useEffect } from 'react'

function App() {
  const [devices, setDevices] = useState<string[]>([])
  const [packages, setPackages] = useState<string[]>([])
  const [selectedPackage, setSelectedPackage] = useState<string>('')

  // 앱이 켜질 때 자동으로 기기 상태 확인
  useEffect(() => {
    fetchDevices()
  }, [])

  // 백엔드에 'adb devices' 결과 요청
  const fetchDevices = async () => {
    const deviceList = await window.electron.ipcRenderer.invoke('get-devices')
    setDevices(deviceList)

    // 기기가 연결되어 있으면 패키지 목록도 가져오기
    if (deviceList.length > 0) {
      fetchPackages()
    } else {
      setPackages([])
      setSelectedPackage('')
    }
  }

  // 백엔드에 'pm list packages' 결과 요청
  const fetchPackages = async () => {
    const packageList = await window.electron.ipcRenderer.invoke('get-packages')
    setPackages(packageList)
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', color: '#333' }}>
      <h1>🔍 QAScope Dashboard</h1>
      <p style={{ color: '#666' }}>모바일 리소스 자동 측정 관제탑</p>

      {/* 1. 디바이스 연결 상태 영역 */}
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
          backgroundColor: selectedPackage ? '#007bff' : '#cccccc',
          color: 'white', border: 'none', borderRadius: '10px', 
          cursor: selectedPackage ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.3s'
        }}
        onClick={() => alert(`[${selectedPackage}]\n측정 대시보드 뷰로 이동하는 로직이 추가될 예정입니다!`)}
      >
        🚀 측정 시작
      </button>
    </div>
  )
}

export default App