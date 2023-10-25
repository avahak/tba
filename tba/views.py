from flask import *

wapp = Flask("TBA")

@wapp.route('/api/data')
def get_data():
    return wapp.send_static_file("package.json")

@wapp.route('/hello/')
@wapp.route('/hello/<name>')
def hello(name=None):
    return render_template("hello.html", name=name)

@wapp.route('/')
def home():
    return render_template("design.html")