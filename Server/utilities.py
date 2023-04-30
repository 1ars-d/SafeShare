import io
import sys
import os

# Flask
from flask_socketio import emit

# Database
import base64
import datetime
import sqlite3
from CONSTANTS import REMOVE_ROOM_AFTER

# Encryption
import hashlib

# Image Manipulation
from PIL import Image

# Others
from string import ascii_uppercase
import random


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
            'CREATE TABLE rooms (code TEXT, timestamp TEXT, type TEXT, key BINARY(128), salt BINARY(32))')
        cur.execute(
            'CREATE TABLE messages (content TEXT, content_type TEXT, author TEXT, room TEXT, timestamp TEXT)')
        cur.execute(
            'CREATE TABLE logs (content TEXT, timestamp TEXT, room TEXT)')
        cur.execute(
            'CREATE TABLE files (data TEXT, file_type TEXT, file_name TEXT, author TEXT, room TEXT, timestamp TEXT, id TEXT, width INTEGER, height INTEGER)')
        cur.execute(
            'CREATE TABLE users (name TEXT, id integer primary key, room TEXT)')
    conn.commit()
    conn.close()


def get_base64_size(base64_string):  # currently unused
    decoded = base64.b64decode(base64_string)
    size_in_bytes = sys.getsizeof(decoded)
    return size_in_bytes


def check_rooms():
    """ conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    due_time = (datetime.datetime.now() -
                datetime.timedelta(minutes=REMOVE_ROOM_AFTER)).isoformat()
    cur.execute(f'SELECT code FROM rooms WHERE timestamp < "{due_time}"')
    results = cur.fetchall()
    for code in results:
        cur.execute(f'DELETE FROM rooms WHERE code="{code[0]}"')
        cur.execute(f'DELETE FROM messages WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM logs WHERE room="{code[0]}"')
        cur.execute(f'DELETE FROM files WHERE room="{code[0]}"')
    conn.commit()
    conn.close() """
    pass


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
        f'SELECT data, file_type, file_name, author, room, timestamp, id, width, height FROM files WHERE room="{room}"').fetchall()
    for file in files:
        content = ""
        if (file[1].split("/")[0] == "image" and file[2].lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif'))):
            content = base64.b64encode(downscale_image(base64.b64decode(
                file[0].decode()), file[1].split("/")[1], .1).getvalue()).decode("utf-8")
        history.append({"content": content, "fileType": file[1],
                       "fileName": file[2], "timestamp": file[5], "type": "file", "author": file[3], "fileId": file[6],  "fileSize": get_base64_size(file[0]), "imageWidth": file[7], "imageHeight": file[8]})
    """ logs = cur.execute(
        f'SELECT content, timestamp, room FROM logs WHERE room="{room}"').fetchall()
    for log in logs:
        history.append({"content": log[0], "timestamp": log[1], "type": "log"}) """
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


# Downscale image to supply user with image preview
def downscale_image(image_data, format, factor):
    raw = Image.open(io.BytesIO(image_data))
    image_rescaled = raw.resize(
        (int(raw.size[0] * factor), int(raw.size[1] * factor)))
    buffered = io.BytesIO()
    image_rescaled.save(buffered, format=format)
    buffered.seek(0)
    return buffered


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


def get_image_dimensions(image_data):
    width = Image.open(io.BytesIO(image_data)).width
    height = Image.open(io.BytesIO(image_data)).height
    return (width, height)
