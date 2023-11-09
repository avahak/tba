import signal
from functools import wraps
from flask import url_for, redirect

pass

# def timeout(timeout_seconds, redirect_route="main.error_504"):
#     """Time the function and redirects upon timeout"""
#     def decorator(fn):
#         @wraps(fn)
#         def wrapper(*args, **kwargs):
#             def timeout_handler(signum, frame):
#                 raise TimeoutError("Request execution timed out")

#             # Register the timeout handler function
#             signal.signal(signal.SIGPIPE, timeout_handler)
#             signal.alarm(timeout_seconds)

#             try:
#                 result = fn(*args, **kwargs)
#                 return result
#             except TimeoutError:
#                 # Handle the timeout case by redirecting
#                 return redirect(url_for(redirect_route))
#             finally:
#                 # Disable the timeout signal
#                 signal.alarm(0)
#         return wrapper
#     return decorator
