""" import os
import hashlib

salt = os.urandom(32)
key = hashlib.pbkdf2_hmac("sha256", "password".encode("utf-8"), salt, 100000)

password_to_check = "password"

new_key = hashlib.pbkdf2_hmac(
    "sha256", password_to_check.encode("utf-8"), salt, 100000)

if new_key == key:
    print("correct")
else:
    print("incorrect") """
import sqlite3
from utilities import get_db_connecton

conn, cur = get_db_connecton()
response = cur.execute(
    f'INSERT into users (name, room) VALUES(?,?)', ("lars", "lmao"))
conn.commit()
print(cur.lastrowid)
