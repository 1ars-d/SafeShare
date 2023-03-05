from flask import Flask, render_template, session, request, redirect, url_for
from flask_socketio import SocketIO, join_room, leave_room, send, emit
import datetime
import sqlite3

from utilities import generate_unique_code, room_exists

# Server Setup
app = Flask(__name__)
app.config["SECRET_KEY"] = 'key!'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
socketio = SocketIO(app)

# Database Setup
conn = sqlite3.connect("ROOMS_db.sqlite")
cur = conn.cursor()
# Check if tables exist
cur.execute(
    ''' SELECT count(name) FROM sqlite_master WHERE type='table' AND name='rooms' ''')
if cur.fetchone()[0] != 1:
    cur.execute('CREATE TABLE rooms (code TEXT, members INTEGER)')
    cur.execute(
        'CREATE TABLE messages (content TEXT, content_type TEXT, author TEXT, room TEXT, timestamp TEXT)')
    cur.execute(
        'CREATE TABLE logs (content TEXT, timestamp TEXT, room TEXT)')
conn.close()


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
            cur.execute(
                "INSERT INTO rooms(code, members) VALUES(?,?)", (room, 0))
            conn.commit()
            conn.close()
            print("Created a new room with code:", room)
        # Room doesn't exist
        elif not room_exists(room):
            return render_template("home.html", error="Room does not exist.", code=code, name=name)

        session["room"] = room
        session["name"] = name
        return redirect(url_for("room"))

        # -> send to room
    return render_template("home.html", name="", code="")


@app.route("/room")
def room():
    room = session.get("room")
    return render_template("room.html", room=room)


@socketio.on("connect")
def connect(auth):
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

    """ if room in rooms:
        rooms[room]["members"] -= 1
        if rooms[room]["members"] <= 0:
            del rooms[room] """

    cur.execute(
        f'UPDATE rooms SET members = members - 1 WHERE code = "{room}"')
    conn.commit()
    conn.close()
    send_log(f"{name} left the room.", room)
    print(f"{name} left the room {room}")


@socketio.on("message")
def message(data):
    room = session.get("room")
    if not room_exists(room):
        return

    content =


def send_log(log, room):
    conn = sqlite3.connect("ROOMS_db.sqlite")
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO logs(content, timestamp, room) VALUES(?,?,?)", (log, datetime.datetime.now().isoformat(), room))
    conn.commit()
    conn.close()
    emit("log", {"log": log}, to=room)


if __name__ == "__main__":
    socketio.run(app, debug=True)
