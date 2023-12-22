import sys, os, uuid, re
import numpy as np
import datetime
from flask import *
from flask_cors import cross_origin
from . import main
from .. import logger
from ..email import send_mail
from ..models import *
from ..decorators import *
from ..fake_data import *
from sqlalchemy import create_engine, text
from flask_login import login_required
from ..tokens import *

@main.app_context_processor
def inject_context():
    active_page = request.path.strip('/')

    # pool_status = db.engine.pool.status()     # NOTE! Just for DEBUGGING, remove after!
    app_uptime = str(datetime.datetime.now() - current_app.config.get("APP_START_TIME"))
    app_uptime = app_uptime.split(".")[0]

    return { 
        # "pool_status": pool_status, 
        "active_page": active_page, 
        "app_uptime": app_uptime,
    }

@main.route('/exception')
def exception():
    if (np.random.rand() < 0.5):
        1 / 0
    else:
        '2' + 2

@main.route('/node_modules/<path:filename>')
def serve_node_modules(filename):
    """Used by javascript imports.
    """
    return send_from_directory(current_app.root_path + "/../node_modules", filename)

@main.route('/widget')
def widget():
    return render_template("widget.html")

@main.route('/box')
def box():
    return render_template("box.html")

@main.route('/email')
def email():
    to = current_app.config.get("MAIL_SENDER")
    subject = "Test subject"
    body = "<h1>Email body goes here.</h1>"
    # return f"to: {to}, subject: {subject}, body: {body}"
    # server = current_app.config.get('MAIL_SERVER', "")
    # port = current_app.config.get('MAIL_PORT', "")
    # username = current_app.config.get('MAIL_USERNAME', "")
    # use_tls = current_app.config.get('MAIL_USE_TLS', "")
    return send_mail(to, subject, body)

@main.route('/config')
def config():
    s = "<h1>"
    s += f"LOG_FILE_DIRECTORY: {current_app.config.get('LOG_FILE_DIRECTORY')}<br>"
    s += f"DIAGRAM_FILE_DIRECTORY: {current_app.config.get('DIAGRAM_FILE_DIRECTORY')}<br>"
    s += f"SITE: {current_app.config.get('SITE')}<br>"
    s += f"CONFIG_SETTING: {current_app.config.get('CONFIG_SETTING')}<br>"
    s += f"MAIL_SENDER: {current_app.config.get('MAIL_SENDER')}<br>"
    s += f"MAIL_USE_TLS: {current_app.config.get('MAIL_USE_TLS')}<br>"
    s += f"SQLALCHEMY_TRACK_MODIFICATIONS: {current_app.config.get('SQLALCHEMY_TRACK_MODIFICATIONS')}<br>"
    # s += f"SQLALCHEMY_DATABASE_URI: {current_app.config.get('SQLALCHEMY_DATABASE_URI')}<br>"
    s += f"Python version: {sys.version}.<br>"
    s += "<br>URL MAP:<br></h1><h4>"
    for rule in current_app.url_map.iter_rules():
        s += f"Rule: {rule.rule}<br>"
        s += f"Endpoint: {rule.endpoint}<br>"
        s += f"Methods: {', '.join(rule.methods)}<br>"
        s += f"Defaults: {rule.defaults}<br>"
        s += f"Arguments: {rule.arguments}<br>"
        s += "<br>"
    return f"{s}<h4>"

def get_time_diff(time):
  """Returns a string that tells the time difference between now and the given time.
  """
  diff = datetime.datetime.now() - datetime.datetime.fromisoformat(time)
  if diff.days:
    return f"{diff.days}d {diff.seconds//3600}h ago"
  elif diff.seconds >= 3600:
    return f"{diff.seconds//3600}h {(diff.seconds//60)%60}m ago"
  elif diff.seconds >= 60:
    return f"{(diff.seconds//60)%60}m {diff.seconds%60}s ago"
  elif diff.seconds:
    return f"{diff.seconds%60}s ago"
  return "now"

@main.route('/logs')
def logs():
    entries = []
    with open(f"{current_app.config.get('LOG_FILE_DIRECTORY')}/tba.log", 'r') as f:
        for line in f:
            entries.append(json.loads(line))
    # logger.debug("Logger error test", extra={ "user_id": 142, "foo": ["bar", "baz"] })
    # f_time = lambda s: str(datetime.datetime.now()-datetime.datetime.fromisoformat(s)).split(".")[0]
    return render_template("logs.html", enum_entries=enumerate(reversed(entries)), f_time=get_time_diff)

@main.route('/sqlalchemy_logs')
@can_act_as_required("Admin")
def sqlalchemy_logs():
    with open(f"{current_app.config.get('LOG_FILE_DIRECTORY')}/sqlalchemy.log", 'r') as f:
        s = "<br>".join(f.readlines())
    return f"{s}"

@main.route('/sqlalchemy_engine_logs')
@can_act_as_required("Admin")
def sqlalchemy_engine_logs():
    with open(f"{current_app.config.get('LOG_FILE_DIRECTORY')}/sqlalchemy_engine.log", 'r') as f:
        s = "<br>".join(f.readlines())
    return f"{s}"

@main.route('/julia')
def julia():
    return send_from_directory(current_app.root_path + "/static/html", "julia.html")

@main.route('/mandelbrot')
def mandelbrot():
    return send_from_directory(current_app.root_path + "/static/html", "mandelbrot.html")

# @main.route("/drop_all")
# def drop_all():
#     db.drop_all()
#     return "Drop all done."

# @main.route("/create_all")
# def create_all():
#     db.create_all()
#     return "Create all done."

def _recreate_database():
    """Drops the database and creates it again. Then creates the tables.
    WARNING! Destroys all data in the database.
    """
    url = current_app.config.get("SQLALCHEMY_BASE_URI", "")
    name = current_app.config.get("SQLALCHEMY_NAME", "")
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
    fake_roles()
    fake_users(1)
    return "Success! Database recreated."

@main.route("/recreate_database")
@can_act_as_required("Admin")
def recreate_database():
    return _recreate_database()

@main.route("/fake")
@can_act_as_required("Admin")
def fake():
    fake_roles()
    fake_users(23)
    return "Fake done."

@main.route("/show")
@can_act_as_required("Admin")
def show():
    users = User.query.all()
    roles = Role.query.all()
    user_count = len(users)
    return render_template("userkit/show.html", user_count=user_count, users=users, roles=roles)

@main.route("/fernet")
def fernet():
    import time
    user_id = 42069
    obj = { "user_id": user_id }

    enc_obj = encrypt(obj, 1)
    # enc_obj = "gksahkaeh"
    # time.sleep(0.5)
    obj2 = decrypt(enc_obj)
    
    if obj2 is None:
        return "Invalid or expired token."

    s = "<h1>Fernet test</h1><br>"
    s += f"{enc_obj = }<br>"
    s += f"{len(enc_obj) = }<br>"
    s += f"{obj2 = }"
    return s

@main.route("/message")
def message():
    return render_template("message.html", 
        title="Title here", 
        heading="Confirmation email sent!", 
        message="Please check your email inbox and click the confirmation link to activate your account.")

@main.route("/test")
def test():
    token = encrypt("foo", 60)
    return render_template("userkit/email/confirm.html", token=token)

def load_diagram_from_file(diagram_id): 
    if diagram_id is None:
        return None
    userdata_folder = current_app.config.get('DIAGRAM_FILE_DIRECTORY', '.')
    file_path = f"{userdata_folder}/diagram_{diagram_id}.json"
    if not os.path.isfile(file_path):
        return None
    with open(file_path, "r") as f:
        data = f.read()
    return data

def write_diagram_to_file(data): 
    userdata_folder = current_app.config.get('DIAGRAM_FILE_DIRECTORY', '.')
    diagram_id = uuid.uuid4().hex
    file_path = f"{userdata_folder}/diagram_{diagram_id}.json"
    with open(file_path, "w") as f:
        f.write(data)
    return diagram_id

@main.route('/diagram', methods=["GET"])
def diagram():
    diagram_id = request.args.get("id")
    # Check if we should use HTTP or HTTPS scheme:
    scheme = 'https' if (request.scheme == 'https') or ('X-Forwarded-Proto' in request.headers and request.headers['X-Forwarded-Proto'] == 'https') else 'http'
    if (diagram_id is None) or (not re.match("^[a-zA-Z0-9]+$", diagram_id)):
        return render_template("diagram.html")      # diagram_id contains illegal characters
    return render_template("diagram.html", diagram_url=url_for(f"main.api", diagram_id=diagram_id, _external=True, _scheme=scheme))

@main.route('/api/<diagram_id>', methods=["GET"])
@main.route('/api', methods=["POST"])
@cross_origin()
def api(diagram_id=None):
    if request.method == "POST":
        try:
            data = json.dumps(request.json)
            logger.debug("api() received data in POST", extra={"data": data})

            diagram_id = write_diagram_to_file(data)

            response_data = {"message": f"Data received successfully, id={diagram_id}", "url": url_for("main.diagram", id=diagram_id, _external=True)}
            return jsonify(response_data), 200  # Respond with a JSON message
        except Exception as e:
            logger.debug("Error processing JSON in api() POST", exc_info=e)
            return jsonify({'error': 'Invalid JSON data'}), 400  # 400 Bad Request
    # GET: 
    data = load_diagram_from_file(diagram_id)
    if data is None:
        return jsonify({'error': 'Data not found'}), 404
    return data

@main.route('/shots')
def shots():
    return render_template("shots.html")

@main.route('/physics')
def physics():
    return render_template("physics.html")

@main.route('/')
def welcome():
    return render_template("welcome.html")

@main.route("/front")
def front():
    return render_template("front.html")