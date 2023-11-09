from flask import *
from . import userbase
from .. import db
from ..models import User
from sqlalchemy.exc import IntegrityError

@userbase.route('/login', methods=['GET', 'POST'])
def login():
    return "TODO IMPLEMENT"

@userbase.route('/admin_tool/', methods=["GET", "POST"])
def admin_tool():
    page = request.args.get("page", 1, type=int)
    if request.method == "POST":
        delete_user_id = request.form.get("hidden-user-id")
        user_to_delete = User.query.get(delete_user_id)
        db.session.delete(user_to_delete)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
        return redirect(url_for('userbase.admin_tool_route', page=page))
    page = request.args.get("page", 1, type=int)
    pagination = User.query.order_by(User.role_id.asc()).paginate(page=page, per_page=10, error_out=False)
    users = pagination.items
    fields = ["id", "email", "role", "is_confirmed", "is_active"]
    return render_template("userbase/admin_tool.html", fields=fields, users=users, pagination=pagination)