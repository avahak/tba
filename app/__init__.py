import os
from flask import Flask
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy
from flask_bootstrap import Bootstrap5
from flask_login import LoginManager
from sqlalchemy.pool import NullPool
import config

mail = Mail()
bootstrap = Bootstrap5()
# db = SQLAlchemy()
db = SQLAlchemy(
    engine_options={
        "pool_pre_ping": True,          # Detect and remove stale connections
        # "pool_pre_ping_timeout": 5,     # Sets timeout to pre ping
        "pool_recycle": 3600,           # Recycle connections every hour
        "pool_timeout": 5,              # Maximum time to wait for a connection
        "pool_size": 10,                # Set the pool size to 10
        "max_overflow": 20,             # Allow up to 20 additional connections
        "pool_reset_on_return": True    # Resets connection when returned to pool
    }
)
# db = SQLAlchemy(
#     engine_options={
#         "poolclass": NullPool,
#     }
# )
logger = config.get_logger(__name__)
login_manager = LoginManager()
login_manager.login_view = "userkit.login_route"

def create_app():
    config_name = os.environ.get("FLASK_ENV", "default")
    print("config_name:", config_name)
    
    app = Flask(__name__)
    
    app.config.from_object(config.getConfig(config_name))
    mail.init_app(app)
    bootstrap.init_app(app)
    db.init_app(app)
    logger.init_app(app)
    login_manager.init_app(app)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .userkit import userkit as userkit_blueprint
    app.register_blueprint(userkit_blueprint, url_prefix="/userkit")

    return app