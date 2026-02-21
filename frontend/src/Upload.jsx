import React, { useState, useEffect } from 'react';

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
        console.log(`Frontend: Attempting login for Username: ${username}, Password: ${password}`);
        try {
            const res = await fetch('/api/admin/login', {
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
            } else {
                throw new Error(data.error || 'Login failed');
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
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({ error: 'Upload failed with non-JSON response' }));
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
            const res = await fetch(`/api/admin/seating?username=${username}&password=${password}`);
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
            const res = await fetch('/api/admin/seating', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reg_no, date, session, username, password })
            });

            if (!res.ok) throw new Error('Failed to delete record');
            
            setMessage({ type: 'success', text: 'Record deleted successfully' });
            loadSeatingData(); // Refresh data after deletion
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        }
    };
    
    useEffect(() => {
        if (isLoggedIn) {
            loadSeatingData();
        }
    }, [isLoggedIn]);

    if (!isOpen) return null;

    return (
        <div className="admin-modal">
            <div className="admin-panel">
                <div className="admin-panel-header">
                    <h3>Admin Panel</h3>
                    <button onClick={onClose} className="btn btn-plain">&times;</button>
                </div>

                {!isLoggedIn ? (
                    <div className="admin-form">
                        <h4>Admin Login</h4>
                        <input 
                            type="text" 
                            placeholder="Username" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            className="admin-input" 
                        />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="admin-input" 
                        />
                        <button 
                            onClick={handleLogin} 
                            className="btn btn-primary"
                        >
                            Login
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="admin-welcome">
                            <p>Welcome, {username}!</p>
                            <button onClick={() => setIsLoggedIn(false)} className="btn btn-secondary">Logout</button>
                        </div>
                        <div className="admin-upload">
                            <h4>Upload Excel File</h4>
                            <input 
                                type="text" 
                                placeholder="Optional date override (DD.MM.YYYY)" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="admin-input" 
                            />
                            <div className="admin-upload-row">
                                <input 
                                    type="file" 
                                    onChange={handleFileChange} 
                                    accept=".xlsx,.xls" 
                                    className="admin-file-input" 
                                />
                                <button 
                                    onClick={handleUpload} 
                                    disabled={uploading}
                                    className={"btn " + (uploading ? 'btn-disabled' : 'btn-primary')}
                                >
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <div className="admin-data-header">
                                <h4>Seating Arrangements</h4>
                                <button className="btn btn-primary" onClick={loadSeatingData}>Refresh Data</button>
                            </div>

                            {showData && (
                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Reg No</th>
                                                <th>Course Code</th>
                                                <th>Course Title</th>
                                                <th>Room</th>
                                                <th>Seat No</th>
                                                <th>Date</th>
                                                <th>Session</th>
                                                <th>Action</th>
                                                <th>Debug</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seatingData.map((row, index) => (
                                                <tr key={index}>
                                                    <td>{row.reg_no}</td>
                                                    <td>{row.course_code || '—'}</td>
                                                    <td>{row.course_title || '—'}</td>
                                                    <td>{row.room || '103'}</td>
                                                    <td>{row.seat_no ? row.seat_no : (row.reg_no && row.room ? row.reg_no.slice(-2) : '—')}</td>
                                                    <td>{row.date || '—'}</td>
                                                    <td>{row.session || 'FN'}</td>
                                                    <td>
                                                        <button className="btn btn-danger" onClick={() => handleDelete(row.reg_no, row.date, row.session)}>Delete</button>
                                                    </td>
                                                    <td>
                                                        <button className="btn btn-primary" onClick={async () => {
                                                            try {
                                                                const res = await fetch(
                                                                    `/api/admin/debug/student/${row.reg_no}?username=${username}&password=${password}`
                                                                );
                                                                const data = await res.json();
                                                                console.log('Raw DB record:', data);
                                                                alert(JSON.stringify(data, null, 2));
                                                            } catch (e) {
                                                                console.error('Debug error:', e);
                                                            }
                                                        }}>Debug</button>
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
