// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import Upload from './Upload';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import './App.css';

export default function App(){
  const [reg, setReg] = useState('');
  const [session, setSession] = useState('FN');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const ticketRef = useRef(null);

  // Try to parse common date formats and return a Date object or null
  function parseDateString(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
    const m = String(s).trim().match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})$/);
    if (m) {
      let day = parseInt(m[1], 10);
      let month = parseInt(m[2], 10) - 1;
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  // Parse dates coming from the backend
  function parseBackendDate(val) {
    if (!val && val !== 0) return null;
    const s = String(val).trim();
    if (!s) return null;
    const isoAttempt = new Date(s);
    if (!isNaN(isoAttempt.getTime())) return isoAttempt.toISOString();
    const m = s.match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})$/);
    if (m) {
      let day = parseInt(m[1], 10);
      let month = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const dt = new Date(year, month - 1, day);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
    if (/^\d+$/.test(s)) {
      try {
        const serial = Number(s);
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        let days = Math.floor(serial);
        if (serial > 60) days -= 1;
        const dt = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
        if (!isNaN(dt.getTime())) return dt.toISOString();
      } catch (err) {
        // fallthrough
      }
    }
    return null;
  }

  // Generate QR code when result changes
  useEffect(() => {
    if (result) {
      const qrText = `Reg: ${result.reg_no}\nSeat: ${result.seat_no || result.reg_no?.slice(-2) || 'N/A'}\nRoom: ${result.room || '103'}\nDate: ${formatDateForDisplay(result.date)}\nSession: ${result.session || 'FN'}`;
      QRCode.toDataURL(qrText, { width: 120, margin: 1 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('QR code generation failed:', err));
    } else {
      setQrCodeDataUrl(null);
    }
  }, [result]);

  async function lookup(){
    setLoading(true);
    setShowSkeleton(true);
    setErr(null);
    setResult(null);
    setStudentPhoto(null);
    
    if(!reg) { 
      setErr('Please enter your Registration Number');
      setLoading(false);
      setShowSkeleton(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/student?regno=${encodeURIComponent(reg.trim())}&session=${encodeURIComponent(session)}`);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (res.status === 404) {
        setErr('Hall is not allocated for you');
        setLoading(false);
        setShowSkeleton(false);
        return;
      }

      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error (${res.status})`);
        } else {
          const txt = await res.text().catch(() => '');
          const short = txt ? (txt.slice(0, 300) + (txt.length > 300 ? '…' : '')) : '';
          throw new Error(short ? `Server returned non-JSON response (${res.status}): ${short}` : `Server error (${res.status})`);
        }
      }

      if (!contentType.includes('application/json')) {
        const txt = await res.text().catch(() => '');
        console.error('Expected JSON from /api/student but received:', txt);
        const short = txt ? (txt.slice(0, 300) + (txt.length > 300 ? '…' : '')) : '';
        throw new Error(short ? `Received non-JSON response from server: ${short}` : 'Received non-JSON response from server');
      }

      const data = await res.json();
      const cleaned = {
        reg_no: data.reg_no,
        seat_no: data.seat_no,
        room: data.room,
        course_code: data.course_code,
        course_title: (function(){
          const t = data.course_title;
          if (!t) return null;
          if (t === '-' || t === '—') return null;
          return t;
        })(),
        date: (function(){
          const p = parseBackendDate(data.date);
          return p || null;
        })(),
        session: data.session
      };

      setResult(cleaned);
    } catch(e) {
      setErr('Unable to fetch seating details: ' + e.message);
    } finally {
      setLoading(false);
      setShowSkeleton(false);
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

  function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStudentPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async function downloadAsImage() {
    if (!ticketRef.current) return;
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });
      const link = document.createElement('a');
      link.download = `Hall_Ticket_${result.reg_no}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to download image:', err);
      alert('Failed to download image. Please try again.');
    }
  }

  function shareViaEmail() {
    const subject = encodeURIComponent(`Hall Ticket - ${result.reg_no}`);
    const body = encodeURIComponent(
      `Hall Ticket Details:\n\n` +
      `Registration Number: ${result.reg_no}\n` +
      `Seat Number: ${result.seat_no || result.reg_no?.slice(-2) || 'N/A'}\n` +
      `Room/Hall: ${result.room || '103'}\n` +
      `Course Code: ${result.course_code || 'N/A'}\n` +
      `Date: ${formatDateForDisplay(result.date)}\n` +
      `Session: ${result.session === 'FN' ? 'Forenoon (FN)' : result.session === 'AN' ? 'Afternoon (AN)' : result.session || 'FN'}\n\n` +
      `Please find your hall ticket attached.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fb', paddingTop: '20px' }}>
      <div className="floating-icon small floating-icon--top-left" />
      <div className="floating-icon large floating-icon--bottom-right" />

      <div className="content-container">
        <header className="app-header">
          <div className="app-header-left">
            <div className="app-header-logo">
              <span>KITE</span>
            </div>
            <div>
              <div className="app-header-text-primary">KGiSL Institute of Technology</div>
              <div className="app-header-text-sub">
                Autonomous · Affiliated to Anna University · Approved by AICTE · NAAC &amp; NBA (CSE, ECE, IT)
              </div>
              <div className="app-header-badge">
                <span className="app-header-kite">Exam Seating</span>
                <span>Digital Hall Ticket Lookup</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="upload-btn"
            title="Admin – KITE upload portal"
          >
            <svg
              className="upload-kite-icon"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4l8-2 8 2-8 16z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M12 10v-4m0 0l-2 2m2-2l2 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="upload-kite-text">KITE</span>
          </button>

          <div className="app-header-orbit">
            <div className="app-header-orbit-inner" />
            <div className="app-header-orbit-dot" />
          </div>
        </header>

        <h2 style={{ color: '#0f172a', textAlign: 'center', marginTop: '4px', fontSize: '1.5rem', fontWeight: '600' }}>
          Hall seating — lookup by Registration No
        </h2>

        <div className="search-container">
          <input
            value={reg}
            onChange={e => setReg(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && !loading && lookup()}
            placeholder="Enter Registration Number"
            className="search-input"
          />
          <select
            value={session}
            onChange={e => setSession(e.target.value)}
            className="search-select"
          >
            <option value="FN">FN</option>
            <option value="AN">AN</option>
          </select>
          <button
            onClick={lookup}
            disabled={loading}
            className={`search-button btn ${loading ? 'btn-disabled' : 'btn-primary'}`}
          >
            {loading ? (
              <>
                <span className="spinner" /> Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {err && <div className="alert alert-error">{err}</div>}

        {showSkeleton && !result && (
          <div className="ticket-card ticket-card--skeleton">
            <div className="ticket-header-skeleton" />
            <div className="ticket-body-skeleton" />
          </div>
        )}

        {result && (
          <div
            ref={ticketRef}
            className="ticket-card"
            style={{
              marginTop: 20,
              padding: 30,
              borderRadius: 12,
              backgroundColor: '#ffffff',
              boxShadow: '0 22px 45px rgba(15, 23, 42, 0.16)',
              color: '#0f172a',
              maxWidth: '680px',
              margin: '20px auto',
              border: '1px solid rgba(191, 219, 254, 0.9)',
              animation: 'fadeUp 320ms ease-out',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '24px',
                borderBottom: '2px solid #1d4ed8',
                paddingBottom: '16px',
              }}
            >
              <h2
                style={{
                  color: '#1d4ed8',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                }}
              >
                Examinations Hall Seating Details
              </h2>
              <img
                src="https://miro.medium.com/v2/resize:fit:2400/1*aDT5b3T7zBUNALBRlikHjg.jpeg"
                alt="KGiSL Logo"
                style={{
                  height: '80px',
                  marginBottom: '12px',
                  objectFit: 'contain',
                }}
              />
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                <h3
                  style={{
                    fontSize: '20px',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                  }}
                >
                  KGiSL Institute of Technology
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#6b7280',
                  }}
                >
                  Affiliated to Anna University · Approved by AICTE
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                gap: '24px',
                padding: '0 16px',
              }}
            >
              {/* Left column for photo */}
              <div>
                <div
                  style={{
                    width: '160px',
                    height: '200px',
                    border: '2px solid #1d4ed8',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f9fafb',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {studentPhoto ? (
                    <img
                      src={studentPhoto}
                      alt="Student Photo"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px',
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="48"
                        height="48"
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center' }}>
                        Photo
                      </span>
                    </div>
                  )}
                  <label
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      backgroundColor: '#1d4ed8',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                {qrCodeDataUrl && (
                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      style={{
                        width: '120px',
                        height: '120px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '8px',
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Scan for details</span>
                  </div>
                )}
              </div>

              {/* Right column for student details */}
              <div
                style={{
                  display: 'grid',
                  gap: '16px',
                  fontSize: '15px',
                }}
              >
                <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                  <div
                    className="detail-row"
                    style={{
                      display: 'flex',
                      gap: '32px',
                    }}
                  >
                    <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                      Register Number:
                    </strong>
                    <span
                      style={{
                        fontWeight: '500',
                        color: '#0f172a',
                        flex: 1,
                      }}
                    >
                      {result.reg_no}
                    </span>
                  </div>
                  <div
                    className="detail-row"
                    style={{
                      display: 'flex',
                      gap: '32px',
                    }}
                  >
                    <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                      Seat Number:
                    </strong>
                    <span
                      style={{
                        fontWeight: '600',
                        color: '#1d4ed8',
                        flex: 1,
                        backgroundColor: '#e0ecff',
                        padding: '4px 12px',
                        borderRadius: '4px',
                      }}
                    >
                      {result.seat_no
                        ? result.seat_no
                        : result.reg_no && result.room
                        ? result.reg_no.slice(-2)
                        : '—'}
                    </span>
                  </div>
                  <div
                    className="detail-row"
                    style={{
                      display: 'flex',
                      gap: '32px',
                    }}
                  >
                    <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                      Room / Hall:
                    </strong>
                    <span
                      style={{
                        fontWeight: '500',
                        color: '#0f172a',
                        flex: 1,
                      }}
                    >
                      {result.room || '103'}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      color: '#1d4ed8',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      marginBottom: '12px',
                    }}
                  >
                    Course Information:
                  </div>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '32px',
                      }}
                    >
                      <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                        Code:
                      </strong>
                      <span
                        style={{
                          fontWeight: '500',
                          color: '#0f172a',
                          flex: 1,
                        }}
                      >
                        {result.course_code || '—'}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '32px',
                      }}
                    >
                      <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                        Title:
                      </strong>
                      <span
                        style={{
                          fontWeight: '500',
                          color: '#0f172a',
                          flex: 1,
                        }}
                      >
                        {result.course_title || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid rgba(209, 213, 219, 0.9)',
                    paddingTop: '20px',
                  }}
                >
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '32px',
                      }}
                    >
                      <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                        Date:
                      </strong>
                      <span
                        style={{
                          fontWeight: '500',
                          color: '#0f172a',
                          flex: 1,
                          backgroundColor: '#f3f4ff',
                          padding: '4px 12px',
                          borderRadius: '4px',
                        }}
                      >
                        {formatDateForDisplay(result.date)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '32px',
                      }}
                    >
                      <strong style={{ color: '#1d4ed8', minWidth: '160px' }}>
                        Session:
                      </strong>
                      <span
                        style={{
                          fontWeight: '500',
                          color: '#0f172a',
                          flex: 1,
                          backgroundColor: '#f3f4ff',
                          padding: '4px 12px',
                          borderRadius: '4px',
                        }}
                      >
                        {result.session === 'FN'
                          ? 'Forenoon (FN)'
                          : result.session === 'AN'
                          ? 'Afternoon (AN)'
                          : result.session || 'FN'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{
                marginTop: '24px',
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <button className="btn btn-primary" onClick={() => window.print()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print / PDF
              </button>
              <button className="btn btn-secondary" onClick={downloadAsImage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Download Image
              </button>
              <button className="btn btn-secondary" onClick={shareViaEmail}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email
              </button>
            </div>

            {/* Instructions Section */}
            <div
              style={{
                marginTop: '30px',
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid rgba(209, 213, 219, 0.9)',
              }}
            >
              <h3
                style={{
                  color: '#1d4ed8',
                  fontSize: '16px',
                  marginBottom: '12px',
                  fontWeight: 'bold',
                }}
              >
                Instructions:
              </h3>
              <ul
                style={{
                  margin: 0,
                  padding: '0 0 0 24px',
                  fontSize: '14px',
                  color: '#4b5563',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <li>Carry a valid photo ID proof.</li>
                <li>Report to the exam center 30 minutes before exam time.</li>
                <li>Electronic devices are not allowed in the exam hall.</li>
                <li>Keep this hall ticket safe and bring it to the examination center.</li>
              </ul>
            </div>
          </div>
        )}

        <Upload isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
      </div>
    </div>
  );
}
