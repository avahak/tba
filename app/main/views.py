import sys
import numpy as np
from flask import *
from . import main
from .. import email, logger
from ..models import *
from ..fake_data import *
from sqlalchemy import create_engine, text

@main.app_context_processor
def inject_context():
    current_user = ""   # 'user_id' in session?
    active_page = request.path.strip('/')
    return { "active_page": active_page, "current_user": current_user }

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
    # server = current_app.config.get('MAIL_SERVER', "")
    # port = current_app.config.get('MAIL_PORT', "")
    # username = current_app.config.get('MAIL_USERNAME', "")
    # use_tls = current_app.config.get('MAIL_USE_TLS', "")
    return email.send_mail(to, subject, body)

@main.route('/config')
def config_route():
    s = f"LOG_FILE_NAME: {current_app.config.get('LOG_FILE_NAME')}<br>"
    s += f"SITE: {current_app.config.get('SITE')}<br>"
    s += f"CONFIG_SETTING: {current_app.config.get('CONFIG_SETTING')}<br>"
    s += f"MAIL_SENDER: {current_app.config.get('MAIL_SENDER')}<br>"
    s += f"MAIL_USE_TLS: {current_app.config.get('MAIL_USE_TLS')}<br>"
    # s += f"SQLALCHEMY_DATABASE_URI: {current_app.config.get('SQLALCHEMY_DATABASE_URI')}<br>"
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

@main.route('/julia')
def julia_route():
    return send_from_directory(current_app.root_path + "/static/html", "julia.html")

@main.route('/mandelbrot')
def mandelbrot_route():
    return send_from_directory(current_app.root_path + "/static/html", "mandelbrot.html")

# @main.route("/drop_all")
# def drop_all_route():
#     db.drop_all()
#     return "Drop all done."

# @main.route("/create_all")
# def create_all_route():
#     db.create_all()
#     return "Create all done."

@main.route("/recreate_database")
def recreate_database_route():
    """Drops the database and creates it again. Then creates the tables.
    WARNING! Destroys all data in the database.
    """
    url = current_app.config.get("DATABASE_URL", "")
    name = current_app.config.get("DATABASE_NAME", "")
    connection = None
    try:
        if url:
            engine = create_engine(url)
            connection = engine.connect()
            connection.execute(text(f"DROP DATABASE IF EXISTS {name};"))
            connection.execute(text(f"CREATE DATABASE IF NOT EXISTS {name};"))
            connection.execute(text(f"USE {name};"))
        else:
            db.drop_all()
        db.create_all()
        db.session.commit()
    except Exception as e:
        return f"Error! {e}"
    finally:
        if connection:
            connection.close()
    return "Success! Database recreated."

@main.route("/fake")
def fake_route():
    fake_roles()
    fake_users(73)
    return "Fake done."

@main.route("/show")
def show_route():
    users = User.query.all()
    roles = Role.query.all()
    user_count = len(users)
    return render_template("userbase/show.html", user_count=user_count, users=users, roles=roles)

@main.route("/")
def front():
    return render_template("test.html")