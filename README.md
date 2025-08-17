
---

# JAMMIM

**Just A Made Motion-capture-service In Madcamp**

A motion-capture–based **computer control program** built during **Madcamp**.
With JAMMIM, you can control your PC using only your hands through real-time gesture recognition.

---

## 💻 Team

* **Seunghoon Shim**

  * KAIST ’21, School of Computing
  * [GitHub](https://github.com/shsim23)

* **Hyunjung Yi**

  * Korea Univ. ’22, Business Administration
  * [GitHub](https://github.com/hyoungjungyi)

---

## 🎥 Demo

> Example usage videos are available in the notion page.
> https://knowing-raisin-243.notion.site/JAMMIM-244d736af537806cb91df6750f7b920a?source=copy_link 
> You can see gesture-based interactions such as clicking, swiping, zoom, and party mode.

---

## ✨ Core Features

* **Click**

  * Index finger → move cursor
  * Fist → mouse click

* **Volume Control**

  * Right hand: pinch (thumb + index), move up/down → volume up/down

* **Brightness Control**

  * Left hand: pinch (thumb + index), move up/down → brightness up/down

* **V Sign**

  * Launches camera

* **“12 o’clock” Pose**

  * Plays *Chungha – Gotta Go*

* **Zoom In / Out**

  * Spread both hands → fullscreen
  * Close both hands → ESC

* **Left Swipe**

  * Alt + Tab (window switch)

* **Party Mode**

  * Rock-and-roll gesture → Plays *Travis Scott – FE!N*

---

## 🛠️ Technical Structure

* **Motion Capture**: Hand landmarks & sequences captured with **MediaPipe** + **OpenCV**
* **Model Training**: **LSTM** trained on 15-frame sequences → generates gesture model + label index

  * Why LSTM? To handle **sequential motion recognition**
* **Real-time Gesture Recognition**: Detected gestures are mapped to system actions
* Works on **macOS and Windows**

---

## 📋 Gesture → Shortcut Mapping

| Gesture                  | Action     | Description                  |
| ------------------------ | ---------- | ---------------------------- |
| `left_swipe`             | Alt + Tab  | Switch desktop windows       |
| `thumbsup`               | Space      | Play/pause media             |
| `delete`                 | F12        | Chrome DevTools              |
| `erm`                    | Cursor     | Move mouse cursor            |
| `down_swipe / up_swipe`  | Volume     | Volume up/down               |
| `both_swipe`             | Fullscreen | Chrome fullscreen            |
| `zoom_out`               | ESC        | Exit fullscreen              |
| `v`                      | Photo      | Trigger Photo Booth (macOS)  |
| `spider`                 | Party Mode | FE!N playback + UI effect    |
| `right_turn / left_turn` | Brightness | Adjust brightness            |
| `clap`                   | Separator  | Marks start of gesture input |
| `paper`                  | Stop       | Ends continuous gesture mode |

---
