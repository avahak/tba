from flask_mail import Message
from . import mail, app_settings

def send_email():
    return 10

def send_message(to, subject, html_body, text_body=None):
    return ""
# def send_message(to, subject, html_body, text_body=None):
#     s = f"Email sender is {app_settings.get("EMAIL_SENDER")}."
#     if mail is None:
#         return s + "Not sending anything (mail is None)."
#     msg = Message("[TBA] " + subject, sender="TBA Webteam", recipients=[to])
#     msg.body = text_body if text_body is not None else html_body
#     msg.html = html_body
#     try:
#         mail.send(msg)
#     except Exception as e:
#         return s + str(e)
#     return s + "SUCCESS! Email sent."