import os, logging
from flask import Flask
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy
from flask_bootstrap import Bootstrap5
from flask_login import LoginManager
from sqlalchemy.pool import NullPool, SingletonThreadPool
from .messenger import Messenger
import config

mail = Mail()
bootstrap = Bootstrap5()
# db = SQLAlchemy()
db = SQLAlchemy(
    engine_options={
        # "poolclass": SingletonThreadPool,
        "pool_pre_ping": True,          # Detect and remove stale connections
        # "pool_pre_ping_timeout": 5,    # Sets timeout to pre ping
        "pool_recycle": 120,           # maximum number of seconds a connection can persist
        "pool_timeout": 10,             # Maximum time to wait for a connection
        "pool_size": 5,                 # Set the pool size
        "max_overflow": 5,              # Allow additional connections
        "pool_reset_on_return": True,    # Resets connection when returned to pool
        'connect_args': { 
            'connect_timeout': 5        # Set connection timeout
        }
    }
)
# db = SQLAlchemy(
#     engine_options={
#         "poolclass": NullPool,
#     }
# )
logger = config.get_logger(__name__)
login_manager = LoginManager()
login_manager.login_view = "userkit.login"
messenger = Messenger()

def create_app():
    app = Flask(__name__)

    config_name = os.environ.get("FLASK_ENV", "default")
    current_config = config.getConfig(config_name)
    current_config.init_app(app)
    app.config.from_object(current_config)

    mail.init_app(app)
    bootstrap.init_app(app)
    db.init_app(app)
    logger.init_app(app)
    login_manager.init_app(app)
    current_config.init_app(app)
    messenger.init_app(app)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .userkit import userkit as userkit_blueprint
    app.register_blueprint(userkit_blueprint, url_prefix="/userkit")

    return app