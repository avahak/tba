from flask import *
from markupsafe import escape
from flask_login import login_user, logout_user, login_required
from . import userkit
from .. import db, logger, messenger
from ..models import User, Role
from ..email import send_mail, send_template_mail
from sqlalchemy.exc import IntegrityError
from ..decorators import *
from .forms import *
from ..tokens import decrypt

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
    return messenger.render_message_template(messenger.messages["logout"])

@userkit.route("/signup", methods=["GET", "POST"])
def signup():
    form = SignupForm()
    if form.validate_on_submit():
        user = User(email=form.email.data, role=Role.get_role("User"), password=form.password.data)
        db.session.add(user)
        db.session.commit()
        token = user.generate_confirmation_token()
        send_template_mail(user.email, "Confirm Your Account", "userkit/email/confirm", user=user, token=token)
        return messenger.render_message_template(messenger.messages["registration_success"])
    return render_template("userkit/signup.html", form=form)

@userkit.route("/confirm/<token>")
def confirm(token):
    user = User.confirm(token)
    if user:
        return messenger.render_message_template(messenger.messages["confirmation_success"])
    return messenger.render_message_template(messenger.messages["confirmation_failure"])

@userkit.route('/admin_tool/', methods=["GET", "POST"])
@can_act_as_required("Admin")
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
    pagination = User.query.order_by(User.role_id.asc(), User.id.asc()).paginate(page=page, per_page=10, error_out=False)
    users = pagination.items
    fields = ["id", "email", "role", "is_confirmed", "is_active"]
    return render_template("userkit/admin_tool.html", fields=fields, users=users, pagination=pagination)

@userkit.route('/request_confirmation_email', methods=['GET', 'POST'])
def request_confirmation_email():
    form = RequestConfirmationEmailForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if (user is not None) and (not user.is_confirmed):
            token = user.generate_confirmation_token()
            send_template_mail(user.email, "Confirm Your Account", "userkit/email/confirm", user=user, token=token)
            return messenger.render_message_template(messenger.messages["confirmation_email_resent"])
        return messenger.render_message_template(messenger.messages["confirmation_email_resend_failure"])
    return render_template("userkit/request_confirmation_email.html", form=form)

@userkit.route('/request_password_reset_email', methods=['GET', 'POST'])
def request_password_reset_email():
    form = RequestPasswordResetEmailForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user is not None:
            token = user.generate_password_reset_token()
            send_template_mail(user.email, "Password Reset Link", "userkit/email/password_reset", user=user, token=token)
            return messenger.render_message_template(messenger.messages["request_password_reset_email_sent"])
        return messenger.render_message_template(messenger.messages["request_password_reset_email_failure"])
    return render_template("userkit/request_password_reset_email.html", form=form)

@userkit.route("/password_reset/<token>", methods=['GET', 'POST'])
def password_reset(token):
    token_obj = decrypt(token)
    if token_obj and ("password_reset" in token_obj):
        user_id = token_obj["password_reset"]
        user = User.query.get(user_id)
        if user:
            form = PasswordResetForm()
            if form.validate_on_submit():
                user.password = form.password.data
                db.session.commit()
                return messenger.render_message_template(messenger.messages["password_change_success"])
            return render_template("userkit/password_reset.html", form=form)
    return messenger.render_message_template(messenger.messages["password_reset_failure"])

@userkit.route('/feedback', methods=['GET', 'POST'])
def feedback():
    form = FeedbackForm()
    if form.validate_on_submit():
        text = f"Sender: {escape(form.email.data)}\n Feedback: {escape(form.feedback.data)}"
        send_mail(current_app.config.get("MAIL_SENDER"), "TBA Feedback", None, text)
        return messenger.render_message_template(messenger.messages["feedback_success"])
    return render_template("userkit/feedback.html", form=form)

@userkit.route('/change_password', methods=['GET', 'POST'])
@login_required
def change_password():
    form = PasswordChangeForm()
    if form.validate_on_submit():
        current_user.password = form.password_new.data
        db.session.commit()
        return messenger.render_message_template(messenger.messages["password_change_success"])
    return render_template("userkit/change_password.html", form=form)

@userkit.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    return render_template("userkit/profile.html")