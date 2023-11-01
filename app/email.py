from flask import current_app
from threading import Thread
from flask_mail import Message
from . import mail, logger

def send_async_email(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
            logger.info("Mail sent successfully.")
        except Exception as e:
            logger.error(f"Error in send_asyn_email: {e}")

def send_mail(to, subject, html_body, text_body=None):
    esp = current_app.config.get('EMAIL_SERVICE_PROVIDER', "")
    s = f"Email sender is {esp}."
    if esp == "":
        return s + "Not sending anything (mail is None)."
    msg = Message("[TBA] " + subject, sender="TBA Webteam", recipients=[to])
    msg.body = text_body if text_body is not None else html_body
    msg.html = html_body
    app = current_app._get_current_object()
    thr = Thread(target=send_async_email, args=[app, msg])
    thr.start()
    return "Email sending thread started. Check log for results."