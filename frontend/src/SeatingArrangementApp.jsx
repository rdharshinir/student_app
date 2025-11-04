// App.jsx
import React, { useState } from 'react';
import Upload from './Upload';
import './App.css';

export default function App(){
  const [reg, setReg] = useState('');
  const [session, setSession] = useState('FN');
  const [date] = useState('25.10.2025');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function lookup(){
    setLoading(true);
    setErr(null);
    setResult(null);
    
    if(!reg) { 
      setErr('Please enter your Registration Number');
      setLoading(false);
      return;
    }
    
    try {
  const res = await fetch(`http://localhost:4000/api/student?regno=${encodeURIComponent(reg.trim())}&session=${encodeURIComponent(session)}`);
      
      if (res.status === 404) {
        setErr('No seating arrangement found for this registration number');
        setLoading(false);
        return;
      }
      
      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error || `Server error (${res.status})`);
      }
      
      const data = await res.json();
      setResult(data);
    } catch(e) {
      setErr('Unable to fetch seating details: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', paddingTop: '20px' }}>
      <div className="content-container">
        <div className="header" style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <img src="https://miro.medium.com/v2/resize:fit:2400/1*aDT5b3T7zBUNALBRlikHjg.jpeg" 
               alt="KGiSL Logo" 
               style={{ height: '60px', marginBottom: '10px' }} />
          <h1 style={{ 
            fontSize: '24px', 
            color: '#333', 
            marginBottom: '5px',
            fontWeight: 'bold' 
          }}>KGiSL Institute of Technology</h1>
          <p style={{ 
            fontSize: '14px', 
            color: '#666', 
            margin: '5px 0' 
          }}>(An Autonomous Institution)</p>
          <p style={{ 
            fontSize: '12px', 
            color: '#666', 
            margin: '5px 0',
            fontStyle: 'italic'
          }}>Affiliated to Anna University, Approved by AICTE, Recognized by UGC, Accredited by NAAC & NBA (B.E-CSE,B.E-ECE, B.Tech-IT)</p>
        </div>
        <div style={{position: 'absolute', top: 20, right: 20}}>
            <button onClick={() => setIsUploadModalOpen(true)} className="upload-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-upload-cloud">
                    <path d="M12 2a10 10 0 1 1-10 10" />
                    <path d="M12 18a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
                    <path d="M12 12v-6" />
                    <path d="M12 12l-3-3" />
                    <path d="M12 12l3-3" />
                </svg>
            </button>
        </div>
        <h2>Hall seating — lookup by Registration No</h2>
        <div className="search-container">
          <input 
            value={reg} 
            onChange={e=>setReg(e.target.value)} 
            placeholder="Enter Registration Number" 
            style={{
              padding: '12px 15px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '15px',
              width: '250px',
              marginRight: '10px'
            }}
          />
          <select 
            value={session} 
            onChange={e=>setSession(e.target.value)}
            style={{
              padding: '12px 15px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '15px',
              marginRight: '10px',
              backgroundColor: 'white'
            }}
          >
              <option value="FN">FN</option>
              <option value="AN">AN</option>
          </select>
          <button 
            onClick={lookup}
            disabled={loading}
            style={{
              padding: '12px 25px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: loading ? '#ccc' : '#1a237e',
              color: 'white',
              fontSize: '15px',
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {err && (
          <div style={{
            color: '#d32f2f',
            marginTop: '15px',
            padding: '10px 15px',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {err}
          </div>
        )}
        {result && (
          <div style={{
            marginTop: 20,
            padding: 30,
            borderRadius: 8,
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            color: '#333',
            maxWidth: '600px',
            margin: '20px auto',
            border: '1px solid #ddd'
          }}>
            <h2 style={{
              textAlign: 'center',
              color: '#1a237e',
              marginBottom: '20px',
              fontSize: '20px'
            }}>Examinations Hall Seating Details</h2>
            <img src="https://miro.medium.com/v2/resize:fit:2400/1*aDT5b3T7zBUNALBRlikHjg.jpeg" 
                alt="KGiSL Logo" 
                style={{ height: '60px', marginBottom: '10px' }} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: '150px 1fr',
              gap: '20px'
            }}>
              {/* Left column for photo */}
              <div>
                <div style={{
                  width: '150px',
                  height: '180px',
                  border: '1px solid #ddd',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <span style={{color: '#999', fontSize: '12px'}}>Photo</span>
                </div>
              </div>

              {/* Right column for student details */}
              <div style={{
                display: 'grid',
                gap: '12px',
                fontSize: '15px'
              }}>
                
                <div style={{textAlign: 'center', paddingBottom: '8px'}}>
                  <div style={{fontWeight: 700, color: '#222'}}>KGiSL Institute of Technology</div>
                  <div style={{fontSize: '12px', color: '#666'}}>Affiliated to Anna University · Approved by AICTE</div>
                </div>
                
                <div className="detail-row" style={{
                  borderBottom: '1px solid #eee',
                  paddingBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <strong style={{color: '#1a237e', width: '140px'}}>Register Number:</strong>
                  <span>{result.reg_no}</span>
                </div>
                <div className="detail-row" style={{
                  borderBottom: '1px solid #eee',
                  paddingBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <strong style={{color: '#1a237e', width: '140px'}}>Seat Number:</strong>
                  <span>{result.seat_no ?? '—'}</span>
                </div>
                <div className="detail-row" style={{
                  borderBottom: '1px solid #eee',
                  paddingBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <strong style={{color: '#1a237e', width: '140px'}}>Room / Hall:</strong>
                  <span>{result.room ?? '—'}</span>
                </div>
                <div style={{
                  borderBottom: '1px solid #eee',
                  paddingBottom: '12px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    marginBottom: '4px',
                    color: '#1a237e',
                    fontWeight: 'bold'
                  }}>Course Information:</div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <strong style={{color: '#444', minWidth: '100px'}}>Code:</strong>
                      <span>{result.course_code ?? '—'}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <strong style={{color: '#444', minWidth: '100px'}}>Title:</strong>
                      <span style={{flex: 1}}>{result.course_title ?? '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="detail-row" style={{
                  borderBottom: '1px solid #eee',
                  paddingBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <strong style={{color: '#1a237e', width: '140px'}}>Date:</strong>
                  <span>{result.date}</span>
                </div>
                <div className="detail-row" style={{
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <strong style={{color: '#1a237e', width: '140px'}}>Session:</strong>
                  <span>{result.session}</span>
                </div>
              </div>
            </div>

            {/* Instructions Section */}
            <div style={{
              marginTop: '30px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <h3 style={{
                color: '#1a237e',
                fontSize: '16px',
                marginBottom: '10px'
              }}>Instructions:</h3>
              <ul style={{
                margin: 0,
                padding: '0 0 0 20px',
                fontSize: '14px',
                color: '#555'
              }}>
                <li>Carry a valid photo ID proof</li>
                <li>Report to the exam center 30 minutes before exam time</li>
                <li>Electronic devices are not allowed in the exam hall</li>
              </ul>
            </div>

          </div>
        )}
        <Upload isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
      </div>
    </div>
  );
}
