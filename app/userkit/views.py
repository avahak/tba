from flask import *
from . import userkit
from .. import db
from ..models import User
from sqlalchemy.exc import IntegrityError
from ..decorators import *

@userkit.route('/login', methods=['GET', 'POST'])
def login():
    return "TODO IMPLEMENT"

@userkit.route('/admin_tool/', methods=["GET", "POST"])
def admin_tool():
    page = request.args.get("page", 1, type=int)
    if request.method == "POST":
        action_data = json.loads(request.form.get("hidden-user-id"))
        if action_data["action"] == "deleteUser":
            user_id = User.query.get(action_data["user_id"])
            db.session.delete(user_id)
        elif action_data["action"] == "toggleIsActive":
            user = User.query.get(action_data["user_id"])
            user.is_active = not user.is_active
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
        finally:
            db.session.close()
        return redirect(url_for('userkit.admin_tool', page=page))
    page = request.args.get("page", 1, type=int)
    pagination = User.query.order_by(User.role_id.asc()).paginate(page=page, per_page=10, error_out=False)
    users = pagination.items
    fields = ["id", "email", "role", "is_confirmed", "is_active"]
    s = render_template("userkit/admin_tool.html", fields=fields, users=users, pagination=pagination)

    # NOTE! EXPERIMENTAL trying to fix Azure hangup.
    # db.session.close()

    return s