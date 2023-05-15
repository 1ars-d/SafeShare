import dotenv

# Flask
from flask import Flask, render_template, session, redirect, url_for, abort, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit

# Database
import sqlite3
from apscheduler.schedulers.background import BackgroundScheduler
import shortuuid
import base64
import datetime

# Helpers
from utilities import generate_unique_code, room_exists, setup_db, check_rooms, get_db_connecton, get_history, get_room_timestamp, get_members, send_log, hash_password, get_room_type, check_room_password


# Server Setup
app = Flask(__name__)
env_config = dotenv.dotenv_values(".env")
app.config["SECRET_KEY"] = 'key!'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = int(env_config["MAX_BUFFER_SIZE"])
socketio = SocketIO(app, max_http_buffer_size=int(
    env_config["MAX_BUFFER_SIZE"]))

# DB Setup
setup_db()

# Schedule Setup -> Delete closed rooms
if env_config["REMOVE_ROOMS"] == "True":
    sched = BackgroundScheduler(daemon=True)
    sched.add_job(lambda: check_rooms(
        env_config["REMOVE_ROOMS_AFTER"]), 'interval', seconds=10)
    sched.start()


@app.route("/", methods=["POST", "GET"])
def home():
    session.clear()
    return render_template("home.html", name="", code="")


@app.route("/room")
def room():  # Checks if room stored in session exists and provides
    room = session.get("room")
    name = session.get("name")
    user_id = session.get("user_id")
    if not room_exists(room):
        return redirect(url_for("home"))
    return render_template("room.html",
                           room=room,
                           history=get_history(room),
                           timestamp=get_room_timestamp(room),
                           name=name,
                           user_id=user_id,
                           members=get_members(room),
                           close_time=env_config["REMOVE_ROOMS_AFTER"],
                           room_type=get_room_type(room),
                           close_room=env_config["REMOVE_ROOMS"])


@app.route('/create-secured/<string:name>/<string:password>')
def create_secured(name, password):
    if name == "" or password == "":
        raise ValueError("Create Secured Room: name or password empty")
    conn, cur = get_db_connecton()
    generated_code = generate_unique_code(5)
    timestamp = datetime.datetime.now().isoformat()
    salt, key = hash_password(password)
    cur.execute(
        "INSERT INTO rooms(code, timestamp, type, key, salt) VALUES(?,?,?,?,?)", (generated_code, timestamp, "secured", key, salt))
    cur.execute(
        f'INSERT into users (name, room, has_connected) VALUES(?,?,?)', (name, generated_code, "True"))
    cur.execute(
        "INSERT INTO logs(content, timestamp, room) VALUES(?,?,?)", (f"{name} created room {generated_code}", timestamp, generated_code))
    conn.commit()
    user_id = cur.lastrowid
    conn.close()
    session["room"] = generated_code
    session["name"] = name
    session["user_id"] = user_id
    return redirect(url_for("room"))


@app.route('/create-open/<string:name>')
def create_open(name):
    conn, cur = get_db_connecton()
    generated_code = generate_unique_code(5)
    timestamp = datetime.datetime.now().isoformat()
    cur.execute(
        "INSERT INTO rooms(code, timestamp, type) VALUES(?,?,?)", (generated_code, timestamp, "open"))
    cur.execute(
        f'INSERT into users (name, room, has_connected) VALUES(?,?,?)', (name, generated_code, True))
    cur.execute(
        "INSERT INTO logs(content, timestamp, room) VALUES(?,?,?)", (f"{name} created room {generated_code}", timestamp, generated_code))
    conn.commit()
    user_id = cur.lastrowid
    conn.close()
    session["room"] = generated_code
    session["name"] = name
    session["user_id"] = user_id
    return redirect(url_for("room"))


@app.route('/join/<string:room>')
def join_form(room):
    if not room_exists(room):
        redirect(url_for("home"))
    return render_template("join.html", room=room)


@app.route('/join/<string:room>/<string:name>/<string:user_id>')
def join(room, name, user_id):
    if not room_exists(room):
        if user_id == "join":
            return render_template("join.html", room=room, name=name, error="This room doesnt exist")
        else:
            return render_template("home.html", code=room, name=name, error="This room doesnt exist")
    conn, cur = get_db_connecton()
    name_entry = cur.execute(
        f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()
    if name_entry and user_id != str(name_entry[0]):
        if user_id == "join":
            return render_template("join.html", room=room, name=name, error="This username already exists in this room")
        else:
            return render_template("home.html", code=room, name=name, error="This username already exists in this room")
    if get_room_type(room) == "secured":
        return redirect(f"/join/enter-password/{room}/{name}/{user_id}")
    if not name_entry:
        cur.execute(
            f'INSERT into users (name, room, has_connected) VALUES(?,?,?)', (name, room, "False"))
    conn.commit()
    user_id = cur.execute(
        f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()[0]
    conn.close()
    session["room"] = room
    session["name"] = name
    session["user_id"] = user_id
    return redirect(url_for("room"))


@app.route("/join-secured/<string:room>/<string:name>/<string:user_id>/<string:password>")
def join_secured(room, name, user_id, password):
    if not room_exists(room) or get_room_type(room) == "open":
        return render_template("home.html", code=room, name=name, error="This room doesnt exist")
    if not check_room_password(room, password):
        return render_template("password-form.html", room=room, name=name, user_id=user_id, error="Incorrect password")
    conn, cur = get_db_connecton()
    name_entry = cur.execute(
        f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()
    if name_entry and user_id != str(name_entry[0]):
        return render_template("home.html", code=room, name=name, error="This username already exists in this room")
    if not name_entry:
        cur.execute(
            f'INSERT into users (name, room, has_connected) VALUES(?,?,?)', (name, room, "False"))
    conn.commit()
    user_id = cur.execute(
        f'SELECT id FROM users WHERE room="{room}" AND name="{name}"').fetchone()[0]
    conn.close()
    session["room"] = room
    session["name"] = name
    session["user_id"] = user_id
    return redirect(url_for("room"))


@app.route("/join/enter-password/<string:room>/<string:name>/<string:user_id>/")
def join_enter_password(room, name, user_id):
    return render_template("password-form.html", room=room, name=name, user_id=user_id)


# Route to download file stored in database
@app.route('/file/<string:file_id>/<string:save_type>')
def download_file(file_id, save_type):
    conn, cur = get_db_connecton()
    file = cur.execute(
        f'SELECT data, file_type, file_name FROM files WHERE id="{file_id}"').fetchone()
    if not file:
        return abort(400, "Record not found")
    conn.close()
    data = {
        'file': file[0] if save_type == "encrypted" else base64.b64encode(file[0]).decode('utf-8'),
        'fileSize': 0,
        'content-type': file[1],
        'fileName': file[2],
    }
    response = jsonify(data)
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Content-Type', 'application/json')
    return response

# Creates socket connection when user joins


@socketio.on("connect")
def connect(_):
    room = session.get("room")
    name = session.get("name")
    user_id = session.get("user_id")
    if not room or not name:
        return
    if not room_exists(room):
        leave_room(room)
        return
    join_room(room)
    conn, cur = get_db_connecton()
    user = cur.execute(
        f'SELECT has_connected FROM users WHERE id="{user_id}"').fetchone()
    if user[0] == "False":
        send_log(f"{name} joined the room.", room)
        cur.execute(
            f'UPDATE users SET has_connected = "True" WHERE id="{user_id}"')
        conn.commit()
    conn.close()


# Detach socket connection when user leaves
@socketio.on("disconnect")
def disconnect():
    room = session.get("room")
    name = session.get("name")
    leave_room(room)


# Called when user sends a message from the frontend -> content is stored in database and distributed to other users
@socketio.on("message")
def message(data):
    room = session.get("room")
    name = session.get("name")
    if not room_exists(room):
        return
    conn, cur = get_db_connecton()
    timestamp = datetime.datetime.now().isoformat()
    # {
    #      data,
    #      type,
    #      fileType
    #      fileName
    #      fileSize
    #  }
    if data["type"] == "file":
        fileId = shortuuid.uuid()
        cur.execute(
            "INSERT INTO files(data, file_type, file_name, author, room, timestamp, id, file_size) VALUES(?,?,?,?,?,?,?,?)", (data["data"], data["fileType"], data["fileName"], name, room, timestamp, fileId, data["fileSize"]))
        conn.commit()
        emit("message", {"name": name, "data": "",
                         "timestamp": timestamp, "type": "file", "fileType": data["fileType"], "fileName": data["fileName"], "fileId": fileId, "fileSize": data["fileSize"]}, to=room)
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
    # set HOST property in .env:
    # To Run on localhost leave host empty
    # To make server available from other devices in same network set HOST to your IPv4
    socketio.run(app, debug=True, host=env_config["HOST"])
