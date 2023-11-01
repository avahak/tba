import os
from flask import Flask
from flask_mail import Mail
import config

mail = Mail()
logger = config.get_logger(__name__)

def create_app():
    config_name = os.environ.get("FLASK_ENV", "default")
    print("config_name:", config_name)
    
    app = Flask(__name__)
    
    app.config.from_object(config.getConfig(config_name))
    mail.init_app(app)
    logger.init_app(app)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app