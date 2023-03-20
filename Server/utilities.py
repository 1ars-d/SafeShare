import sqlite3
from string import ascii_uppercase
import random


def generate_unique_code(length):
    while True:
        code = ""
        for _ in range(length):
            code += random.choice(ascii_uppercase)
        if not room_exists(code):
            break
    return code


def room_exists(room):
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    exists = cur.execute(
        f'SELECT COUNT(1) FROM rooms WHERE code="{room}"').fetchone()[0] != 0
    conn.close()
    return exists


def is_date_past(date1, date2):
    return date1 > date2


def setup_db():
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    # Check if table rooms exists
    cur.execute(
        ''' SELECT count(name) FROM sqlite_master WHERE type='table' AND name='rooms' ''')
    if cur.fetchone()[0] != 1:
        cur.execute(
            'CREATE TABLE rooms (code TEXT, timestamp TEXT)')
        cur.execute(
            'CREATE TABLE messages (content TEXT, content_type TEXT, author TEXT, room TEXT, timestamp TEXT)')
        cur.execute(
            'CREATE TABLE logs (content TEXT, timestamp TEXT, room TEXT)')
        cur.execute(
            'CREATE TABLE files (data TEXT, file_type TEXT, file_name TEXT, author TEXT, room TEXT, timestamp TEXT)')
        cur.execute(
            'CREATE TABLE users (name TEXT, id integer primary key, room TEXT)')
    conn.commit()
    conn.close()


def check_rooms():
    pass
    """ conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    due_time = (datetime.datetime.now() -
                datetime.timedelta(seconds=60)).isoformat()
    cur.execute(f'SELECT code FROM rooms WHERE timestamp < "{due_time}"')
    results = cur.fetchall()
    for code in results:
        cur.execute(f'DELETE FROM rooms WHERE code="{code[0]}"')
        cur.execute(f'DELETE FROM messages WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM logs WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM files WHERE room="{code[0]}"')
        socketio.emit("room_closed", {}, to=code[0])
    conn.commit()
    conn.close() """
