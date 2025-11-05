// App.jsx
import React, { useState } from 'react';
import Upload from './Upload';
import './App.css';

export default function App(){
  const [reg, setReg] = useState('');
  const [session, setSession] = useState('FN');
  const [result, setResult] = useState(null);

  // Clean/sanitize values coming from the backend/Excel before rendering.
  // Treat empty strings, common stringified NaN/None/null values as missing.
  function sanitize(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (!s) return null;
    const low = s.toLowerCase();
    if (low === 'nan' || low === 'none' || low === 'null' || low === 'nan.0') return null;
    return s;
  }

  // Try to parse common date formats and return a Date object or null
  function parseDateString(s) {
    if (!s) return null;
    // If already a Date
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    // Try native parse first (ISO, etc.)
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;

    // Try patterns like DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const m = String(s).trim().match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})$/);
    if (m) {
      let day = parseInt(m[1], 10);
      let month = parseInt(m[2], 10) - 1;
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Could not parse
    return null;
  }

  // Parse dates coming from the backend. The excel worker stores dates as 'DD.MM.YYYY'.
  // Convert common formats (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD) to an ISO string.
  function parseBackendDate(val) {
    if (!val && val !== 0) return null;
    const s = String(val).trim();
    if (!s) return null;

    // If already ISO-like or parseable by Date, prefer that
    const isoAttempt = new Date(s);
    if (!isNaN(isoAttempt.getTime())) return isoAttempt.toISOString();

    // Handle dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})$/);
    if (m) {
      let day = parseInt(m[1], 10);
      let month = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000; // two-digit year -> 20xx
      const dt = new Date(year, month - 1, day);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }

    // Try parsing Excel serial numbers (e.g. 44954)
    if (/^\d+$/.test(s)) {
      try {
        const serial = Number(s);
        // Excel's epoch: 1899-12-30; Excel has a fake leap day at serial 60
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        let days = Math.floor(serial);
        if (serial > 60) days -= 1; // adjust for Excel leap bug
        const dt = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
        if (!isNaN(dt.getTime())) return dt.toISOString();
      } catch (err) {
        // fallthrough
      }
    }

    return null;
  }
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
      const res = await fetch(`/api/student?regno=${encodeURIComponent(reg.trim())}&session=${encodeURIComponent(session)}`);

      // Read content-type early so we can handle HTML (or other non-JSON) responses
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (res.status === 404) {
        // Specific user-facing message requested
        setErr('Hall is not allocated for you');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        // Try to parse JSON error body when available, otherwise fall back to text
        if (contentType.includes('application/json')) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error (${res.status})`);
        } else {
          const txt = await res.text().catch(() => '');
          // If backend returned HTML (common for 500 pages or static responses), surface a helpful message
          const short = txt ? (txt.slice(0, 300) + (txt.length > 300 ? '…' : '')) : '';
          throw new Error(short ? `Server returned non-JSON response (${res.status}): ${short}` : `Server error (${res.status})`);
        }
      }

      // For successful responses we still must ensure the body is JSON. If not, read text and report it.
      if (!contentType.includes('application/json')) {
        const txt = await res.text().catch(() => '');
        console.error('Expected JSON from /api/student but received:', txt);
        const short = txt ? (txt.slice(0, 300) + (txt.length > 300 ? '…' : '')) : '';
        throw new Error(short ? `Received non-JSON response from server: ${short}` : 'Received non-JSON response from server');
      }

      const data = await res.json();

      // Sanitize fields so UI won't display 'nan' or other placeholders from Excel
      const cleaned = {
        reg_no: sanitize(data.reg_no),
        seat_no: sanitize(data.seat_no),
        room: sanitize(data.room),
        course_code: sanitize(data.course_code),
        // Treat common placeholders like '-' as missing
        course_title: (function(){
          const t = sanitize(data.course_title);
          if (!t) return null;
          if (t === '-' || t === '—') return null;
          return t;
        })(),
        // Parse backend date formats into ISO string; if unparseable, set null so UI shows '—'
        date: (function(){
          const p = parseBackendDate(data.date);
          return p || null;
        })(),
        session: sanitize(data.session)
      };

      setResult(cleaned);
    } catch(e) {
      setErr('Unable to fetch seating details: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDateForDisplay(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '24px',
              borderBottom: '2px solid #1a237e',
              paddingBottom: '16px'
            }}>
              <h2 style={{
                color: '#1a237e',
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '16px'
              }}>Examinations Hall Seating Details</h2>
              <img src="https://miro.medium.com/v2/resize:fit:2400/1*aDT5b3T7zBUNALBRlikHjg.jpeg"
                alt="KGiSL Logo"
                style={{ 
                  height: '80px', 
                  marginBottom: '12px',
                  objectFit: 'contain'
                }} />
              <div style={{
                textAlign: 'center',
                marginBottom: '8px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  color: '#333',
                  fontWeight: 'bold',
                  marginBottom: '4px'
                }}>KGiSL Institute of Technology</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#666'
                }}>Affiliated to Anna University · Approved by AICTE</p>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '150px 1fr',
              gap: '24px',
              padding: '0 16px'
            }}>
              {/* Left column for photo */}
              <div>
                <div style={{
                  width: '150px',
                  height: '180px',
                  border: '2px solid #1a237e',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5'
                }}>
                  <span style={{color: '#666', fontSize: '14px'}}>Photo</span>
                </div>
              </div>

              {/* Right column for student details */}
              <div style={{
                display: 'grid',
                gap: '16px',
                fontSize: '15px'
              }}>
                
                <div style={{display: 'grid', gap: '16px', marginBottom: '20px'}}>
                  <div className="detail-row" style={{
                    display: 'flex',
                    gap: '32px'
                  }}>
                    <strong style={{color: '#1a237e', minWidth: '160px'}}>Register Number:</strong>
                    <span style={{
                      fontWeight: '500',
                      color: '#333',
                      flex: 1
                    }}>{result.reg_no}</span>
                  </div>
                  <div className="detail-row" style={{
                    display: 'flex',
                    gap: '32px'
                  }}>
                    <strong style={{color: '#1a237e', minWidth: '160px'}}>Seat Number:</strong>
                    <span style={{
                      fontWeight: '600',
                      color: '#1a237e',
                      flex: 1,
                      backgroundColor: '#e3f2fd',
                      padding: '4px 12px',
                      borderRadius: '4px'
                    }}>{
                      result.seat_no ? result.seat_no : 
                      (result.reg_no && result.room ? 
                        result.reg_no.slice(-2) : '—')
                    }</span>
                  </div>
                  <div className="detail-row" style={{
                    display: 'flex',
                    gap: '32px'
                  }}>
                    <strong style={{color: '#1a237e', minWidth: '160px'}}>Room / Hall:</strong>
                    <span style={{
                      fontWeight: '500',
                      color: '#333',
                      flex: 1
                    }}>{result.room || '103'}</span>
                  </div>
                </div>
                <div style={{marginBottom: '20px'}}>
                  <div style={{
                    color: '#1a237e',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginBottom: '12px'
                  }}>Course Information:</div>
                  <div style={{display: 'grid', gap: '16px'}}>
                    <div style={{
                      display: 'flex',
                      gap: '32px'
                    }}>
                      <strong style={{color: '#1a237e', minWidth: '160px'}}>Code:</strong>
                      <span style={{
                        fontWeight: '500',
                        color: '#333',
                        flex: 1
                      }}>{result.course_code || '—'}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '32px'
                    }}>
                      <strong style={{color: '#1a237e', minWidth: '160px'}}>Title:</strong>
                      <span style={{
                        fontWeight: '500',
                        color: '#333',
                        flex: 1
                      }}>{result.course_title || '—'}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  borderTop: '1px solid #e0e0e0',
                  paddingTop: '20px'
                }}>
                  <div style={{display: 'grid', gap: '16px'}}>
                    <div style={{
                      display: 'flex',
                      gap: '32px'
                    }}>
                      <strong style={{color: '#1a237e', minWidth: '160px'}}>Date:</strong>
                      <span style={{
                        fontWeight: '500',
                        color: '#333',
                        flex: 1,
                        backgroundColor: '#f5f5f5',
                        padding: '4px 12px',
                        borderRadius: '4px'
                      }}>{formatDateForDisplay(result.date)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '32px'
                    }}>
                      <strong style={{color: '#1a237e', minWidth: '160px'}}>Session:</strong>
                      <span style={{
                        fontWeight: '500',
                        color: '#333',
                        flex: 1,
                        backgroundColor: '#f5f5f5',
                        padding: '4px 12px',
                        borderRadius: '4px'
                      }}>{result.session === 'FN' ? 'Forenoon (FN)' : 
                         result.session === 'AN' ? 'Afternoon (AN)' : 
                         result.session || 'FN'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions Section */}
            <div style={{
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{
                color: '#1a237e',
                fontSize: '16px',
                marginBottom: '12px',
                fontWeight: 'bold'
              }}>Instructions:</h3>
              <ul style={{
                margin: 0,
                padding: '0 0 0 24px',
                fontSize: '14px',
                color: '#444',
                display: 'grid',
                gap: '8px'
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
