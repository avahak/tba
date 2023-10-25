# from flask import escape      # use escape("...") to html-sanitize a string
# Note: When you use Flask's templating system (Jinja2), variables and content that 
# you insert into templates are automatically escaped by default
from flask import *
from . import app       # finds variable app defined in __init__.py

@app.route('/test')
def test_it():
    return "<h1>At least this works!</h1>"

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

@app.route('/')
def home():
    return render_template("design.html")