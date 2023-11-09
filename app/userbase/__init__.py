from flask import Blueprint

userbase = Blueprint('userbase', __name__)

from . import views