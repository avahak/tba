from . import mail, app
import json, os
from flask_mail import Message

from . import app_data

def send_mail(to, subject):
    msg = Message("[TBA] " + subject, sender="TBA Webteam", recipients=[to])
    msg.body = "Body of the msg"
    msg.html = "<h1>Body of the msg</h1>"
    s = app_data["GOOGLE_EMAIL_SENDER"][0:4] + " - "
    try:
        mail.send(msg)
    except Exception as e:
        return s + str(e)
    return s + "send_mail SUCCESS!"