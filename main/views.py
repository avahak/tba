from flask import *
from . import app#, app_settings       # app is defined in __init__.py
from . import send_mail

@app.errorhandler(404)
def error_404(e):
    return "Put custom error page here with render_template", 404 # add status code like this if other than 200 (default)

@app.route('/400')
def not_found():
    abort(400)

@app.route('/test')
def test_it():
    return "<h1>At least this works.</h1>"

@app.route('/api/data')
def get_data():
    return send_from_directory(app.root_path + "/../", "package.json")

@app.route('/hello/')
@app.route('/hello/<name>')
def hello(name=None):
    return render_template("hello.html", name=name)

@app.route('/ultra/')
@app.route('/ultra/<name>')
def ultra_hello(name=None):
    return render_template("ultra_hello.html", name=name)

@app.route('/node_modules/<path:filename>')
def serve_node_modules(filename):
    """Used by javascript imports.
    """
    return send_from_directory(app.root_path + "/../node_modules", filename)

@app.route('/widget')
def home():
    return render_template("widget.html")

@app.route('/box')
def box():
    return render_template("box.html")

@app.route('/send_mail')
def send_mail_route():
    to = app_settings.get("GOOGLE_EMAIL_SENDER")
    subject = "Test subject"
    body = "<h1>Email body goes here.</h1>"
    return send_email.send_mail(to, subject, body)

@app.route('/')
def widget():
    return render_template("design.html")