from flask import *
from . import auth
from .. import db, email, logger
from ..models import *

@auth.route("/")
def test():
    return "TESTING DB ROUTE"

@auth.route("/reset")
def reset_route():
    db.drop_all()
    db.create_all()
    return "Reset done."

@auth.route("/fake")
def fake_route():
    user_role = Role(name='User')
    admin_role = Role(name='Admin')
    user1 = User(email="admin@bb.cc", role=admin_role)
    user2 = User(email="aa@bb.cc", role=user_role)
    user3 = User(email="dd@ee.ff", role=user_role)
    db.session.add_all([user_role, admin_role, user1, user2, user3])
    db.session.commit()
    return "Fake done."

@auth.route("/show")
def show_route():
    return "Show route.."