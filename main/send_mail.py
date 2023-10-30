from . import mail, app
import json, os
from flask_mail import Message

from . import app_data

# app.config.update(
#     MAIL_SERVER = 'smtp.googlemail.com',
#     MAIL_PORT = 587,
#     MAIL_USE_TLS = True,
#     MAIL_USERNAME = data["GOOGLE_EMAIL_SENDER"],
#     MAIL_PASSWORD = data["GOOGLE_APP_PASSWORD"]
# )

app.config.update(
    MAIL_SERVER = 'smtp.gmail.com',
    MAIL_PORT = 465,
    MAIL_USE_SSL = True,
    MAIL_USERNAME = app_data["GOOGLE_EMAIL_SENDER"],
    MAIL_PASSWORD = app_data["GOOGLE_APP_PASSWORD"]
)

def send_mail(to, subject):
    msg = Message("[TBA] " + subject, sender="TBA Webteam", recipients=[to])
    msg.body = "Body of the msg"
    msg.html = "<h1>Body of the msg</h1>"
    # return app_data["GOOGLE_EMAIL_SENDER"]
    mail.send(msg)