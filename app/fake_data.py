import numpy as np
from faker import Faker
from faker.providers import BaseProvider
from sqlalchemy.exc import IntegrityError
from . import db
from .models import *

class BooleanProvider(BaseProvider):
    def boolean(self, p=0.5) -> bool:
        return (np.random.rand() < p)

class ShotProvider(BaseProvider):
    # Add random ball locations, etc. here
    def shot(self) -> str:
        return None

def fake_roles():
    for role_name in ["Admin", "Moderator", "User"]:
        role = Role(name=role_name)
        db.session.add(role)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()

def _add_user(user):
    db.session.add(user)
    try:
        db.session.commit()
        return True
    except IntegrityError:
        db.session.rollback()
    return False

def fake_users(count=50):
    user_role = Role.query.filter_by(name='User').first()
    moderator_role = Role.query.filter_by(name='Moderator').first()
    admin_role = Role.query.filter_by(name='Admin').first()

    admin_user = User(email="admin@example.com", password="admin", is_confirmed=True, is_active=True, role=admin_role)
    _add_user(admin_user)

    fake = Faker(["fi_FI"])
    fake.add_provider(BooleanProvider)
    while count > 1:
        role = moderator_role if fake.boolean(0.1) else user_role
        user = User(email=fake.email(), password="password", is_confirmed=fake.boolean(0.8), 
                    is_active=fake.boolean(0.9), role=role)
        if _add_user(user):
            count -= 1

def fake_shots(count=10):
    fake = Faker(["en_US", "fi_FI"])
    # fake.add_provider(ShotProvider)   # does not work on multiple provider mode