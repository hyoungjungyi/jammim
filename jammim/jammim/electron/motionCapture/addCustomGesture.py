import os
import cv2
import mediapipe as mp
import numpy as np
import pickle
import time
import sys , json, base64


# 설정
box_count = 9
per_box = 4
current_box = 0
per_box_count = 0

width, height = 640, 480
grid_cols, grid_rows = 3, 3
cell_width = width // grid_cols
cell_height = height // grid_rows
base_dir = os.path.dirname(os.path.abspath(__file__))
print("base_dir:", base_dir)
save_dir = os.path.join(base_dir,"data")
print("save dir: ", save_dir)

custom_data_path = os.path.join(save_dir, "customData.json")
print("custom data path: ",custom_data_path)
os.makedirs(save_dir, exist_ok=True)

# 경로 만들기
seq_path = os.path.join(base_dir, "gesture_seq_data.pkl")
label_path = os.path.join(base_dir, "label2idx.pkl")
print("seq path", seq_path, "label path",label_path)



if os.path.exists(custom_data_path):
    with open(custom_data_path, "r") as f:
        all_gestures = json.load(f)
    if all_gestures:
        input_json = all_gestures[-1]  # 최신 제스처
    else:
        input_json = {
            "name": "default",
            "type": "shortcut",
            "value": []
        }
else:
    input_json = {
        "name": "default",
        "type": "shortcut",
        "value": []
    }

gesture_name = input_json['name']
action_type = input_json['type']
value = input_json['value']



gesture_meta = {
    "name": gesture_name,
    "type": action_type,
    "value": value
}



if os.path.exists(custom_data_path):
    with open(custom_data_path, "r") as f:
        try:
            existing_data = json.load(f)
            if not isinstance(existing_data, list):
                existing_data = []
        except json.JSONDecodeError:
            existing_data = []
else:
    existing_data = []

existing_data.append(gesture_meta)

with open(custom_data_path, "w") as f:
    json.dump(existing_data, f, indent=2)



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
cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

seq_length = 15
sequence = []
data = []

if os.path.exists(seq_path):
    with open(seq_path, 'rb') as f:
        data = pickle.load(f)
    print(f"got data from prev : {len(data)}")
else:
    data = []

label = gesture_name
collected_count = 0

collecting = False
paused = False
start_collect_time = None
last_saved_time = 0
save_interval = 3
n_aug = 5

instruction_texts = ["Slowly", "Far Away", "Close Up", "Quickly"]

instruction = ""
show_instruction_time = None
countdown_start_time = None
countdown_in_progress = False
collecting_sequence = False

while cap.isOpened():
    ret, img = cap.read()
    if not ret:
        break
    img = cv2.flip(img, 1)
    img = cv2.resize(img, (width, height))
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = hands.process(img_rgb)

    # box 넘어가면 종료
    if current_box >= box_count:
        print("All boxes collected!")
        break

    # --- 수집 전: instruction 보여주기 + countdown ---
    if not collecting and not countdown_in_progress:
        instruction = instruction_texts[per_box_count]
        show_instruction_time = time.time()
        countdown_start_time = show_instruction_time + 2  # 2초 instruction -> countdown 시작
        countdown_in_progress = True
        print(f"Box {current_box+1} - {instruction} ready")

    now = time.time()

    # countdown 중
    if countdown_in_progress and not collecting:
        remaining = countdown_start_time - now
        if remaining <= 0:
            collecting = True
            collecting_sequence = True
            sequence = []
            print("GO! Start Recording")
        else:
            cv2.putText(img, instruction, (200, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
            cv2.putText(img, f"{int(remaining)+1}", (300, 250), cv2.FONT_HERSHEY_SIMPLEX, 4, (0, 0, 255), 6)

    # --- 수집 중: 15프레임 수집 ---
    if collecting and result.multi_hand_landmarks:
        for res in result.multi_hand_landmarks:
            joint = np.array([[lm.x, lm.y, lm.z] for lm in res.landmark]).flatten()
            sequence.append(joint)

            if len(sequence) == seq_length:
                data.append([np.array(sequence), label])
                collected_count += 1
                per_box_count += 1
                print(f"Box {current_box+1} - {label} [{per_box_count}/{per_box}]")

                # 증강
                for aug_seq in augment_sequence(np.array(sequence), noise_std=0.01, n_aug=n_aug):
                    data.append([aug_seq, label])
                    collected_count += 1

                sequence = []
                collecting = False
                collecting_sequence = False
                countdown_in_progress = False

                if per_box_count >= per_box:
                    current_box += 1
                    per_box_count = 0
                break


    # ----------- 화면에 3x3 격자 박스 표시 -----------
    for i in range(grid_rows):
        for j in range(grid_cols):
            x1 = j * cell_width
            y1 = i * cell_height
            x2 = x1 + cell_width
            y2 = y1 + cell_height
            index = i * grid_cols + j
            color = (0, 255, 0) if index == current_box else (255, 255, 255)
            thickness = 3 if index == current_box else 1
            cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)
            cv2.putText(img, f'{index+1}', (x1+10, y1+30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

    # 메시지 출력
    msg_lines = []
    if not collecting:
        if start_collect_time is None:
            msg_lines.append("Press SPACE to start after 3s")
        else:
            remain = max(0, 3 - (time.time() - start_collect_time))
            msg_lines.append(f"Start after {int(remain)+1}s")
    else:
        if paused:
            msg_lines.append(f"Paused | Total {collected_count} saved")
        else:
            remain = max(0, save_interval - (time.time() - last_saved_time))
            msg_lines.append(f"Box {current_box+1} | Collecting {label}...")
            msg_lines.append(f"Saved: {per_box_count}/{per_box} | Next in {remain:.1f}s")

    y0 = 30
    dy = 30
    for i, line in enumerate(msg_lines):
        y = y0 + i * dy
        cv2.putText(img, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

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

# 저장
with open(seq_path, 'wb') as f:
    pickle.dump(data, f)
print(f"Saved seq: {collected_count}개")

all_labels = sorted(list(set([x[1] for x in data])))
testlabel2idx = {label: idx for idx, label in enumerate(all_labels)}
with open(label_path, 'wb') as f:
    pickle.dump(testlabel2idx, f)
