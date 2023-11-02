import sys
import numpy as np
from flask import *
from . import main
from .. import email, logger

@main.app_errorhandler(404)
def error_404(e):
    return "Put custom error page here with render_template", 404 # add status code like this if other than 200 (default)

@main.route('/400')
def not_found_route():
    abort(400)

@main.route('/exception')
def exception_route(name: str):
    if (np.random.rand() < 0.5):
        1 / 0
    else:
        '2' + 2

@main.route('/api/data')
def get_data_route():
    return send_from_directory(current_app.root_path + "/../", "package.json")

@main.route('/hello/')
@main.route('/hello/<name>')
def hello_route(name=None):
    return render_template("hello.html", name=name)

@main.route('/ultra/')
@main.route('/ultra/<name>')
def ultra_route(name=None):
    return render_template("ultra_hello.html", name=name)

@main.route('/node_modules/<path:filename>')
def serve_node_modules_route(filename):
    """Used by javascript imports.
    """
    return send_from_directory(current_app.root_path + "/../node_modules", filename)

@main.route('/widget')
def widget_route():
    return render_template("widget.html")

@main.route('/box')
def box_route():
    return render_template("box.html")

@main.route('/email')
def email_route():
    to = current_app.config.get("MAIL_SENDER")
    subject = "Test subject"
    body = "<h1>Email body goes here.</h1>"
    # return f"to: {to}, subject: {subject}, body: {body}"
    server = current_app.config.get('MAIL_SERVER', "")
    port = current_app.config.get('MAIL_PORT', "")
    username = current_app.config.get('MAIL_USERNAME', "")
    use_tls = current_app.config.get('MAIL_USE_TLS', "")
    return email.send_mail(to, subject, body)

@main.route('/config')
def config_route():
    s = f"LOG_FILE_NAME: {current_app.config.get('LOG_FILE_NAME')}<br>"
    s += f"SITE: {current_app.config.get('SITE')}<br>"
    s += f"CONFIG_SETTING: {current_app.config.get('CONFIG_SETTING')}<br>"
    s += f"MAIL_SENDER: {current_app.config.get('MAIL_SENDER')}<br>"
    s += f"MAIL_USE_TLS: {current_app.config.get('MAIL_USE_TLS')}<br>"
    s += f"SQLALCHEMY_DATABASE_URI: {current_app.config.get('SQLALCHEMY_DATABASE_URI')}<br>"
    s += f"Python version: {sys.version}.<br>"
    return f"<h1>{s}</h1>"

@main.route('/logs')
def logs_route():
    with open(current_app.config.get("LOG_FILE_NAME"), 'r') as f:
        s = "<br>".join(f.readlines())
    return f"{s}"

@main.route('/design')
def design_route():
    return render_template("design.html")

@main.route("/")
def test():
    return render_template("test.html")