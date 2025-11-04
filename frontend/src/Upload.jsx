import React, { useState } from 'react';

export default function Upload({ isOpen, onClose }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [date, setDate] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [seatingData, setSeatingData] = useState([]);
    const [showData, setShowData] = useState(false);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleLogin = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Login failed');
            }

            const data = await res.json();
            if (data.success) {
                setIsLoggedIn(true);
                setMessage({ type: 'success', text: 'Login successful' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage({ type: 'error', text: 'Please select a file to upload.' });
            return;
        }

        setUploading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('username', username);
        formData.append('password', password);
        if (date) formData.append('date', date);

        try {
            const res = await fetch('http://localhost:4000/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errBody = await res.json();
                throw new Error(errBody.error || `Upload failed`);
            }

            const body = await res.json();
            setMessage({ type: 'success', text: `File uploaded successfully. ${body.inserted || 0} records inserted.` });
            loadSeatingData(); // Refresh data after upload
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setUploading(false);
        }
    };

    const loadSeatingData = async () => {
        try {
            const res = await fetch(`http://localhost:4000/api/admin/seating?username=${username}&password=${password}`);
            if (!res.ok) throw new Error('Failed to load data');
            const data = await res.json();
            setSeatingData(data);
            setShowData(true);
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        }
    };

    const handleDelete = async (reg_no, date, session) => {
        try {
            const res = await fetch('http://localhost:4000/api/admin/seating', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, reg_no, date, session })
            });

            if (!res.ok) throw new Error('Failed to delete record');
            
            setMessage({ type: 'success', text: 'Record deleted successfully' });
            loadSeatingData(); // Refresh data after deletion
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
            justifyContent: 'center', alignItems: 'center', overflowY: 'auto'
        }}>
            <div style={{ 
                padding: 20, background: 'white', borderRadius: 5, 
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '90%', maxWidth: 800,
                margin: '20px 0'
            }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h3>Admin Panel</h3>
                    <button onClick={onClose} style={{background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
                </div>

                {!isLoggedIn ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, flexDirection: 'column' }}>
                        <input 
                            type="text" 
                            placeholder="Username" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            style={{ padding: 8 }} 
                        />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            style={{ padding: 8 }} 
                        />
                        <button 
                            onClick={handleLogin} 
                            style={{ padding: '8px 12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '4px' }}
                        >
                            Login
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexDirection: 'column' }}>
                            <h4>Upload Excel File</h4>
                            <input 
                                type="text" 
                                placeholder="Optional date override (DD.MM.YYYY)" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                style={{ padding: 8 }} 
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input 
                                    type="file" 
                                    onChange={handleFileChange} 
                                    accept=".xlsx,.xls" 
                                    style={{ flex: 1, padding: 8 }} 
                                />
                                <button 
                                    onClick={handleUpload} 
                                    disabled={uploading}
                                    style={{ 
                                        padding: '8px 12px',
                                        backgroundColor: uploading ? '#ccc' : '#1a237e',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px'
                                    }}
                                >
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4>Seating Arrangements</h4>
                                <button 
                                    onClick={loadSeatingData}
                                    style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#1a237e',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px'
                                    }}
                                >
                                    Refresh Data
                                </button>
                            </div>

                            {showData && (
                                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={tableHeaderStyle}>Reg No</th>
                                                <th style={tableHeaderStyle}>Course Code</th>
                                                <th style={tableHeaderStyle}>Course Title</th>
                                                <th style={tableHeaderStyle}>Room</th>
                                                <th style={tableHeaderStyle}>Seat No</th>
                                                <th style={tableHeaderStyle}>Date</th>
                                                <th style={tableHeaderStyle}>Session</th>
                                                <th style={tableHeaderStyle}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seatingData.map((row, index) => (
                                                <tr key={index}>
                                                    <td style={tableCellStyle}>{row.reg_no}</td>
                                                    <td style={tableCellStyle}>{row.course_code || '—'}</td>
                                                    <td style={tableCellStyle}>{row.course_title || '—'}</td>
                                                    <td style={tableCellStyle}>{row.room}</td>
                                                    <td style={tableCellStyle}>{row.seat_no}</td>
                                                    <td style={tableCellStyle}>{row.date}</td>
                                                    <td style={tableCellStyle}>{row.session}</td>
                                                    <td style={tableCellStyle}>
                                                        <button
                                                            onClick={() => handleDelete(row.reg_no, row.date, row.session)}
                                                            style={{
                                                                padding: '4px 8px',
                                                                backgroundColor: '#dc3545',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {message && (
                    <div style={{ 
                        color: message.type === 'error' ? 'crimson' : 'green', 
                        marginTop: 12,
                        padding: '8px',
                        backgroundColor: message.type === 'error' ? '#ffe6e6' : '#e6ffe6',
                        borderRadius: '4px'
                    }}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
}

const tableHeaderStyle = {
    padding: '8px',
    backgroundColor: '#1a237e',
    color: 'white',
    textAlign: 'left',
    borderBottom: '1px solid #ddd'
};

const tableCellStyle = {
    padding: '8px',
    borderBottom: '1px solid #ddd'
};
