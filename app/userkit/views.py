from flask import *
from flask_login import login_user, logout_user, login_required
from . import userkit
from .. import db
from ..models import User
from ..email import send_template_mail
from sqlalchemy.exc import IntegrityError
from ..decorators import *
from .forms import LoginForm, RegistrationForm

@userkit.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if (user is not None) and user.verify_password(form.password.data):
            login_user(user, form.remember_me.data)
            next = request.args.get("next")
            if (next is None) or (not next.startswith("/")):
                next = url_for("main.front")
            return redirect(next)
    return render_template("userkit/login.html", form=form)

@userkit.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("main.front"))

@userkit.route("/register", methods=["GET", "POST"])
def register():
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(email=form.email.data, password=form.password.data)
        db.session.add(user)
        db.session.commit()
        token = user.generate_confirmation_token()
        send_template_mail(user.email, "Confirm Your Account", "userkit/email/confirm", user=user, token=token)
        return redirect(url_for("main.front"))
    return render_template("userkit/register.html", form=form)

@userkit.route("/confirm/<token>")
def confirm(token):
    user = User.confirm(token)
    if user:
        return f"Confirmation successful, {user}!"
    return "Confirmation failed somehow."

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
    pagination = User.query.order_by(User.role_id.asc()).paginate(page=page, per_page=10, error_out=False)
    users = pagination.items
    fields = ["id", "email", "role", "is_confirmed", "is_active"]
    return render_template("userkit/admin_tool.html", fields=fields, users=users, pagination=pagination)