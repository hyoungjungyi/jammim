import React, { useEffect, useState } from "react";

export default function GesturePanel() {
  const [gestures, setGestures] = useState([]);

  useEffect(() => {
    window.electronAPI.loadGestures().then((data) => {
      setGestures(data);
    });
  }, []);

  const handleAddGesture = () => {
    const newGesture = {
      name: "make fist",
      shortcut: "Alt+Tab"
    };
    const updated = [...gestures, newGesture];
    setGestures(updated);
    window.electronAPI.saveGestures(updated);
  };

  const handleDeleteGesture = (indexToDelete) => {
    const updated = gestures.filter((_, index) => index !== indexToDelete);
    setGestures(updated);
    window.electronAPI.saveGestures(updated); // json 파일에도 반영
  };

  return (
    <div className="glass" style={{ width: "400px", padding: "10px" }}>
      <h3>My Gestures</h3>
      {gestures.map((gesture, i) => (
        <div
          key={i}
          className="glass"
          style={{
            position: "relative",
            padding: "10px",
            marginTop: "10px",
            width: "80%",
          }}
        >
          {/* 삭제 아이콘 (우측 상단) */}
          <button
            onClick={() => handleDeleteGesture(i)}
            style={{
              position: "absolute",
              top: "5px",
              right: "5px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#fff"
            }}
            title="Delete gesture"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="18"
              viewBox="0 0 24 24"
              width="18"
              fill="white"
            >
              <path d="M0 0h24v24H0z" fill="none"/>
              <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1zM18 7H6v12c0 
                1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
            </svg>
          </button>

          <p>Gesture: <strong>{gesture.name}</strong></p>
          <p>Activate: {gesture.shortcut}</p>
        </div>
      ))}

      <button
        onClick={handleAddGesture}
        style={{
          marginTop: "20px",
          width: "90%",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: "white",
          padding: "10px"
        }}
      >
        Add Gesture
      </button>
    </div>
  );
}
