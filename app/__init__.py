import os
from flask import Flask
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy
from flask_bootstrap import Bootstrap5
from flask_login import LoginManager
import config

mail = Mail()
bootstrap = Bootstrap5()
db = SQLAlchemy()
logger = config.get_logger(__name__)
login_manager = LoginManager()
login_manager.login_view = "auth.login_route"

def create_app():
    config_name = os.environ.get("FLASK_ENV", "default")
    print("config_name:", config_name)
    
    app = Flask(__name__)
    
    app.config.from_object(config.getConfig(config_name))
    print(app.config)
    mail.init_app(app)
    bootstrap.init_app(app)
    db.init_app(app)
    logger.init_app(app)
    login_manager.init_app(app)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint, ur_prefix="/auth")

    return app