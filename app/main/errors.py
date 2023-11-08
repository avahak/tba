from flask import *
from . import main
from .. import logger

@main.app_errorhandler(404)
def error_404(e):
    return "Put custom error page here with render_template", 404 # add status code like this if other than 200 (default)
