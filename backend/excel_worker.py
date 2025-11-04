import sys
import json
import sqlite3
import pandas as pd
import os

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error':'usage: excel_worker.py <excel_path> <db_path>'}))
        return
        
    excel_path, db_path = sys.argv[1], sys.argv[2]
    # optional override date passed as third argument
    override_date = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Read Excel file
        df = pd.read_excel(excel_path)
        required_columns = ['reg_no', 'seat_no', 'room', 'course_code', 'course_title', 'session']
        
        # Check if required columns exist
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            print(json.dumps({'error': f'Missing required columns: {", ".join(missing_columns)}'}))
            return

        # Connect to database
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Ensure table exists
        cur.execute('''CREATE TABLE IF NOT EXISTS students (
            reg_no TEXT,
            seat_no TEXT,
            room TEXT, 
            course_code TEXT,
            course_title TEXT,
            date TEXT,
            session TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (reg_no, date, session)
        )''')

        # Insert data
        inserted = 0
        for _, row in df.iterrows():
            try:
                date = override_date if override_date else row.get('date', '25.10.2025')  # Default date if not provided
                cur.execute('''INSERT OR REPLACE INTO students 
                    (reg_no, seat_no, room, course_code, course_title, date, session)
                    VALUES (?, ?, ?, ?, ?, ?, ?)''',
                    (str(row['reg_no']), str(row['seat_no']), str(row['room']), 
                     str(row['course_code']), str(row['course_title']), 
                     date, str(row['session'])))
                inserted += 1
            except Exception as e:
                print(json.dumps({'error': f'Error inserting row {inserted + 1}: {str(e)}'}))
                continue

        conn.commit()
        conn.close()
        print(json.dumps({'inserted': inserted}))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    main()