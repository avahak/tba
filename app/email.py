import os
from flask import current_app, render_template
from threading import Thread
from flask_mail import Message
from . import mail, logger

def send_async_email(app, msg):
    with app.app_context():
        try:
            logger.info("Attempting to send mail.", extra={"to": msg.recipients, "body": msg.body})
            mail.send(msg)
            logger.info("Mail sent successfully.", extra={"to": msg.recipients, "body": msg.body})
        except Exception as e:
            logger.error(f"Error in send_asyn_email", exc_info=e)

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

def send_template_mail(to, subject, template, *args, **kwargs):
    """Sends email based on a template. Text version is also attached 
    if it exists.
    """
    html_body = render_template(template, *args, **kwargs)
    text_template_path = os.path.splitext(template)[0] + ".txt"
    text_body = html_body
    try:
        text_body = render_template(text_template_path, *args, **kwargs)
    except Exception as e:
        logger.warning(f"No text file {text_template_path} found for email template {template}: {e}")
    send_mail(to, subject, html_body, text_body)