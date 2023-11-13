from flask import current_app
from cryptography.fernet import Fernet, InvalidToken
import json, datetime

def encrypt(obj, duration_seconds=None) -> str:
    """Encrypts a JSON-serializable object into base 64 string. 
    The token is valid for duration_seconds seconds or forever if argument is None.
    """
    key = current_app.config.get("SECRET_KEY")
    f = Fernet(key)
    obj_s = json.dumps(obj)
    expiry = 0
    if duration_seconds is not None:
        expiry = int(datetime.datetime.now().timestamp()) + duration_seconds 
    wrap = {"c": obj_s, "e": expiry}
    wrap_s = json.dumps(wrap)
    return f.encrypt(wrap_s.encode("utf-8")).decode("utf-8")

def decrypt(token: str):
    """Inverse to encrypt. Returns the original object or None if token 
    is invalid or has expired.
    """
    key = current_app.config.get("SECRET_KEY")
    f = Fernet(key)
    try:
        wrap_s = f.decrypt(token.encode("utf-8")).decode("utf-8") 
    except InvalidToken:
        return None
    wrap = json.loads(wrap_s)
    expiry = wrap["e"]
    now = datetime.datetime.now().timestamp()
    if (expiry != 0) and (now > expiry):
        return None     # Token expired
    return json.loads(wrap["c"])