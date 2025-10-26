import React, { useState, useEffect } from 'react';
import { Activity, Settings, TrendingUp, Download, Cpu, Zap } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// Inline styles as a fallback
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #7e22ce 50%, #1e293b 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(168, 85, 247, 0.2)',
    padding: '24px'
  },
  headerContent: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  iconBox: {
    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    padding: '12px',
    borderRadius: '12px'
  },
  card: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(16px)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(168, 85, 247, 0.2)'
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s'
  },
  buttonPrimary: {
    background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
    color: 'white',
    boxShadow: '0 10px 25px rgba(168, 85, 247, 0.5)'
  },
  input: {
    width: '100%',
    background: '#1e293b',
    color: 'white',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px'
  },
  select: {
    width: '100%',
    background: '#1e293b',
    color: 'white',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px'
  }
};

export default function RobotMotionControl() {
  const [robotModels, setRobotModels] = useState([]);
  const [selectedRobot, setSelectedRobot] = useState(null);
  const [selectedJoints, setSelectedJoints] = useState([]);
  const [inputs, setInputs] = useState({});
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trainingSummary, setTrainingSummary] = useState([]);
  const [activeTab, setActiveTab] = useState('predict');

  useEffect(() => {
    const loadData = async () => {
      await fetchRobotModels();
      await fetchTrainingSummary();
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRobotModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/robot-models`);
      const data = await res.json();
      setRobotModels(data);
      if (data.length > 0) {
        setSelectedRobot(data[0]);
        setSelectedJoints(data[0].joints);
        initializeInputs(data[0].joints);
      }
    } catch (err) {
      console.error('Error fetching robot models:', err);
    }
  };

  const fetchTrainingSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/training-summary`);
      const data = await res.json();
      setTrainingSummary(data);
    } catch (err) {
      console.error('Error fetching training summary:', err);
    }
  };

  const initializeInputs = (joints) => {
    const newInputs = {};
    joints.forEach(j => {
      newInputs[j] = { position: 0, velocity: 0 };
    });
    setInputs(newInputs);
  };

  const handleRobotChange = (robotName) => {
    const robot = robotModels.find(r => r.name === robotName);
    setSelectedRobot(robot);
    setSelectedJoints(robot.joints);
    initializeInputs(robot.joints);
    setPredictions(null);
  };

  const handleJointToggle = (jointId) => {
    setSelectedJoints(prev => 
      prev.includes(jointId) 
        ? prev.filter(j => j !== jointId)
        : [...prev, jointId].sort((a, b) => a - b)
    );
  };

  const handleInputChange = (jointId, field, value) => {
    setInputs(prev => ({
      ...prev,
      [jointId]: { ...prev[jointId], [field]: parseFloat(value) || 0 }
    }));
  };

  const handlePredict = async () => {
    if (selectedJoints.length === 0) {
      alert('Please select at least one joint');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        robot_model: selectedRobot.name,
        joint_ids: selectedJoints,
        desired_positions: selectedJoints.map(j => inputs[j].position),
        desired_velocities: selectedJoints.map(j => inputs[j].velocity)
      };

      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setPredictions(data);
    } catch (err) {
      console.error('Error predicting:', err);
      alert('Prediction failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!predictions) return;
    
    const headers = ['Joint_ID', 'Desired_Position', 'Predicted_Position', 'Position_Deviation', 
                     'Desired_Velocity', 'Predicted_Velocity', 'Velocity_Deviation'];
    const rows = predictions.predictions.map(p => [
      p.joint_id,
      p.desired_position.toFixed(4),
      p.predicted_position.toFixed(4),
      p.position_deviation.toFixed(4),
      p.desired_velocity.toFixed(4),
      p.predicted_velocity.toFixed(4),
      p.velocity_deviation.toFixed(4)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Predicted_${selectedRobot.name}_Joint_Deviations.csv`;
    a.click();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.iconBox}>
            <Cpu size={32} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', margin: 0 }}>
              Robot Motion Control System
            </h1>
            <p style={{ color: '#d8b4fe', margin: 0 }}>AI-Powered Joint Position & Velocity Prediction</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('predict')}
            style={{
              ...styles.button,
              background: activeTab === 'predict' ? '#7c3aed' : 'rgba(255, 255, 255, 0.1)',
              color: 'white'
            }}
          >
            <Activity size={20} />
            Prediction
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              ...styles.button,
              background: activeTab === 'summary' ? '#7c3aed' : 'rgba(255, 255, 255, 0.1)',
              color: 'white'
            }}
          >
            <TrendingUp size={20} />
            Training Summary
          </button>
        </div>

        {activeTab === 'predict' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            {/* Input Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Robot Selection */}
              <div style={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Settings size={20} color="#c084fc" />
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Robot Model</h2>
                </div>
                <select
                  value={selectedRobot?.name || ''}
                  onChange={(e) => handleRobotChange(e.target.value)}
                  style={styles.select}
                >
                  {robotModels.map(robot => (
                    <option key={robot.name} value={robot.name}>
                      {robot.name} ({robot.joint_count} joints)
                    </option>
                  ))}
                </select>
              </div>

              {/* Joint Selection */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>
                  Select Joints
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedRobot?.joints.map(joint => (
                    <button
                      key={joint}
                      onClick={() => handleJointToggle(joint)}
                      style={{
                        ...styles.button,
                        padding: '8px 16px',
                        background: selectedJoints.includes(joint)
                          ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                          : '#475569',
                        color: 'white'
                      }}
                    >
                      J{joint}
                    </button>
                  ))}
                </div>
              </div>

              {/* Joint Inputs */}
              <div style={{ ...styles.card, maxHeight: '400px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>
                  Joint Parameters
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedJoints.map(joint => (
                    <div key={joint} style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ color: '#c084fc', fontWeight: 'bold', marginBottom: '12px' }}>Joint {joint}</div>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Position
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={inputs[joint]?.position || 0}
                          onChange={(e) => handleInputChange(joint, 'position', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Velocity
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={inputs[joint]?.velocity || 0}
                          onChange={(e) => handleInputChange(joint, 'velocity', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePredict}
                disabled={loading}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  width: '100%',
                  padding: '16px',
                  justifyContent: 'center',
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap size={20} />
                    Predict Motion
                  </>
                )}
              </button>
            </div>

            {/* Results Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {predictions ? (
                <>
                  {/* Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{
                      ...styles.card,
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)',
                      borderColor: 'rgba(59, 130, 246, 0.3)'
                    }}>
                      <div style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '4px' }}>Position Accuracy</div>
                      <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>
                        R² {predictions.metrics.r2_position.toFixed(4)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#60a5fa', marginTop: '4px' }}>
                        RMSE: {predictions.metrics.rmse_position.toFixed(4)}
                      </div>
                    </div>
                    <div style={{
                      ...styles.card,
                      background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(219, 39, 119, 0.2) 100%)',
                      borderColor: 'rgba(236, 72, 153, 0.3)'
                    }}>
                      <div style={{ fontSize: '14px', color: '#f9a8d4', marginBottom: '4px' }}>Velocity Accuracy</div>
                      <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>
                        R² {predictions.metrics.r2_velocity.toFixed(4)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#f472b6', marginTop: '4px' }}>
                        RMSE: {predictions.metrics.rmse_velocity.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* Graph */}
                  <div style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                        Deviation Analysis
                      </h3>
                      <button
                        onClick={downloadCSV}
                        style={{
                          ...styles.button,
                          background: '#16a34a',
                          color: 'white',
                          padding: '8px 16px'
                        }}
                      >
                        <Download size={16} />
                        Export CSV
                      </button>
                    </div>
                    <img 
                      src={`data:image/png;base64,${predictions.plot}`} 
                      alt="Deviation Plot"
                      style={{ width: '100%', borderRadius: '8px' }}
                    />
                  </div>

                  {/* Results Table */}
                  <div style={{ ...styles.card, overflowX: 'auto' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>
                      Detailed Results
                    </h3>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.3)' }}>
                          <th style={{ textAlign: 'left', color: '#d8b4fe', padding: '12px 8px' }}>Joint</th>
                          <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Des. Pos</th>
                          <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Pred. Pos</th>
                          <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Pos. Dev</th>
                          <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Des. Vel</th>
                          <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Pred. Vel</th>
                          <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Vel. Dev</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictions.predictions.map((pred, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.1)' }}>
                            <td style={{ color: 'white', fontWeight: 'bold', padding: '12px 8px' }}>{pred.joint_id}</td>
                            <td style={{ color: '#cbd5e1', textAlign: 'right', padding: '12px 8px' }}>
                              {pred.desired_position.toFixed(3)}
                            </td>
                            <td style={{ color: '#cbd5e1', textAlign: 'right', padding: '12px 8px' }}>
                              {pred.predicted_position.toFixed(3)}
                            </td>
                            <td style={{ color: '#60a5fa', textAlign: 'right', padding: '12px 8px' }}>
                              {pred.position_deviation.toFixed(3)}
                            </td>
                            <td style={{ color: '#cbd5e1', textAlign: 'right', padding: '12px 8px' }}>
                              {pred.desired_velocity.toFixed(3)}
                            </td>
                            <td style={{ color: '#cbd5e1', textAlign: 'right', padding: '12px 8px' }}>
                              {pred.predicted_velocity.toFixed(3)}
                            </td>
                            <td style={{ color: '#f472b6', textAlign: 'right', padding: '12px 8px' }}>
                              {pred.velocity_deviation.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{
                  ...styles.card,
                  textAlign: 'center',
                  padding: '48px',
                  background: 'rgba(255, 255, 255, 0.05)'
                }}>
                  <Activity size={64} color="#a855f7" style={{ opacity: 0.5, margin: '0 auto 16px' }} />
                  <p style={{ color: '#94a3b8', fontSize: '18px' }}>
                    Configure joints and click "Predict Motion" to see results
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '24px' }}>
              Model Training Summary
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <th style={{ textAlign: 'left', color: '#d8b4fe', padding: '12px 8px' }}>Robot Model</th>
                    <th style={{ textAlign: 'left', color: '#d8b4fe', padding: '12px 8px' }}>Joint</th>
                    <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Samples</th>
                    <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>R² Total</th>
                    <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>RMSE</th>
                    <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Avg Path Dev</th>
                    <th style={{ textAlign: 'right', color: '#d8b4fe', padding: '12px 8px' }}>Avg Vel Dev</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingSummary.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.1)' }}>
                      <td style={{ color: 'white', padding: '12px 8px' }}>{row.Robot_Model}</td>
                      <td style={{ color: '#c084fc', fontWeight: 'bold', padding: '12px 8px' }}>J{row.Joint_ID}</td>
                      <td style={{ color: '#cbd5e1', textAlign: 'right', padding: '12px 8px' }}>{row.Training_Samples}</td>
                      <td style={{ color: '#4ade80', textAlign: 'right', padding: '12px 8px' }}>
                        {row.R2_Total.toFixed(4)}
                      </td>
                      <td style={{ color: '#cbd5e1', textAlign: 'right', padding: '12px 8px' }}>
                        {row.RMSE_Total.toFixed(4)}
                      </td>
                      <td style={{ color: '#60a5fa', textAlign: 'right', padding: '12px 8px' }}>
                        {row.Avg_Path_Deviation.toFixed(4)}
                      </td>
                      <td style={{ color: '#f472b6', textAlign: 'right', padding: '12px 8px' }}>
                        {row.Avg_Velocity_Deviation.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}