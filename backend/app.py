from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error

app = Flask(__name__)
CORS(app)

# ===========================
# 1️⃣ Load Dataset and Train Models
# ===========================
url = "https://raw.githubusercontent.com/cr1825/ai-project-data-sheet/main/EdgeAI_Robot_Motion_Control_Dataset.csv"
data = pd.read_csv(url)

required_cols = ["Joint_ID", "Desired_Position", "Desired_Velocity", 
                 "Actual_Position", "Actual_Velocity"]

if "Robot_Model" not in data.columns:
    data["Robot_Model"] = "Universal"

robot_models = sorted(data["Robot_Model"].unique())
models = {}

for robot_model in robot_models:
    robot_data = data[data["Robot_Model"] == robot_model]
    joint_ids = sorted(robot_data["Joint_ID"].unique())

    for jid in joint_ids:
        joint_data = robot_data[robot_data["Joint_ID"] == jid]
        X = joint_data[["Desired_Position", "Desired_Velocity"]]
        y = joint_data[["Actual_Position", "Actual_Velocity"]]
        
        rf = RandomForestRegressor(n_estimators=300, max_depth=25, random_state=42, n_jobs=-1)
        rf.fit(X, y)
        models[(robot_model, jid)] = rf


# ===========================
# 2️⃣ API Endpoints
# ===========================

@app.route("/get_models", methods=["GET"])
def get_models():
    model_info = {}
    for robot_model in robot_models:
        model_data = data[data["Robot_Model"] == robot_model]
        model_info[robot_model] = model_data["Joint_ID"].unique().tolist()  # convert to Python list of int
    return jsonify(model_info)


@app.route("/predict", methods=["POST"])
def predict():
    req = request.get_json()
    robot_model = req["robot_model"]
    joint_ids = req["joint_ids"]
    desired_positions = req["desired_positions"]
    desired_velocities = req["desired_velocities"]

    preds, pred_pos, pred_vel = [], [], []

    for i, jid in enumerate(joint_ids):
        model_key = (robot_model, jid)
        model = models.get(model_key)

        input_data = pd.DataFrame({
            "Desired_Position": [desired_positions[i]],
            "Desired_Velocity": [desired_velocities[i]]
        })
        predicted = model.predict(input_data)
        actual_pos, actual_vel = predicted[0]
        preds.append({
            "Joint_ID": jid,
            "Pred_Actual_Position": actual_pos,
            "Pred_Actual_Velocity": actual_vel,
            "Position_Deviation": abs(desired_positions[i] - actual_pos),
            "Velocity_Deviation": abs(desired_velocities[i] - actual_vel)
        })
        pred_pos.append(actual_pos)
        pred_vel.append(actual_vel)

    r2_pos = r2_score(desired_positions, pred_pos)
    r2_vel = r2_score(desired_velocities, pred_vel)
    rmse_pos = np.sqrt(mean_squared_error(desired_positions, pred_pos))
    rmse_vel = np.sqrt(mean_squared_error(desired_velocities, pred_vel))

    return jsonify({
        "predictions": preds,
        "r2_pos": r2_pos,
        "r2_vel": r2_vel,
        "rmse_pos": rmse_pos,
        "rmse_vel": rmse_vel
    })


@app.route("/", methods=["GET"])
def home():
    return "Robot Motion Control Backend is running successfully 🚀"


if __name__ == "__main__":
    app.run(debug=True)
