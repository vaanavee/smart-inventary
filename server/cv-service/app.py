import sys
import os
import cv2
import torch
from flask import Flask, jsonify
from flask_cors import CORS
# from ultralytics import YOLO

# Add RT-DETRv2 to Python path so we can load the model
RT_DETR_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'RT-DETRv2', 'rtdetrv2_pytorch'))
sys.path.append(RT_DETR_PATH)

app = Flask(__name__)
CORS(app)

# Global variables for models
rt_detr_model = None
yolo_model = None
device = 'cuda' if torch.cuda.is_available() else 'cpu'

def load_models():
    global rt_detr_model, yolo_model
    
    weights_path = os.path.join(RT_DETR_PATH, 'rtdetrv2_r18vd.pth')
    if os.path.exists(weights_path):
        try:
            print(f"Loading RT-DETR model from {weights_path} onto {device}...")
            # rt_detr_model = torch.load(weights_path, map_location=device)
            rt_detr_model = "loaded"
            print("RT-DETR loaded successfully (simulation).")
        except Exception as e:
            print(f"Error loading RT-DETR: {e}")
    else:
        print(f"RT-DETR weights not found at {weights_path}")

    try:
        print("Loading YOLOv8n model...")
        # yolo_model = YOLO('yolov8n.pt')
        yolo_model = "loaded"
        print("YOLOv8 loaded successfully (simulation).")
    except Exception as e:
        print(f"Error loading YOLO: {e}")

RACK_ZONES = {
    'Room 1': ['A', 'B', 'C', 'D', 'E'],
    'Room 2': ['A', 'B', 'C', 'D', 'E'],
    'Room 3': ['A', 'B', 'C', 'D', 'E']
}

@app.route('/api/detect', methods=['GET'])
def detect():
    if rt_detr_model is None or yolo_model is None:
        return jsonify({"error": "Models not loaded"}), 500

    # Capture a frame from the IP Camera
    camera_url = "rtsp://admin:123456@192.168.29.14/stream1" # Using a generic RTSP stream path; adjust if your camera uses a different path
    cap = cv2.VideoCapture(camera_url)
    ret, frame = cap.read()
    
    if ret:
        print("Successfully captured frame from IP Camera.")
        # If the models were truly loaded, we would run inference here:
        # rt_detr_results = rt_detr_model(frame)
        # yolo_results = yolo_model(frame)
    else:
        print("Warning: Could not connect to the IP Camera or retrieve a frame.")
    
    cap.release()

    # The Node server expects an AI count for products. 
    # We say Room 2 Rack D has 12 items detected (Mismatch).
    detected_counts = []
    for room, racks in RACK_ZONES.items():
        for rack in racks:
            if room == 'Room 2' and rack == 'D':
                detected_counts.append({"room": room, "rack": rack, "count": 12})
            else:
                detected_counts.append({"room": room, "rack": rack, "count": None})

    # Now we simulate YOLO detecting people
    # We'll simulate YOLO detecting 1 person in Room 2.
    people_counts = {
        "Room 1": 0,
        "Room 2": 1,
        "Room 3": 0
    }

    return jsonify({
        "detections": detected_counts,
        "people_counts": people_counts
    })

if __name__ == '__main__':
    load_models()
    app.run(host='0.0.0.0', port=5000, debug=True)
