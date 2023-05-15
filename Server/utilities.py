import sys
import os

# Flask
from flask_socketio import emit

# Database
import base64
import datetime
import sqlite3

# Encryption
import hashlib

# Others
from string import ascii_uppercase
import random


def fetch_timestamp():
    return datetime.datetime.now().isoformat()


def hash_password(password):
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return (salt, key)


def get_db_connecton():
    conn = sqlite3.connect("ROOMS_db.sqlite")
    return (conn, conn.cursor())


def generate_unique_code(length):
    while True:
        code = ""
        for _ in range(length):
            code += random.choice(ascii_uppercase)
        if not room_exists(code):
            break
    return code


def room_exists(room):
    conn, cur = get_db_connecton()
    exists = cur.execute(
        f'SELECT COUNT(1) FROM rooms WHERE code="{room}"').fetchone()[0] != 0
    conn.close()
    return exists


def get_room_type(room):
    conn, cur = get_db_connecton()
    room_type = cur.execute(
        f'SELECT type FROM rooms WHERE code="{room}"').fetchone()[0]
    conn.close()
    return room_type


def check_room_password(room, password_to_check):
    conn, cur = get_db_connecton()
    room_data = cur.execute(
        f'SELECT key, salt FROM rooms WHERE code="{room}"').fetchone()
    conn.close()
    new_key = hashlib.pbkdf2_hmac(
        "sha256", password_to_check.encode("utf-8"), room_data[1], 100000)
    return new_key == room_data[0]


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
            'CREATE TABLE rooms (code TEXT, timestamp TEXT, type TEXT, key BINARY(128), salt BINARY(32))')
        cur.execute(
            'CREATE TABLE messages (content TEXT, content_type TEXT, author TEXT, room TEXT, timestamp TEXT)')
        cur.execute(
            'CREATE TABLE logs (content TEXT, timestamp TEXT, room TEXT)')
        cur.execute(
            'CREATE TABLE files (data TEXT, file_type TEXT, file_name TEXT, author TEXT, room TEXT, timestamp TEXT, id TEXT, file_size INTEGER)')
        cur.execute(
            'CREATE TABLE users (name TEXT, id integer primary key, room TEXT, has_connected TEXT)')
    conn.commit()
    conn.close()


def get_base64_size(base64_string):  # currently unused
    decoded = base64.b64decode(base64_string)
    size_in_bytes = sys.getsizeof(decoded)
    return size_in_bytes


def check_rooms(REMOVE_ROOM_AFTER):
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    due_time = (datetime.datetime.now() -
                datetime.timedelta(minutes=int(REMOVE_ROOM_AFTER))).isoformat()
    cur.execute(f'SELECT code FROM rooms WHERE timestamp < "{due_time}"')
    results = cur.fetchall()
    for code in results:
        cur.execute(f'DELETE FROM rooms WHERE code="{code[0]}"')
        cur.execute(f'DELETE FROM messages WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM logs WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM files WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM users WHERE room="{code[0]}"')
    conn.commit()
    conn.close()


# returns a list of messages and files sent in a room
# images are sent in a decreased resolution
# download id is passed for later download
# will already return in correct order
def get_history(room):
    conn, cur = get_db_connecton()
    history = []
    messages = cur.execute(
        f'SELECT content, content_type, author, room, timestamp FROM messages WHERE room="{room}"').fetchall()
    for message in messages:
        history.append(
            {"content": message[0], "content_type": message[1], "author": message[2], "timestamp": message[4], "type": "message"})
    files = cur.execute(
        f'SELECT data, file_type, file_name, author, room, timestamp, id, file_size FROM files WHERE room="{room}"').fetchall()
    for file in files:
        history.append({"content": "", "fileType": file[1],
                       "fileName": file[2], "timestamp": file[5], "type": "file", "author": file[3], "fileId": file[6],  "fileSize": file[7]})
    logs = cur.execute(
        f'SELECT content, timestamp FROM logs WHERE room="{room}"').fetchall()
    for log in logs:
        history.append({"type": "log", "content": log[0], "timestamp": log[1]})
    history.sort(key=lambda x: x["timestamp"])
    conn.close()
    return history


def send_log(log, room):
    timestamp = datetime.datetime.now().isoformat()
    conn, cur = get_db_connecton()
    cur.execute(
        "INSERT INTO logs(content, timestamp, room) VALUES(?,?,?)", (log, timestamp, room))
    conn.commit()
    conn.close()
    emit("log", {"log": log, "timestamp": timestamp}, to=room)


def get_room_timestamp(room):
    conn, cur = get_db_connecton()
    timestamp = cur.execute(
        f'SELECT timestamp FROM rooms WHERE code="{room}" ').fetchone()
    conn.close()
    return timestamp


# returns a list of all members in a room
def get_members(room):
    conn, cur = get_db_connecton()
    members = cur.execute(
        f'SELECT name FROM users WHERE room="{room}"').fetchall()
    conn.close()
    output_members = []
    for member in members:
        output_members.append(member[0])
    return output_members
