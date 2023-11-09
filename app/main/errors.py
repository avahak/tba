from flask import *
from . import main
from .. import logger

@main.app_errorhandler(404)
def error_404(error):
    return render_template("errors/404.html", error=error), 404

# @main.app_errorhandler(500)
# def error_500(error):
#     return render_template("errors/500.html", error=error), 500
