from flask import *

app = Flask("TBA")
    
@app.route('/hello/<username>')
def hello(username):
    return f"Hello, {username}"

@app.route('/')
def home():
    return render_template("design.html")
    
if __name__ == '__main__':
    app.run()