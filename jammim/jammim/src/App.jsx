import { useState, useRef, useEffect } from 'react';
import './App.css';
import "./index.css";
import ArcReactorEffect ,{SpinningArc} from './components/ArcReactorEffect';
import GesturePanel from './components/GesturePanel';
import ClockWeatherPanel from './components/ClockWeatherPanel';

function App() {
  const [count, setCount] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  // 음성 인식 시작 함수 (계속 듣기)
  const startRecognition = () => {
    console.log("음성 인식 시작");
    if (isListening) return;
    console.log("음성 인식 시작 중...");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식(Web Speech API)을 지원하지 않습니다.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;   // 계속 듣기 활성화
    recognition.interimResults = false;

    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = (event) => {
      // 최신 인식 결과를 항상 가져오도록
      const lastResultIndex = event.results.length - 1;
      setTranscript(event.results[lastResultIndex][0].transcript.trim());
      console.log("🎤 전체 인식 결과:", transcript);

      // 특정 단어(예: "시작")가 포함되어 있으면 log
      if (transcript.includes("시작")) {
        console.log('특정 단어 "시작" 감지!');
        // 필요하면 recognition.stop(); 로 인식 중단도 가능
      }
      // 다른 단어나 다중 조건은 .includes("캡처") 등으로 추가 가능
    };
    recognition.onerror = (event) => {
      console.error('음성 인식 에러:', event.error);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }


  // 컴포넌트 unmount 시 인식 종료(clean-up)
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    }
  }, []);

  const handlePythonStart = () => {
    console.log(window.electronAPI);
    console.log(typeof window.electronAPI?.startPython);
    if (window.electronAPI && typeof window.electronAPI.startPython === 'function') {
      window.electronAPI.startPython();
      console.log('Python 실행 요청 IPC 전송 완료');
    } else {
      console.error('electronAPI.startPython이 준비되어 있지 않습니다.');
    }
  };

  return (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'auto auto',
      gap: '20px',
      padding: 20,
      color: 'white',
    }}
  >
    <div>
      <GesturePanel />
    </div>
    <div>
      <ArcReactorEffect />
    </div>
    <div>
      <ClockWeatherPanel />
    </div>
    <div style={{ gridColumn: '1 / span 3', textAlign: 'center' }}>
      <button
        onClick={handlePythonStart}
        disabled={isListening}
        style={{
          marginTop: 10,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
        }}
      >
        {isListening ? `듣는 중... :${transcript}` : `음성 인식 지속`}
      </button>
    </div>
  </div>
 );


}
export default App;
