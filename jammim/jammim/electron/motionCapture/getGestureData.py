import os
import cv2
import mediapipe as mp
import numpy as np
import pickle
import time

def augment_sequence(sequence, noise_std=0.01, n_aug=5):
    augmented_sequences = []
    for _ in range(n_aug):
        noise = np.random.normal(0, noise_std, sequence.shape)
        augmented = sequence + noise
        augmented_sequences.append(augmented)
    return augmented_sequences

mp_hands = mp.solutions.hands
hands = mp_hands.Hands()
cap = cv2.VideoCapture(0)

seq_length = 15
sequence = []
data = []
if os.path.exists('gesture_seq_data.pkl'):
    with open('gesture_seq_data.pkl', 'rb') as f:
        data = pickle.load(f)
    print(f"이전 데이터 {len(data)}개 불러옴")
else:
    data = []
label = 'ok'   # 동작명
collected_count = 0

collecting = False
paused = False
start_collect_time = None
last_saved_time = 0
save_interval = 3      # 시퀀스 간격(초)
n_aug = 5              # 원본당 생성할 증강 시퀀스 수

while cap.isOpened():
    ret, img = cap.read()
    if not ret:
        break
    img = cv2.flip(img, 1)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = hands.process(img_rgb)

    if start_collect_time is not None and not collecting:
        if time.time() - start_collect_time >= 3:
            collecting = True
            last_saved_time = time.time()

    if result.multi_hand_landmarks and collecting and not paused:
        for res, handedness in zip(result.multi_hand_landmarks, result.multi_handedness):
            gesture_label = handedness.classification[0].label.lower()
            if gesture_label == 'left':
                label = 'left_ok'
            elif gesture_label == 'right':
                label = 'right_ok'
            joint = np.array([[lm.x, lm.y, lm.z] for lm in res.landmark]).flatten()
            if time.time() - last_saved_time >= save_interval:
                sequence.append(joint)
                if len(sequence) == seq_length:
                    # ---- 원본 시퀀스 저장 ----
                    data.append([np.array(sequence), label])
                    collected_count += 1
                    print(f"Saved a {label} sequence! Total: {collected_count}")

                    # ---- 증강 데이터 추가 저장 ----
                    aug_seqs = augment_sequence(np.array(sequence), noise_std=0.01, n_aug=n_aug)
                    for aug_seq in aug_seqs:
                        data.append([aug_seq, label])
                        collected_count += 1
                        print(f"Saved AUGMENTED {label} sequence! Total: {collected_count}")

                    sequence = []
                    last_saved_time = time.time()

    # 메시지 표시 (여러 줄 출력)
    msg_lines = []
    if not collecting:
        if start_collect_time is None:
            msg_lines.append("press space to start after 3s")
        else:
            remain = max(0, 3 - (time.time() - start_collect_time))
            msg_lines.append(f"start after {int(remain)+1}s")
    else:
        if paused:
            msg_lines.append(f"paused, total {collected_count} saved")
        else:
            remain = max(0, save_interval - (time.time() - last_saved_time))
            msg_lines.append(f"collecting... {collected_count} saved")
            msg_lines.append(f"collect after {remain:.1f}s")

    y0 = 30
    dy = 30
    for i, line in enumerate(msg_lines):
        y = y0 + i * dy
        cv2.putText(img, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)

    cv2.imshow('Capture', img)
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == 32 and not collecting:
        start_collect_time = time.time()
        paused = False
    elif key == ord('p') and collecting:
        paused = not paused

cap.release()
cv2.destroyAllWindows()

with open('gesture_seq_data.pkl', 'wb') as f:
    pickle.dump(data, f)
print(f"최종 저장 시퀀스: {collected_count}개")

all_labels = sorted(list(set([x[1] for x in data])))
label2idx = {label: idx for idx, label in enumerate(all_labels)}
with open('label2idx.pkl', 'wb') as f:
    pickle.dump(label2idx, f)
