import numpy as np
import pickle
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# 데이터 로딩
with open('gesture_seq_data.pkl', 'rb') as f:
    data = pickle.load(f)
X = np.array([x[0] for x in data])
y = np.array([x[1] for x in data])

# 라벨 인코딩
classes = sorted(list(set(y)))
label2idx = {label: idx for idx, label in enumerate(classes)}
y_encoded = np.array([label2idx[label] for label in y])
X = X.reshape(-1, 15, 63)

X_train, X_val, y_train, y_val = train_test_split(X, y_encoded, test_size=0.2, stratify=y_encoded)
y_train_cat = to_categorical(y_train, num_classes=len(classes))
y_val_cat = to_categorical(y_val, num_classes=len(classes))

# LSTM 모델 정의 및 학습
model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(15, 63)),
    Dropout(0.3),
    LSTM(32),
    Dense(32, activation='relu'),
    Dense(len(classes), activation='softmax'),
])
model.compile(loss='categorical_crossentropy', optimizer='adam', metrics=['accuracy'])
model.fit(X_train, y_train_cat, epochs=30, validation_data=(X_val, y_val_cat), batch_size=32)
model.save('gesture_lstm_model.keras')
