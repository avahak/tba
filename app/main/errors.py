from flask import *
from . import main
from .. import logger

@main.app_errorhandler(404)
def error_404(error):
    """Not Found"""
    return render_template("errors/404.html", error=error), 404

# @main.app_errorhandler(500)
# def error_500(error):
#     """Internal Server Error"""
#     return render_template("errors/500.html", error=error), 500

@main.app_errorhandler(504)
def error_504(error):
    """Gateway Timeout"""
    return render_template("errors/504.html", error=error), 504
