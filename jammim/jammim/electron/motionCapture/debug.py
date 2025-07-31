import pickle

# 1. 시퀀스 데이터 및 라벨 리스트 확인
with open('/Users/hyeongjeongyi/madcamp/jammim_ui/jammim/jammim/electron/motionCapture/gesture_seq_data.pkl', 'rb') as f:
    data = pickle.load(f)

print(f"총 데이터 개수: {len(data)}")
# 데이터 샘플 출력 (첫 3개 정도)
for i, (seq, label) in enumerate(data[-3:], start=len(data)-3):
    print(f"데이터 {i} - label: {label}, sequence shape: {seq.shape}")

# 2. 라벨-인덱스 딕셔너리 확인
with open('/Users/hyeongjeongyi/madcamp/jammim_ui/jammim/jammim/electron/motionCapture/label2idx.pkl', 'rb') as f:
    label2idx = pickle.load(f)

print("label2idx 내용:", label2idx)
