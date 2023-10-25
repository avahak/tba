from flask import *

app = Flask("TBA", template_folder='tba/templates', static_folder='tba/static')

@app.route('/api/data')
def get_data():
    return app.send_static_file("package.json")

@app.route('/hello/')
@app.route('/hello/<name>')
def hello(name=None):
    return render_template("hello.html", name=name)

@app.route('/')
def home():
    return render_template("design.html")