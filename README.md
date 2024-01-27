<!-- Logo -->
<p align="center">
  <img width="220" src="./Server/static/icons/page_icon.png">
</p>

---

# SafeShare

A web chat app based on user-created rooms.

## Functionality

With this application you can create temporary encrypted chatrooms to share texts and files.

There are two room types. You can choose between an open and a password secured (and encrypted) room.

When creating a room its code is automatically generated. This code can then be shared and used to join the room from another device.

Rooms are only temporary. They (and their data) will be removed after 20 minutes.

Here is a screenshot of the browser:

![Desktop Screenshot 2024 01 27 - 12 55 42 85](https://github.com/1ars-d/SafeShare/assets/71517515/3906c117-16b8-49d8-8a57-25a5c95f7b1a)

![Screenshot](Screenshot.png "Screenshot")

## Technologies

This app is based on a [Flask](https://flask.palletsprojects.com/) webserver and uses WebSockets ([SocketIO](https://socket.io/)) for realtime messages. It uses an SQLite database to store data.

## Development

You can host this application yourself. Make sure to install all packages listed in requirements.txt

- create a `.env` file in the same dir as `main.py` to specify

        REMOVE_ROOMS=True # 'FALSE' or 'TRUE'
        REMOVE_ROOMS_AFTER=20 # in minutes
        MAX_BUFFER_SIZE=50000000 # 50 MB
        ENCRYPTED_MAX_UPLOAD=8 # in mb
        MAX_UPLOAD=50 # in mb
        HOST=192.168.178.57 # IPv4

- Then run in `Server`

        python main.py

## Bugs / Issues

- application crashes when trying to encrypt and send files over 10mb because encryption takes too long.
  Possible solution: split up file in to packets and encrypt individually
