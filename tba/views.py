from flask import *
import os
from . import app       # finds variable app defined in __init__.py

@app.route('/test')
def test_it():
    return "<h1>At least this works!</h1>"

@app.route('/api/data')
def get_data():
    return app.send_static_file("package.json")

@app.route('/hello/')
@app.route('/hello/<name>')
def hello(name=None):
    return render_template("hello.html", name=name)

@app.route('/node_modules/<path:filename>')
def serve_node_modules(filename):
    """Used by javascript imports.
    """
    return send_from_directory(app.root_path + "/node_modules", filename)

@app.route('/')
def home():
    return render_template("design.html")