from flask import redirect, url_for
from flask_login import current_user
import threading
from functools import wraps

def can_act_as_required(role_name):
    """Decorator to check that current_user can act as the specified role.
    If not, the user is redirected to frontpage.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not current_user.can_act_as(role_name):
                return redirect(url_for("main.front"))
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def timeout(timeout_seconds, timeout_return_value=None):
    """Returns wrapped function return value if executed before timeout, otherwise
    timeout_return_value. NOTE! The wrapped function is executed fully in both cases,
    just the return value is not used in case of timeout.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = timeout_return_value
            exception = None

            def worker():
                nonlocal result, exception
                try:
                    result = fn(*args, **kwargs)
                except Exception as e:
                    exception = e

            code_thread = threading.Thread(target=worker)
            
            code_thread.start()
            # Wait for the thread to complete or time out:
            code_thread.join(timeout_seconds)
            # If the thread is still alive after the timeout, raise TimeoutError:
            if code_thread.is_alive():
                # Request execution timed out:
                result = timeout_return_value
                return result
            elif exception:
                # If there was an exception during execution, re-raise it:
                raise exception
            else:
                return result

        return wrapper
    return decorator

@timeout(1.0, "Timeout!")
def test_hangup(hangup_secs):
    import time
    print(f"Starting test_hangup for {hangup_secs} seconds.", flush=True)
    time.sleep(hangup_secs)
    print(f"Ending test_hangup without interruption.", flush=True)
    return 42

if __name__ == "__main__":
    value = test_hangup(2)
    print(f"Return value is {value}.")
