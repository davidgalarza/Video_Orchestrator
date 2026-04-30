import sqlite3
import os

db_path = os.path.join('backend', 'vid_gen.db')

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Table: projects ---")
    cursor.execute("PRAGMA table_info(projects)")
    for col in cursor.fetchall():
        print(col)
        
    print("\n--- Table: scenes ---")
    cursor.execute("PRAGMA table_info(scenes)")
    for col in cursor.fetchall():
        print(col)
        
    conn.close()
else:
    print("DB not found")
