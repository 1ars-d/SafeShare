from flask import Flask, render_template, session, request, redirect, url_for
from flask_socketio import SocketIO, join_room, leave_room, send, emit
import datetime
import sqlite3
import time
from apscheduler.schedulers.background import BackgroundScheduler
import base64

from utilities import generate_unique_code, room_exists, setup_db

MAX_BUFFER_SIZE = 50 * 1000 * 1000  # 50 MB

# Server Setup
app = Flask(__name__)
app.config["SECRET_KEY"] = 'key!'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = MAX_BUFFER_SIZE
socketio = SocketIO(app, max_http_buffer_size=MAX_BUFFER_SIZE)

# DB Setup
setup_db()

# Delete old Rooms


def check_rooms():
    print("hello")
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


sched = BackgroundScheduler(daemon=True)
sched.add_job(check_rooms, 'interval', seconds=10)
sched.start()


@app.route("/", methods=["POST", "GET"])
def home():
    session.clear()
    if request.method == "POST":
        name = request.form.get("name", "")
        code = request.form.get("code", "")
        join = request.form.get("join", False)
        create = request.form.get("create", False)
        # name empty
        if not name:
            return render_template("home.html", error="Please enter a name.", code=code, name=name)
        # code empty
        if join != False and not code:
            return render_template("home.html", error="Please enter a room code.", code=code, name=name)
        room = code
        conn = sqlite3.connect("ROOMS_db.sqlite")
        cur = conn.cursor()
        # create was pressed
        if create != False:
            room = generate_unique_code(5)
            timestamp = datetime.datetime.now().isoformat()
            cur.execute(
                "INSERT INTO rooms(code, members, timestamp) VALUES(?,?,?)", (room, 0, timestamp))
            conn.commit()
            conn.close()
            print("Created a new room with code:", room)
        # Room doesn't exist
        elif not room_exists(room):
            return render_template("home.html", error="Room does not exist.", code=code, name=name)
        session["room"] = room
        session["name"] = name
        return redirect(url_for("room"))
    return render_template("home.html", name="", code="")


@app.route("/room")
def room():
    room = session.get("room")
    name = session.get("name")
    if not room_exists(room):
        return redirect(url_for("home"))
    timestamp = get_room_timestamp(room)
    history = get_history(room)
    return render_template("room.html", room=room, history=history, timestamp=timestamp, name=name)


@socketio.on("connect")
def connect(_):
    room = session.get("room")
    name = session.get("name")
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    if not room or not name:
        return
    if not room_exists(room):
        leave_room(room)
        return
    join_room(room)
    cur.execute(
        f'UPDATE rooms SET members = members + 1 WHERE code = "{room}"')
    conn.commit()
    conn.close()
    send_log(f"{name} joined the room.", room)
    print(f"{name} joined room {room}")


@socketio.on("disconnect")
def disconnect():
    room = session.get("room")
    name = session.get("name")
    leave_room(room)
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    cur.execute(
        f'UPDATE rooms SET members = members - 1 WHERE code = "{room}"')
    conn.commit()
    conn.close()
    send_log(f"{name} left the room.", room)
    print(f"{name} left the room {room}")


@socketio.on("message")
def message(data):
    room = session.get("room")
    name = session.get("name")
    if not room_exists(room):
        return
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    timestamp = datetime.datetime.now().isoformat()
    if data["type"] == "file":
        cur.execute(
            "INSERT INTO files(data, file_type, file_name, author, room, timestamp) VALUES(?,?,?,?,?,?)", (base64.b64encode(data["data"]), data["fileType"], data["fileName"], name, room, timestamp))
        conn.commit()
        emit("message", {"name": name, "data": data["data"],
                         "timestamp": timestamp, "type": "file", "fileType": data["fileType"], "fileName": data["fileName"]}, to=room)
    if data["type"] == "text":
        content = data["data"]
        cur.execute(
            "INSERT INTO messages(content, content_type, author, room, timestamp) VALUES(?,?,?,?,?)", (content, "text", name, room, timestamp))
        conn.commit()
        emit("message", {"name": name, "data": content,
                         "timestamp": timestamp, "type": "text"}, to=room)
    conn.close()


def send_log(log, room):
    timestamp = datetime.datetime.now().isoformat()
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO logs(content, timestamp, room) VALUES(?,?,?)", (log, timestamp, room))
    conn.commit()
    conn.close()
    emit("log", {"log": log, "timestamp": timestamp}, to=room)


def get_room_timestamp(room):
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    timestamp = cur.execute(
        f'SELECT timestamp FROM rooms WHERE code="{room}" ').fetchone()
    conn.close()
    return timestamp


def get_history(room):
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    history = []
    messages = cur.execute(
        f'SELECT content, content_type, author, room, timestamp FROM messages WHERE room="{room}"').fetchall()
    for message in messages:
        history.append(
            {"content": message[0], "content_type": message[1], "author": message[2], "timestamp": message[4], "type": "message"})
    files = cur.execute(
        f'SELECT data, file_type, file_name, author, room, timestamp FROM files WHERE room="{room}"').fetchall()
    for file in files:
        history.append({"content": file[0].decode("utf-8"), "fileType": file[1],
                       "fileName": file[2], "timestamp": file[5], "type": "file", "author": file[3]})
    logs = cur.execute(
        f'SELECT content, timestamp, room FROM logs WHERE room="{room}"').fetchall()
    for log in logs:
        history.append({"content": log[0], "timestamp": log[1], "type": "log"})
    history.sort(key=lambda x: x["timestamp"])
    conn.close()
    return history


if __name__ == "__main__":
    socketio.run(app, debug=True, host="192.168.178.57")
