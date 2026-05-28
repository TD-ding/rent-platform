import os
import sys

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DEBUG = os.environ.get('FLASK_DEBUG', '1') == '1'

_secret = os.environ.get('SECRET_KEY')
if not _secret:
    if DEBUG:
        _secret = 'dev-secret-key-do-not-use-in-production'
    else:
        print('ERROR: SECRET_KEY environment variable is required in production', file=sys.stderr)
        sys.exit(1)
SECRET_KEY = _secret
