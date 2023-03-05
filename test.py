import sqlite3

# Database Setup
conn = sqlite3.connect("ROOMS_db.sqlite")
cur = conn.cursor()
cur.execute(
    ''' SELECT count(name) FROM sqlite_master WHERE type='table' AND name='rooms' ''')
if cur.fetchone()[0] != 1:
    cur.execute('CREATE TABLE rooms (code TEXT, members INTEGER)')
    cur.execute(
        'CREATE TABLE messages (content TEXT, content_type TEXT, author TEXT, timestamp TEXT)')
print(cur.rowcount)
cur.execute(''' INSERT INTO rooms(code, members)
              VALUES("ADSDF", 1) ''')
conn.close()
