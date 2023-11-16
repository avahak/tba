import json
from flask import render_template, url_for, render_template_string

class Messenger():
    @staticmethod
    def init_app(app):
        with open("app/templates/messages.json", "r") as f:
            Messenger.messages = json.loads(f.read())

    @staticmethod
    def render_message_template(message):
        """Returns html for a short message to the user.
        """
        return render_template("message.html", type=message["type"], title=message["title"], heading=message["heading"], message=str(message["message"]))