from flask import Blueprint

userkit = Blueprint('userkit', __name__)

from . import views