import io
import sys

# Flask
from flask import Flask, render_template, session, request, redirect, url_for, abort, send_file
from flask_socketio import SocketIO, join_room, leave_room, emit

# Database
import sqlite3
from apscheduler.schedulers.background import BackgroundScheduler
import shortuuid
import base64
import datetime

# Helpers
from utilities import generate_unique_code, room_exists, setup_db, check_rooms, get_db_connecton, get_history, get_room_timestamp, get_members, downscale_image, get_image_dimensions, send_log
from CONSTANTS import REMOVE_ROOM_AFTER, MAX_BUFFER_SIZE


# Server Setup
app = Flask(__name__)
app.config["SECRET_KEY"] = 'key!'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = MAX_BUFFER_SIZE
socketio = SocketIO(app, max_http_buffer_size=MAX_BUFFER_SIZE)

# DB Setup
setup_db()

# Schedule Setup -> Delete closed rooms
sched = BackgroundScheduler(daemon=True)
sched.add_job(check_rooms, 'interval', seconds=10)
sched.start()


@app.route("/", methods=["POST", "GET"])  # Homepage Route
def home():
    session.clear()
    if request.method == "POST":  # -> Reads form and either redirects user to specific room or creates a new one
        name = request.form.get("name", "")
        code = request.form.get("code", "")
        join = request.form.get("join", False)
        create = request.form.get("create", False)
        if not name:    # name empty
            return render_template("home.html", error="Please enter a name.", code=code, name=name)
        if join != False and not code:  # code empty
            return render_template("home.html", error="Please enter a room code.", code=code, name=name)
        room = code
        conn, cur = get_db_connecton()
        if create != False:   # create was pressed
            room = generate_unique_code(5)
            timestamp = datetime.datetime.now().isoformat()
            cur.execute(
                "INSERT INTO rooms(code, timestamp) VALUES(?,?)", (room, timestamp))
            conn.commit()
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


# Route for specific Room
@app.route("/room")
def room():  # Checks if room stored in session exists and provides
    room = session.get("room")
    name = session.get("name")
    user_id = session.get("user_id")
    if not room_exists(room):
        return redirect(url_for("home"))
    output_members = get_members(room)
    timestamp = get_room_timestamp(room)
    history = get_history(room)
    return render_template("room.html", room=room, history=history, timestamp=timestamp, name=name, user_id=user_id, members=output_members, close_time=REMOVE_ROOM_AFTER)


# Route for room invitations
@app.route('/join/<string:room>')
def join_form(room):
    if not room_exists(room):
        return redirect(url_for("home"))
    return render_template("join.html", room=room)


# Route to join room via link -> used for inviatations
@app.route('/join/<string:room>/<string:name>/<string:user_id>')
def join(room, name, user_id):
    if not room_exists(room):
        return redirect(url_for("home"))
    conn, cur = get_db_connecton()
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


# Route to download file stored in database
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
        download_name=file[2],
        mimetype=file[1]
    )


# Creates socket connection when user joins
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


# Detach socket connection when user leaves
@socketio.on("disconnect")
def disconnect():
    room = session.get("room")
    name = session.get("name")
    leave_room(room)
    send_log(f"{name} left the room.", room)


# Called when user sends a message from the frontend -> content is stored in database and distributed to other users
@socketio.on("message")
def message(data):
    room = session.get("room")
    name = session.get("name")
    if not room_exists(room):
        return
    conn, cur = get_db_connecton()
    timestamp = datetime.datetime.now().isoformat()
    if data["type"] == "file":
        fileId = shortuuid.uuid()
        width = 0
        height = 0
        if (data["fileType"].split("/")[0] == "image"):
            width, height = get_image_dimensions(data["data"])
        cur.execute(
            "INSERT INTO files(data, file_type, file_name, author, room, timestamp, id, width, height) VALUES(?,?,?,?,?,?,?,?,?)", (base64.b64encode(data["data"]), data["fileType"], data["fileName"], name, room, timestamp, fileId, width, height))
        conn.commit()
        content = ""
        if (data["fileType"].split("/")[0] == "image"):
            content = downscale_image(
                data["data"], data["fileType"].split("/")[1], .1).read()
        emit("message", {"name": name, "data": content,
                         "timestamp": timestamp, "type": "file", "fileType": data["fileType"], "fileName": data["fileName"], "fileId": fileId, "fileSize": sys.getsizeof(data["data"]), "imageWidth": width, "imageHeight": height}, to=room)
    if data["type"] == "text":
        content = data["data"]
        cur.execute(
            "INSERT INTO messages(content, content_type, author, room, timestamp) VALUES(?,?,?,?,?)", (content, "text", name, room, timestamp))
        conn.commit()
        emit("message", {"name": name, "data": content,
                         "timestamp": timestamp, "type": "text"}, to=room)
    conn.close()


if __name__ == "__main__":
    # Run Server
    socketio.run(app, debug=True, host="192.168.178.57")
