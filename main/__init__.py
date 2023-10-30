# Initializing the Flask app in this __init__.py file ensures that it is set up
# no matter which part of the package is accessed or executed. The Flask object is a
# crucial component for all Flask-related functions within this package.
#
# Placing it here provides several advantages:
#  - It centralizes app initialization, ensuring a consistent configuration across
#    multiple modules.
#  - It makes the app configuration always available and accessible, no matter how
#    the package is used.
#  - It avoids tightly coupling the app with specific modules like views.py, making
#    the code more modular and maintainable. Error handling or custom functionality
#    might not use views, for example.
#
# In contrast, placing app initialization in the script used to execute the web application
# (typically named app.py) could lead to issues, as it restricts the app's use only to web
# hosting, limiting its utility for other tasks or custom functionality and hindering testing.

from flask import Flask
from flask_mail import Mail
import os, json

# app = Flask(__name__, template_folder='templates', static_folder='static')
# app.debug = True
# print(app.root_path)

app = Flask(__name__)

def load_settings():
    file_path = 'd:/projects/tba/localhost_settings.json'
    if os.path.exists(file_path):
        with open(file_path, 'r') as json_file:
            data = json.load(json_file)
    else:
        data = {}
        for key, value in os.environ.items():
            data[key] = value
    return data

app_data = load_settings()

# app.config.update(
#     MAIL_SERVER = 'smtp.googlemail.com',
#     MAIL_PORT = 587,
#     MAIL_USE_TLS = True,
#     MAIL_USE_SSL = False,
#     MAIL_USERNAME = app_data["GOOGLE_EMAIL_SENDER"],
#     MAIL_PASSWORD = app_data["GOOGLE_APP_PASSWORD"]
# )

app.config.update(
    MAIL_SERVER = 'smtp.gmail.com',
    MAIL_PORT = 465,
    MAIL_USE_TLS = False,
    MAIL_USE_SSL = True,
    MAIL_USERNAME = app_data["GOOGLE_EMAIL_SENDER"],
    MAIL_PASSWORD = app_data["GOOGLE_APP_PASSWORD"]
)

mail = Mail(app)