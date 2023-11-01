# gunicorn --bind=0.0.0.0 --timeout 600 run:app
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=False)
