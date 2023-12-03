import os, sys, json, logging, traceback
from functools import partial
import datetime
from flask_sqlalchemy import SQLAlchemy

basedir = os.path.abspath(os.path.dirname(__file__))

class TrimmableFileHandler(logging.FileHandler):
    """FileHandler but also trims the log file if it gets too big by deleting 
    older log entries.
    """
    def __init__(self, filename, max_size_mb=1.0):
        super().__init__(filename)
        try:
            if os.path.getsize(self.baseFilename) > max_size_mb*1024*1024:
                self.trim(max_size_mb)
        except Exception as e:
            print(f"Error during file trimming in TrimmableFileHandler, file: {filename}. {e}")

    def trim(self, max_size_mb):
        # Read lines from the end of the file:
        lines = []
        with open(self.baseFilename, "r", encoding="utf-8") as f:
            size = 0
            for line in f:
                size += len(line) + 1
                if size > 0.75*max_size_mb*1024*1024:
                    lines.append(line)
        # Write lines:
        with open(self.baseFilename, "w", encoding="utf-8") as f:
            f.writelines(lines)

class JSONLogFormatter(logging.Formatter):
    """Class to make Exceptions machine readable.
    """
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record),
            'name': record.name,
            'level': record.levelname,
            'message': record.getMessage(),
            'extra': record._extra,
        }
        # Check if the log record is an exception and include additional details
        if record.exc_info:
            exception_type, exception_message, tb = record.exc_info
            log_data['exception_type'] = str(exception_type)
            log_data['exception_message'] = str(exception_message)
            log_data['traceback'] = traceback.format_list(traceback.extract_tb(tb))
        json_log_entry = json.dumps(log_data)

        # sys.stderr.write(json_log_entry)
        # sys.stderr.flush()
        # print(json_log_entry, flush=True)   # print outputs to log stream on Azure

        return json_log_entry

def get_logger(name: str) -> logging.Logger:
    """Returns a custom logger that writes entries to a file in machine readable JSON format.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)   # Change if you get spammed

    # Create a hook for unhandled top level exceptions:
    def unhandled_exception_handler(exc_type, exc_value, exc_tb):
        logger.error("Uncaught exception", exc_info=(exc_type, exc_value, exc_tb))

    def init_app(app):
        """Initialized logger to write to file specified in config variable LOG_FILE_NAME.
        """
        file_name = f"{app.config.get('LOG_FILE_DIRECTORY', '')}/tba.log"
        handler = TrimmableFileHandler(file_name)
        formatter = JSONLogFormatter()
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    def make_record_with_extra(self, name, level, fn, lno, msg, args, exc_info, func=None, extra=None, sinfo=None):
        record = self.original_makeRecord(name, level, fn, lno, msg, args, exc_info, func, extra, sinfo)
        record._extra = extra
        return record

    # Modify makeRecord so that we save extra as _extra. This allows us to write
    # the extra parameter in the json file.
    logger.original_makeRecord = logger.makeRecord
    logger.makeRecord = partial(make_record_with_extra, logger)

    sys.excepthook = unhandled_exception_handler

    logger.init_app = init_app

    return logger

def initialize_directories():
    """Creates log directory if it does not exist yet.
    """
    if not os.path.exists(f"{load.get('LOG_FILE_DIRECTORY', '.')}/"):
        os.mkdir(f"{load.get('LOG_FILE_DIRECTORY', '.')}/")
    if not os.path.exists(f"{load.get('DIAGRAM_FILE_DIRECTORY', '.')}/"):
        os.mkdir(f"{load.get('DIAGRAM_FILE_DIRECTORY', '.')}/")

def initialize_sqlalchemy_loggers(load):
    """Sets up logging for sqlalchemy and sqlalchemy.engine.
    """
    # Setting up logging for sqlalchemy:
    sqlalchemy_logger = logging.getLogger('sqlalchemy')
    sqlalchemy_logger.setLevel(logging.DEBUG)
    log_file = f"{load.get('LOG_FILE_DIRECTORY', '.')}/sqlalchemy.log"
    handler = TrimmableFileHandler(log_file)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    sqlalchemy_logger.addHandler(handler)

    # Setting up logging for sqlalchemy.engine:
    sqlalchemy_engine_logger = logging.getLogger('sqlalchemy.engine')
    sqlalchemy_engine_logger.setLevel(logging.DEBUG)
    log_file = f"{load.get('LOG_FILE_DIRECTORY', '')}/sqlalchemy_engine.log"
    handler = TrimmableFileHandler(log_file)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    sqlalchemy_engine_logger.addHandler(handler)

def load_raw_app_settings():
    """Loads environment variables from a file if it exists (localhost), 
    otherwise uses os.environ settings.
    """
    file_path = 'd:/projects/tba/localhost_settings.json'
    if os.path.exists(file_path):
        with open(file_path, 'r') as json_file:
            settings = json.load(json_file)
    else:
        settings = {}
        for key, value in os.environ.items():
            settings[key] = value
    return settings

load = load_raw_app_settings()
esp = load.get("EMAIL_SERVICE_PROVIDER", "")

class Config:
    SITE = load.get("SITE", "")
    SECRET_KEY = load.get("SECRET_KEY", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LOG_FILE_DIRECTORY = load.get('LOG_FILE_DIRECTORY', '.')
    DIAGRAM_FILE_DIRECTORY = load.get('DIAGRAM_FILE_DIRECTORY', '.')
    EMAIL_SERVICE_PROVIDER = esp
    APP_START_TIME = datetime.datetime.now()

    @staticmethod
    def init_app(app):
        initialize_directories()
        initialize_sqlalchemy_loggers(load)


for name in ["SERVER", "PORT", "USE_TLS", "SENDER", "USERNAME", "PASSWORD"]:
    setattr(Config, f"MAIL_{name}", load.get(f"{esp}_MAIL_{name}", ""))
Config.MAIL_PORT = int(Config.MAIL_PORT or "0")
Config.MAIL_USE_TLS = Config.MAIL_USE_TLS if isinstance(Config.MAIL_USE_TLS, bool) else \
    (Config.MAIL_USE_TLS.lower() == "true")
Config.MAIL_USE_SSL = not Config.MAIL_USE_TLS

db_url = load.get("DATABASE_URL", "")
db_name = load.get("DATABASE_NAME", "")

class DevelopmentConfig(Config):
    SQLALCHEMY_DATABASE_URI = db_url+"/"+db_name if db_url else ("sqlite:///" + os.path.join(basedir, f"{db_name}-dev.sqlite"))
    CONFIG_SETTING = "development"

class TestingConfig(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    CONFIG_SETTING = "testing"

class ProductionConfig(Config):
    SQLALCHEMY_DATABASE_URI = db_url+"/"+db_name if db_url else ("sqlite://" + os.path.join(basedir, f"{db_name}.sqlite"))
    CONFIG_SETTING = "production"
    
def getConfig(config_name):
    config = {
        "development": DevelopmentConfig,
        "testing": TestingConfig,
        "production": ProductionConfig,
    }
    return config.get(config_name, DevelopmentConfig)
