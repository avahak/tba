# Note: avoid having possibly conflicting names, such as app.py and folder app/, see
# https://stackoverflow.com/questions/50157243/error-gunicorn-failed-to-find-application-object-app-in-app
# gunicorn --bind=0.0.0.0 --timeout 600 run:app
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=False)
