import threading
import time     # just for testing
from functools import wraps

def timeout(timeout_seconds, timeout_return_value=None):
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
            try:
                code_thread.start()
                # Wait for the thread to complete or time out:
                code_thread.join(timeout_seconds)
                # If the thread is still alive after the timeout, raise TimeoutError:
                if code_thread.is_alive():
                    # Request execution timed out:
                    result = timeout_return_value
                    raise TimeoutError
                elif exception:
                    # If there was an exception during execution, re-raise it:
                    raise exception
                else:
                    return result
            finally:
                # Ensure the thread is stopped:
                print("Finally", flush=True)
                # code_thread.join()

        return wrapper
    return decorator

@timeout(0.1, "Timeout!")
def test_hangup(hangup_secs):
    print(f"Starting test_hangup for {hangup_secs} seconds.", flush=True)
    time.sleep(hangup_secs)
    print(f"Ending test_hangup without interruption.", flush=True)
    return 42

if __name__ == "__main__":
    value = test_hangup(5)
    print(f"Return value is {value}.")
