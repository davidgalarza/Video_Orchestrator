import sqlite3
import os

db_path = os.path.join('backend', 'vid_gen.db')

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(projects)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'model' not in columns:
            print("Adding 'model' column to 'projects' table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN model TEXT DEFAULT 'veo-3.1-generate-preview'")
            conn.commit()
            print("Migration successful.")
        cursor.execute("PRAGMA table_info(assets)")
        asset_columns = [column[1] for column in cursor.fetchall()]
        if 'file_data' not in asset_columns:
            print("Adding 'file_data' column to 'assets' table...")
            cursor.execute("ALTER TABLE assets ADD COLUMN file_data BLOB")
            conn.commit()
            
        conn.close()
    except Exception as e:
        print(f"Error during migration: {e}")
else:
    print(f"Database file not found at {db_path}")
