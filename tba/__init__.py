# Initializing the Flask app in this __init__.py file ensures that it is set up
# no matter which part of the package is accessed or executed. The Flask object is a
# crucial component for all Flask-related functions within this package.
#
# Placing it here provides several advantages:
#
#  - It centralizes app initialization, ensuring a consistent configuration across
#    multiple modules.
#  - It makes the app configuration always available and accessible, no matter how
#    the package is used.
#  - It avoids tightly coupling the app with specific modules like views.py, making
#    the code more modular and maintainable. Error handling or custom functionality
#    might not use views, for example.
#
# In contrast, placing app initialization in the script used to execute the web application
# (typically named app.py) could lead to issues, as it restricts the app's use only to web
# hosting, limiting its utility for other tasks or custom functionality and hindering testing.

from flask import Flask
# app = Flask(__name__, template_folder='templates', static_folder='static')
app = Flask(__name__)
# print(app.root_path)