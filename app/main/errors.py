from flask import *
from . import main
from .. import logger
from .. import messenger

@main.app_errorhandler(404)
def error_404(error):
    """Not Found
    """
    message = { "type": "error", "title": "404 Not Found", "heading": "404 Not Found", "message": error } 
    return messenger.render_message_template(message)
    # return render_template("errors/404.html", error=error), 404

@main.app_errorhandler(500)
def error_500(error):
    """Internal Server Error
    """
    message = { "type": "error", "title": "500 Internal Server Error", "heading": "500 Internal Server Error", "message": error } 
    return messenger.render_message_template(message)
    # return render_template("errors/500.html", error=error), 500

# NOTE! Maybe this cannot show up: 504 is issued by the proxy server, not gunicorn.
# @main.app_errorhandler(504)
# def error_504(error):
#     """Gateway Timeout
#     """
#     return render_template("errors/504.html", error=error), 504
