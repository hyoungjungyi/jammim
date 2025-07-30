import cv2
import mediapipe as mp
import numpy as np
import pickle
import sys
import json
import time
from tensorflow.keras.models import load_model

CONTINUOUS_GESTURE = {'point', 'down_swipe', 'up_swipe', 'fist', 'right_ok', 'left_ok', 'make_fist', 'erm'}
EXIT_GESTURE = {'paper'}  # 연속 모드 종료 트리거

def predict_gesture(sequence, model, idx2label):
    if len(sequence) < 15:
        return None
    input_data = np.expand_dims(np.array(sequence[-15:]), axis=0)
    pred = model.predict(input_data, verbose=0)
    idx = np.argmax(pred)
    return idx2label[idx]

def main():
    # 모델/라벨 준비
    model = load_model('gesture_lstm_model.keras')
    with open('label2idx.pkl', 'rb') as f:
        label2idx = pickle.load(f)
    idx2label = {v: k for k, v in label2idx.items()}
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands()
    cap = cv2.VideoCapture(0)

    #print("곧 모션 인식이 시작됩니다! 손을 준비해 주세요...", flush=True)
    start_time = time.time()
    while time.time() - start_time < 0.7:
        ret, frame = cap.read()
        if not ret: break
        frame = cv2.flip(frame, 1)
        cv2.putText(frame, "0.7초 후 인식 시작!", (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 200, 0), 3)
        cv2.imshow("Prepare", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            cap.release()
            cv2.destroyAllWindows()
            sys.exit(1)
    cv2.destroyWindow("Prepare")

    # 1. 최초 제스처 인식
    temp_sequence = []
    timeout = 5.0
    while len(temp_sequence) < 20:
        ret, frame = cap.read()
        if not ret or time.time() - start_time > timeout:
            print('Failed to collect enough frames or timeout')
            break

        frame = cv2.flip(frame, 1)
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        if result.multi_hand_landmarks:
            for res in result.multi_hand_landmarks:
                joint = np.array([[lm.x, lm.y, lm.z] for lm in res.landmark]).flatten()
                temp_sequence.append(joint)
                if len(temp_sequence) >= 20:
                    break

    if len(temp_sequence) < 20:
        print('none', flush=True)
        cap.release()
        sys.exit(0)

    gesture_name = predict_gesture(temp_sequence[5:], model, idx2label)
    print(gesture_name, flush=True)

    # 2. 연속 동작 모드 진입
    last_send_time = 0
    min_interval = 0.3
    if gesture_name in CONTINUOUS_GESTURE:
        # 연속 모드에서 최신 프레임 15개 기준 sliding window 예측
        sliding_sequence = []
        prev_geture = gesture_name
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame = cv2.flip(frame, 1)
                result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if result.multi_hand_landmarks:
                    res = result.multi_hand_landmarks[0]
                    joint = np.array([[lm.x, lm.y, lm.z] for lm in res.landmark]).flatten()
                    sliding_sequence.append(joint)
                    # ===== 실시간 좌표 전달 =====
                    now = time.time()
                    if now - last_send_time > min_interval:
                        index = res.landmark[mp_hands.HandLandmark.WRIST]
                        pos = {'x': index.x, 'y': index.y}
                        print(json.dumps(pos), flush=True)
                        last_send_time = now

                    if len(sliding_sequence) >= 15:
                        curr_gesture = predict_gesture(sliding_sequence, model, idx2label)
                        if curr_gesture != prev_geture:
                            if curr_gesture in CONTINUOUS_GESTURE:
                                print(curr_gesture, flush=True)
                                prev_geture = curr_gesture

                        if curr_gesture in EXIT_GESTURE:
                            print(curr_gesture, flush=True)
                            break
                        # sliding window 유지
                        if len(sliding_sequence) > 20:
                            sliding_sequence = sliding_sequence[-20:]
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                time.sleep(0.02)
        finally:
            cap.release()
            cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
