import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

function App() {
  const [models, setModels] = useState({});
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedJoints, setSelectedJoints] = useState([]);
  const [positions, setPositions] = useState([]);
  const [velocities, setVelocities] = useState([]);
  const [results, setResults] = useState(null);

  const backendURL = "http://127.0.0.1:5000";

  useEffect(() => {
    axios.get(`${backendURL}/get_models`)
      .then(res => setModels(res.data))
      .catch(err => {
        console.error("get_models failed:", err);
        setModels({});
      });
  }, []);

  const handlePredict = async () => {
    try {
      const res = await axios.post(`${backendURL}/predict`, {
        robot_model: selectedModel,
        joint_ids: selectedJoints.map(Number),
        desired_positions: positions.map(Number),
        desired_velocities: velocities.map(Number)
      });
      console.log("predict response:", res.data); // <-- debug
      setResults(res.data ?? null);
    } catch (err) {
      console.error("Predict request failed:", err);
      setResults(null);
    }
  };

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold mb-4 text-center">🤖 Robot Joint Prediction System</h1>

      {/* Select Robot Model */}
      <div className="mb-3">
        <label className="font-semibold">Select Robot Model:</label>
        <select onChange={(e) => setSelectedModel(e.target.value)} className="ml-2 p-2 border rounded">
          <option value="">-- Choose --</option>
          {Object.keys(models || {}).map(m => (  // <-- guard models
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Select Joints */}
      {selectedModel && (
        <div className="mb-3">
          <label className="font-semibold">Select Joints:</label>
          <select multiple onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, opt => opt.value);
            setSelectedJoints(selected);
            setPositions(selected.map(() => 0));
            setVelocities(selected.map(() => 0));
          }} className="ml-2 p-2 border rounded w-64 h-32">
            {models[selectedModel]?.map(j => (
              <option key={j} value={j}>Joint {j}</option>
            ))}
          </select>
        </div>
      )}

      {/* Input Desired Positions & Velocities */}
      {selectedJoints.length > 0 && (
        <div className="mb-4">
          {selectedJoints.map((jid, idx) => (
            <div key={jid} className="mb-2">
              <h4 className="font-semibold">Joint {jid}</h4>
              <input
                type="number"
                placeholder="Desired Position"
                className="p-2 border rounded mr-2"
                onChange={(e) => {
                  const newPositions = [...positions];
                  newPositions[idx] = e.target.value;
                  setPositions(newPositions);
                }}
              />
              <input
                type="number"
                placeholder="Desired Velocity"
                className="p-2 border rounded"
                onChange={(e) => {
                  const newVel = [...velocities];
                  newVel[idx] = e.target.value;
                  setVelocities(newVel);
                }}
              />
            </div>
          ))}
          <button onClick={handlePredict} className="mt-3 bg-blue-500 text-white px-4 py-2 rounded">
            Predict
          </button>
        </div>
      )}

      {/* Results */}
      {results && Array.isArray(results.predictions) && (
        <div>
          <h3 className="font-bold mt-5 text-lg">Prediction Results</h3>
          <table className="border mt-3 w-full">
            <thead>
              <tr>
                <th>Joint</th>
                <th>Predicted Position</th>
                <th>Predicted Velocity</th>
                <th>Position Deviation</th>
                <th>Velocity Deviation</th>
              </tr>
            </thead>
            <tbody>
              {results.predictions.map((p, i) => (
                <tr key={i}>
                  <td>{p.Joint_ID}</td>
                  <td>{Number(p.Pred_Actual_Position ?? 0).toFixed(4)}</td>
                  <td>{Number(p.Pred_Actual_Velocity ?? 0).toFixed(4)}</td>
                  <td>{Number(p.Position_Deviation ?? 0).toFixed(4)}</td>
                  <td>{Number(p.Velocity_Deviation ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5">
            <h4 className="font-semibold">Performance Summary:</h4>
            <p>R² Position: {Number(results.r2_pos ?? 0).toFixed(4)} | RMSE Position: {Number(results.rmse_pos ?? 0).toFixed(4)}</p>
            <p>R² Velocity: {Number(results.r2_vel ?? 0).toFixed(4)} | RMSE Velocity: {Number(results.rmse_vel ?? 0).toFixed(4)}</p>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={results.predictions}>
              <XAxis dataKey="Joint_ID" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Position_Deviation" fill="#8884d8" />
              <Bar dataKey="Velocity_Deviation" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Debug: show raw response so you can confirm shape */}
      {results && (
        <pre className="mt-4 text-sm bg-gray-100 p-2 rounded">{JSON.stringify(results, null, 2)}</pre>
      )}
    </div>
  );
}

export default App;
