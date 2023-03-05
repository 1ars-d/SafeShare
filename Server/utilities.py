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
