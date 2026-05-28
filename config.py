import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
DEBUG = os.environ.get('FLASK_DEBUG', '1') == '1'
