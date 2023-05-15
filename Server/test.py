import requests

res = requests.get("http://worldtimeapi.org/api/timezone/Europe/Berlin")
print(res.json())