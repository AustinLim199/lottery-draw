import sqlite3
from contextlib import contextmanager
import os
from pathlib import Path

# Get absolute path for database
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "lottery.db"

@contextmanager
def get_db():
    """Context manager for database connections."""
    os.makedirs(BASE_DIR, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize the database with required tables."""
    with get_db() as db:
        cursor = db.cursor()
        
        # Add draws table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS draws (
                id INTEGER PRIMARY KEY,
                count INTEGER DEFAULT 0
            )
        """)
        
        # Initialize draw count if not exists
        cursor.execute("SELECT count FROM draws WHERE id = 1")
        if not cursor.fetchone():
            cursor.execute("INSERT INTO draws (id, count) VALUES (1, 0)")
            
        # Create prize_status table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prize_status (
                type TEXT PRIMARY KEY,
                total INTEGER,
                remaining INTEGER
            )
        """)
        
        # Initialize prize counts if not exists
        cursor.execute("SELECT COUNT(*) FROM prize_status")
        if cursor.fetchone()[0] == 0:
            cursor.executemany(
                "INSERT OR IGNORE INTO prize_status (type, total, remaining) VALUES (?, ?, ?)",
                [
                    ("SMALL", 20, 20),
                    ("MEDIUM", 10, 10),
                    ("BIG", 5, 5)
                ]
            )
            
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS winners (
                participant_id INTEGER PRIMARY KEY,
                prize_type TEXT,
                draw_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'accepted' CHECK(status IN ('accepted', 'absent'))
            )
        """)
        
        # Create absent participants table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS absent_participants (
                participant_id INTEGER PRIMARY KEY,
                marked_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        db.commit()

def get_prize_status():
    """Get current prize status from database."""
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("SELECT type, total, remaining FROM prize_status")
        results = cursor.fetchall()
        
        status = {
            "currentType": get_current_prize_type(),
            "remaining": {},
            "total": {}
        }
        
        for prize_type, total, remaining in results:
            status["remaining"][prize_type.lower()] = remaining
            status["total"][prize_type.lower()] = total
            
        return status

def get_current_prize_type():
    """Get the current prize type based on remaining prizes."""
    with get_db() as db:
        cursor = db.cursor()
        # Check prizes in order: SMALL -> MEDIUM -> BIG
        for prize_type in ["SMALL", "MEDIUM", "BIG"]:
            cursor.execute(
                "SELECT remaining FROM prize_status WHERE type = ? AND remaining > 0",
                (prize_type,)
            )
            result = cursor.fetchone()
            if result and result[0] > 0:
                return prize_type
    return None

def get_winners():
    """Get list of previous winners."""
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("SELECT participant_id FROM winners")
        return {row[0] for row in cursor.fetchall()}

def record_winner(participant_id: int, prize_type: str):
    """Record a winner in the database."""
    with get_db() as db:
        cursor = db.cursor()
        try:
            # Record winner
            cursor.execute(
                "INSERT INTO winners (participant_id, prize_type) VALUES (?, ?)",
                (participant_id, prize_type)
            )
            # Update prize count
            cursor.execute(
                "UPDATE prize_status SET remaining = remaining - 1 WHERE type = ?",
                (prize_type,)
            )
            db.commit()
        except sqlite3.Error as e:
            db.rollback()
            raise Exception(f"Database error: {str(e)}")

def reset_db():
    """Reset database to initial state."""
    with get_db() as db:
        cursor = db.cursor()
        try:
            # Clear winners table
            cursor.execute("DELETE FROM winners")
            
            # Clear absent participants
            cursor.execute("DELETE FROM absent_participants")
            
            # Reset prize counts
            cursor.execute("""
                UPDATE prize_status 
                SET remaining = CASE 
                    WHEN type = 'SMALL' THEN 20
                    WHEN type = 'MEDIUM' THEN 10
                    WHEN type = 'BIG' THEN 5
                END
            """)
            db.commit()
        except sqlite3.Error as e:
            db.rollback()
            raise Exception(f"Database error during reset: {str(e)}")

def get_draw_count():
    """Get current draw count."""
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("SELECT count FROM draws WHERE id = 1")
        result = cursor.fetchone()
        return result[0] if result else 0

def increment_draw_count():
    """Increment and return new draw count."""
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("UPDATE draws SET count = count + 1 WHERE id = 1")
        cursor.execute("SELECT count FROM draws WHERE id = 1")
        db.commit()
        return cursor.fetchone()[0]

def reset_draw_count():
    """Reset draw count to 0."""
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("UPDATE draws SET count = 0 WHERE id = 1")
        db.commit()

def mark_participant_absent(participant_id: int):
    """Mark a participant as absent."""
    with get_db() as db:
        cursor = db.cursor()
        try:
            cursor.execute(
                "INSERT INTO absent_participants (participant_id) VALUES (?)",
                (participant_id,)
            )
            db.commit()
        except sqlite3.Error as e:
            db.rollback()
            raise Exception(f"Database error: {str(e)}")

def get_absent_participants():
    """Get list of absent participants."""
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute("SELECT participant_id FROM absent_participants")
        return {row[0] for row in cursor.fetchall()}