from flask_login import current_user
from flask_wtf import FlaskForm 
from wtforms import *
from wtforms.validators import *
from ..models import User

class LoginForm(FlaskForm):
    """Form for logging the user in.
    """
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    password = PasswordField("Password", validators=[DataRequired()])
    remember_me = BooleanField("Remember me")
    submit = SubmitField("Log In")

class SignupForm(FlaskForm):
    """Form for registering a new user.
    """
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    password = PasswordField("Password", validators=[DataRequired()])
    password2 = PasswordField("Password (Confirmation)", validators=[DataRequired(), EqualTo('password', message='Passwords must match.')])
    submit = SubmitField("Sign up")

    def validate_email(self, field):
        if User.query.filter_by(email=field.data).first():
            raise ValidationError("Email is already in use.")
        
class FeedbackForm(FlaskForm):
    """Form for providing feedback.
    """
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    feedback = TextAreaField("Feedback", validators=[DataRequired()])
    submit = SubmitField("Send feedback")

class RequestConfirmationEmailForm(FlaskForm):
    """Form for requesting sending a new confirmation email. This is separate
    from the automatic confirmation email sent during registration.
    """
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    submit = SubmitField("Request email")

class RequestPasswordResetEmailForm(FlaskForm):
    """Form for requesting a password reset link be sent to email 
    (in case of forgotten password).
    """
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    submit = SubmitField("Request email")

class PasswordResetForm(FlaskForm):
    """Form for password reset (in case of forgotten password).
    """
    password = PasswordField("Password", validators=[DataRequired()])
    password2 = PasswordField("Password (Confirmation)", validators=[DataRequired(), EqualTo('password', message='Passwords must match.')])
    submit = SubmitField("Set password")

class PasswordChangeForm(FlaskForm):
    """Form for changing the current password for current_user.
    """
    password_current = PasswordField("Password", validators=[DataRequired()])
    password_new = PasswordField("New Password", validators=[DataRequired()])
    password_new2 = PasswordField("New Password (Confirmation)", validators=[DataRequired(), EqualTo('password_new', message='Passwords must match.')])
    submit = SubmitField("Change password")

    def validate_password_current(self, field):
        if not current_user.verify_password(field.data):
            raise ValidationError('Incorrect password.')