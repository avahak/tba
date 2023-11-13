from flask_wtf import FlaskForm 
from wtforms import *
from wtforms.validators import *
from ..models import User

class LoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    password = PasswordField("Password", validators=[DataRequired()])
    remember_me = BooleanField("Remember me")
    submit = SubmitField("Log In")

class RegistrationForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Length(1, 64)])
    password = PasswordField("Password", validators=[DataRequired()])
    password2 = PasswordField("Password (Confirmation)", validators=[DataRequired()])
    submit = SubmitField("Log In")

    def validate_email(self, field):
        if User.query.filter_by(email=field.data).first():
            raise ValidationError("Email is already in use.")