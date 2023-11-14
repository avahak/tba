from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin, AnonymousUserMixin
from . import db, login_manager, logger
from .tokens import *

class Role(db.Model):
    """Available roles: User, Moderator, Admin
    """
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True)
    users = db.relationship('User', backref='role', lazy='dynamic')

    def __repr__(self):
        return f"Role({self.name})"
    
    @classmethod
    def get_role(cls, name):
        return cls.query.filter_by(name=name).first()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(64), unique=True, index=True)
    password_hash = db.Column(db.String(255))
    is_confirmed = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), index=True)

    @property
    def password(self):
        raise AttributeError('Password is not a readable.')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f"User(email={self.email}, role={self.role.name}, is_confirmed={self.is_confirmed}, is_active={self.is_active})"
    
    def can_act_as(self, role):
        if role == "Moderator":
            return (self.role.name == "Moderator") or (self.role.name == "Admin")
        if role == "Admin":
            return (self.role.name == "Admin")
        return True

    def generate_confirmation_token(self, duration_seconds=3600):
        token = encrypt({ "confirm": self.id }, duration_seconds)
        logger.info("Created confirmation token", extra={ "user": str(self), "token": token })
        return token

    @classmethod
    def confirm(cls, token):
        """If token is valid, confirms the user in question and returns the user.
        Otherwise returns None.
        """
        obj = decrypt(token)
        if (obj is None) or ("confirm" not in obj):
            return None
        user_id = obj["confirm"]
        user = load_user(user_id)
        if user is None:
            return None
        user.is_confirmed = True
        db.session.add(user)
        db.session.commit()
        return user
    
class AnonymousUser(AnonymousUserMixin):
    def can_act_as(self, role):
        return False
    
    def __str__(self):
        return "AnonymousUser"
    
login_manager.anonymous_user = AnonymousUser
    
# Required by LoginManager:
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))