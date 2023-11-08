from flask import *
from . import auth
# from .. import db, email, logger

@auth.route('/login', methods=['GET', 'POST'])
def login_route():
    return "TODO IMPLEMENT"