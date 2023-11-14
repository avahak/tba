# TODO: 
# confirmation email request, 
# feedback sending, 
# password reset (forgotten password) [and request]
# password change (while logged in)

from flask import *
from flask_login import login_user, logout_user, login_required
from . import userkit
from .. import db, logger
from ..models import User, Role
from ..email import send_template_mail
from sqlalchemy.exc import IntegrityError
from ..decorators import *
from .forms import LoginForm, RegistrationForm

messages = {
    "registration_success": {
        "title": "Registration Success",
        "heading": "Registration Succeeded!",
        "message": "Thank you for registering! A confirmation email has been sent to your inbox. Please check your email and click the confirmation link to activate your account."
    },
    "confirmation_email_resent": {
        "title": "Email Resent",
        "heading": "Email Resent Successfully!",
        "message": "We've resent the confirmation email to your inbox. Please check your email and click the confirmation link to activate your account."
    },
    "confirmation_success": {
        "title": "Confirmation Success",
        "heading": "Congratulations!",
        "message": "Your email has been successfully confirmed. You have completed the registration process and can now log in."
    },
    "confirmation_failure": {
        "title": "Confirmation Failure",
        "heading": "Confirmation Attempt Failed",
        "message": "The token was invalid or expired. Please double-check the link or request another token <a href=\"#\">here</a>."
    },
    "password_reset_request_email_sent": {
        "title": "Password Reset Email Sent",
        "heading": "Password Reset Email Sent",
        "message": "We've sent an email with instructions on resetting your password. Please check your inbox, and follow the provided link to reset your password."
    },
    "password_change_success": {
        "title": "Password Change Success",
        "heading": "Password Changed Successfully",
        "message": "Your password has been updated successfully. You can now log in securely with your new password."
    },
    "logout": {
        "title": "Logout Successful",
        "heading": "Goodbye for Now!",
        "message": "You have logged out."
    },
    "feedback_received": {
        "title": "Feedback Received",
        "heading": "Thank You for Your Feedback",
        "message": "We've received your feedback. It will be reviewed as we work towards improving our platform. If you have any further comments or questions, feel free to get in touch."
    }
}


def render_message_template(message):
    return render_template("message.html", title=message["title"], heading=message["heading"], message=message["message"])

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
    return render_message_template(messages["logout"])

@userkit.route("/register", methods=["GET", "POST"])
def register():
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(email=form.email.data, role=Role.get_role("User"), password=form.password.data)
        db.session.add(user)
        db.session.commit()
        token = user.generate_confirmation_token()
        send_template_mail(user.email, "Confirm Your Account", "userkit/email/confirm.html", user=user, token=token)
        return render_message_template(messages["registration_success"])
    return render_template("userkit/register.html", form=form)

@userkit.route("/confirm/<token>")
def confirm(token):
    user = User.confirm(token)
    if user:
        return render_message_template(messages["confirmation_success"])
    return render_message_template(messages["confirmation_failure"])

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
    pagination = User.query.order_by(User.role_id.asc()).paginate(page=page, per_page=10, error_out=False)
    users = pagination.items
    fields = ["id", "email", "role", "is_confirmed", "is_active"]
    return render_template("userkit/admin_tool.html", fields=fields, users=users, pagination=pagination)