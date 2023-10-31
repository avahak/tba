import os, json
from flask_mail import Mail

def load_app_settings():
    """Loads environment variables from a file if it exists (localhost), 
    otherwise uses os.environ settings.
    """
    file_path = 'd:/projects/tba/localhost_settings.json'
    if os.path.exists(file_path):
        with open(file_path, 'r') as json_file:
            settings = json.load(json_file)
    else:
        settings = {}
        for key, value in os.environ.items():
            settings[key] = value
    return settings

# def setup_mail(app, app_settings: dict):
#     """Sets up mail for the app. Depending on app_settings returns Mail instance or None.
#     """
#     if app_settings.get("EMAIL_SENDER") == "GOOGLE":
#         # print("Using gmail settings for mail.")
#         app.config.update(
#             # Note: Can use TLS or SSL but do not mix them.
#             MAIL_SERVER = 'smtp.googlemail.com',
#             MAIL_PORT = 587,
#             MAIL_USE_TLS = True,
#             MAIL_USE_SSL = False,
#             # MAIL_SERVER = 'smtp.gmail.com',
#             # MAIL_PORT = 465,
#             # MAIL_USE_SSL = True,
#             # MAIL_USE_TLS = False,
#             MAIL_USERNAME = app_settings["GOOGLE_EMAIL_SENDER"],
#             MAIL_PASSWORD = app_settings["GOOGLE_APP_PASSWORD"]
#         )
#         return Mail(app)
#     elif app_settings.get("EMAIL_SENDER") == "MAILTRAP_IO":
#         # print("Using mailtrap.io settings for mail.")
#         app.config.update(
#             MAIL_SERVER = 'sandbox.smtp.mailtrap.io',
#             MAIL_PORT = 2525,
#             MAIL_USE_TLS = True,
#             MAIL_USE_SSL = False,
#             MAIL_USERNAME = app_settings["MAILTRAP_IO_USERNAME"],
#             MAIL_PASSWORD = app_settings["MAILTRAP_IO_PASSWORD"]
#         )
#         return Mail(app)
#     # print("Using no settings for mail.")
#     return None