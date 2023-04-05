from ctypes import create_string_buffer
import io
from flask import Flask, render_template, session, request, redirect, url_for, abort, send_file
from flask_socketio import SocketIO, join_room, leave_room, send, emit
from CONSTANTS import REMOVE_ROOM_AFTER, MAX_BUFFER_SIZE
import datetime
import sqlite3
from apscheduler.schedulers.background import BackgroundScheduler
import base64
import shortuuid
from skimage import data, color
from skimage.transform import rescale, resize, downscale_local_mean
import numpy as np
from PIL import Image
from utilities import generate_unique_code, room_exists, setup_db, check_rooms

# Server Setup
app = Flask(__name__)
app.config["SECRET_KEY"] = 'key!'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = MAX_BUFFER_SIZE
socketio = SocketIO(app, max_http_buffer_size=MAX_BUFFER_SIZE)

# DB Setup
setup_db()

# Setup deleting old rooms
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
                "INSERT INTO rooms(code, timestamp) VALUES(?,?)", (room, timestamp))
            conn.commit()
            print("Created a new room with code:", room)
        # Room doesn't exist
        elif not room_exists(room):
            return render_template("home.html", error="Room does not exist.", code=code, name=name)
        name_exists = cur.execute(
            f'SELECT COUNT(1) FROM users WHERE room="{room}" AND name="{name}"').fetchone()[0] != 0
        if name_exists:
            return render_template("home.html", error="This username already exists in this room", code=code, name=name)
        cur.execute(
            f'INSERT into users (name, room) VALUES(?,?)', (name, room))
        conn.commit()
        user_id = cur.execute(
            f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()[0]
        conn.close()
        session["room"] = room
        session["name"] = name
        session["user_id"] = user_id
        return redirect(url_for("room"))
    return render_template("home.html", name="", code="")


@app.route("/room")
def room():
    room = session.get("room")
    name = session.get("name")
    user_id = session.get("user_id")
    if not room_exists(room):
        return redirect(url_for("home"))
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    members = cur.execute(
        f'SELECT name FROM users WHERE room="{room}"').fetchall()
    output_members = []
    for member in members:
        output_members.append(member[0])
    conn.close()
    timestamp = get_room_timestamp(room)
    history = get_history(room)
    return render_template("room.html", room=room, history=history, timestamp=timestamp, name=name, user_id=user_id, members=output_members, close_time=REMOVE_ROOM_AFTER)


@app.route('/join/<string:room>')
def join_form(room):
    if not room_exists(room):
        return redirect(url_for("home"))
    return render_template("join.html", room=room)


@app.route('/join/<string:room>/<string:name>/<string:user_id>')
def join(room, name, user_id):
    if not room_exists(room):
        return redirect(url_for("home"))
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    name_entry = cur.execute(
        f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()
    if name_entry and user_id != str(name_entry[0]):
        return render_template("join.html", error="This username already exists in this room", room=room)
    if not name_entry:
        cur.execute(
            f'INSERT into users (name, room) VALUES(?,?)', (name, room))
    conn.commit()
    user_id = cur.execute(
        f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()[0]
    conn.close()
    session["room"] = room
    session["name"] = name
    session["user_id"] = user_id
    return redirect(url_for("room"))


@app.route('/file/<string:file_id>')
def download_file(file_id):
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    file = cur.execute(
        f'SELECT data, file_type, file_name FROM files WHERE id="{file_id}"').fetchone()
    if not file:
        return abort(400, "Record not found")
    conn.close()
    data = io.BytesIO(base64.b64decode(file[0]))
    return send_file(
        data,
        as_attachment=True,
        attachment_filename=file[2],
        mimetype=file[1]
    )


def downscale_image(image_data, format, factor):
    raw = Image.open(io.BytesIO(image_data))
    image_rescaled = raw.resize(
        (int(raw.size[0] * factor), int(raw.size[1] * factor)))
    buffered = io.BytesIO()
    image_rescaled.save(buffered, format=format)
    buffered.seek(0)
    return buffered


@socketio.on("connect")
def connect(_):
    room = session.get("room")
    name = session.get("name")
    if not room or not name:
        return
    if not room_exists(room):
        leave_room(room)
        return
    join_room(room)
    send_log(f"{name} joined the room.", room)
    print(f"{name} joined room {room}")


@socketio.on("disconnect")
def disconnect():
    room = session.get("room")
    name = session.get("name")
    leave_room(room)
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
        fileId = shortuuid.uuid()
        cur.execute(
            "INSERT INTO files(data, file_type, file_name, author, room, timestamp, id) VALUES(?,?,?,?,?,?,?)", (base64.b64encode(data["data"]), data["fileType"], data["fileName"], name, room, timestamp, fileId))
        conn.commit()
        content = ""
        if (data["fileType"].split("/")[0] == "image"):
            content = downscale_image(
                data["data"], data["fileType"].split("/")[1], .1).read()
        emit("message", {"name": name, "data": content,
                         "timestamp": timestamp, "type": "file", "fileType": data["fileType"], "fileName": data["fileName"], "fileId": fileId}, to=room)
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
        f'SELECT data, file_type, file_name, author, room, timestamp, id FROM files WHERE room="{room}"').fetchall()
    for file in files:
        content = ""
        if (file[1].split("/")[0] == "image"):
            content = base64.b64encode(downscale_image(base64.b64decode(
                file[0].decode()), file[1].split("/")[1], .1).getvalue()).decode("utf-8")
        history.append({"content": content, "fileType": file[1],
                       "fileName": file[2], "timestamp": file[5], "type": "file", "author": file[3], "fileId": file[6]})
    logs = cur.execute(
        f'SELECT content, timestamp, room FROM logs WHERE room="{room}"').fetchall()
    for log in logs:
        history.append({"content": log[0], "timestamp": log[1], "type": "log"})
    history.sort(key=lambda x: x["timestamp"])
    conn.close()
    return history


if __name__ == "__main__":
    socketio.run(app, debug=True)
