from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# Global variables to store models and data
models = {}
data = None
robot_models = []
summary_df = None

def train_models():
    """Train all models on startup"""
    global models, data, robot_models, summary_df
    
    url = "https://raw.githubusercontent.com/cr1825/ai-project-data-sheet/main/EdgeAI_Robot_Motion_Control_Dataset.csv"
    data = pd.read_csv(url)
    
    # Check if Robot_Model column exists
    has_robot_model = "Robot_Model" in data.columns
    
    if has_robot_model:
        robot_models = sorted(data["Robot_Model"].unique())
    else:
        data["Robot_Model"] = "Universal"
        robot_models = ["Universal"]
    
    results = []
    
    for robot_model in robot_models:
        robot_data = data[data["Robot_Model"] == robot_model]
        joint_ids = sorted(robot_data["Joint_ID"].unique())
        
        for jid in joint_ids:
            joint_data = robot_data[robot_data["Joint_ID"] == jid]
            
            X = joint_data[["Desired_Position", "Desired_Velocity"]]
            y = joint_data[["Actual_Position", "Actual_Velocity"]]
            
            rf = RandomForestRegressor(
                n_estimators=300, max_depth=25, random_state=42, n_jobs=-1
            )
            rf.fit(X, y)
            
            model_key = (robot_model, jid)
            models[model_key] = rf
            
            y_pred = rf.predict(X)
            r2_total = r2_score(y, y_pred)
            rmse_total = np.sqrt(mean_squared_error(y, y_pred))
            avg_path_dev = np.mean(np.abs(y["Actual_Position"] - y_pred[:, 0]))
            avg_vel_dev = np.mean(np.abs(y["Actual_Velocity"] - y_pred[:, 1]))
            
            results.append({
                "Robot_Model": robot_model,
                "Joint_ID": jid,
                "Training_Samples": len(joint_data),
                "R2_Total": r2_total,
                "RMSE_Total": rmse_total,
                "Avg_Path_Deviation": avg_path_dev,
                "Avg_Velocity_Deviation": avg_vel_dev
            })
    
    summary_df = pd.DataFrame(results)
    print("✅ Models trained successfully!")

@app.route('/api/robot-models', methods=['GET'])
def get_robot_models():
    """Get available robot models and their joints"""
    models_info = []
    for robot_model in robot_models:
        robot_data = data[data["Robot_Model"] == robot_model]
        joints = sorted(robot_data["Joint_ID"].unique().tolist())
        models_info.append({
            "name": robot_model,
            "joints": joints,
            "joint_count": len(joints)
        })
    return jsonify(models_info)

@app.route('/api/training-summary', methods=['GET'])
def get_training_summary():
    """Get training summary for all models"""
    return jsonify(summary_df.to_dict(orient='records'))

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predict joint positions and velocities"""
    try:
        payload = request.json
        robot_model = payload['robot_model']
        joint_ids = payload['joint_ids']
        desired_positions = payload['desired_positions']
        desired_velocities = payload['desired_velocities']
        
        if len(joint_ids) != len(desired_positions) or len(joint_ids) != len(desired_velocities):
            return jsonify({"error": "Mismatched input lengths"}), 400
        
        preds = []
        pred_pos = []
        pred_vel = []
        
        for i, jid in enumerate(joint_ids):
            model_key = (robot_model, jid)
            model = models.get(model_key)
            
            if model is None:
                return jsonify({"error": f"Model for {robot_model} - Joint {jid} not found"}), 404
            
            input_data = pd.DataFrame({
                "Desired_Position": [desired_positions[i]],
                "Desired_Velocity": [desired_velocities[i]]
            })
            predicted = model.predict(input_data)
            actual_pos, actual_vel = predicted[0]
            
            pos_dev = abs(desired_positions[i] - actual_pos)
            vel_dev = abs(desired_velocities[i] - actual_vel)
            
            preds.append({
                "joint_id": f"J{jid}",
                "desired_position": float(desired_positions[i]),
                "predicted_position": float(actual_pos),
                "position_deviation": float(pos_dev),
                "desired_velocity": float(desired_velocities[i]),
                "predicted_velocity": float(actual_vel),
                "velocity_deviation": float(vel_dev)
            })
            pred_pos.append(actual_pos)
            pred_vel.append(actual_vel)
        
        # Calculate overall metrics (handle single joint case)
        if len(joint_ids) >= 2:
            r2_pos = r2_score(desired_positions, pred_pos)
            r2_vel = r2_score(desired_velocities, pred_vel)
            rmse_pos = np.sqrt(mean_squared_error(desired_positions, pred_pos))
            rmse_vel = np.sqrt(mean_squared_error(desired_velocities, pred_vel))
        else:
            # For single joint, use deviation as a metric
            r2_pos = 1.0 - (abs(desired_positions[0] - pred_pos[0]) / (abs(desired_positions[0]) + 1e-8))
            r2_vel = 1.0 - (abs(desired_velocities[0] - pred_vel[0]) / (abs(desired_velocities[0]) + 1e-8))
            rmse_pos = abs(desired_positions[0] - pred_pos[0])
            rmse_vel = abs(desired_velocities[0] - pred_vel[0])
        
        # Generate plot
        plt.figure(figsize=(12, 5))
        x_pos = np.arange(len(preds))
        width = 0.35
        
        pos_devs = [p['position_deviation'] for p in preds]
        vel_devs = [p['velocity_deviation'] for p in preds]
        labels = [p['joint_id'] for p in preds]
        
        plt.bar(x_pos - width/2, pos_devs, width, 
                alpha=0.8, label="Position Deviation", color='steelblue')
        plt.bar(x_pos + width/2, vel_devs, width,
                alpha=0.8, label="Velocity Deviation", color='coral')
        
        plt.title(f"Predicted Deviation per Joint - {robot_model}", 
                  fontsize=14, fontweight='bold')
        plt.xlabel("Joint ID", fontsize=12)
        plt.ylabel("Deviation", fontsize=12)
        plt.xticks(x_pos, labels)
        plt.legend()
        plt.grid(axis='y', alpha=0.3)
        plt.tight_layout()
        
        # Convert plot to base64
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        
        return jsonify({
            "predictions": preds,
            "metrics": {
                "r2_position": float(r2_pos),
                "r2_velocity": float(r2_vel),
                "rmse_position": float(rmse_pos),
                "rmse_velocity": float(rmse_vel)
            },
            "plot": img_base64
        })
        
    except Exception as e:
        print(f"Error in prediction: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Training models...")
    train_models()
    print("🌐 Starting Flask server...")
    app.run(debug=True, port=5000)