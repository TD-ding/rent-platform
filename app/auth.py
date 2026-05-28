import time
from collections import defaultdict
from functools import wraps
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from . import get_db

auth_bp = Blueprint('auth', __name__)

_login_attempts = defaultdict(list)
ATTEMPT_WINDOW = 300
MAX_ATTEMPTS = 5


def _check_rate_limit(ip):
    now = time.time()
    attempts = _login_attempts[ip]
    _login_attempts[ip] = [t for t in attempts if now - t < ATTEMPT_WINDOW]
    return len(_login_attempts[ip]) >= MAX_ATTEMPTS


def _record_attempt(ip):
    _login_attempts[ip].append(time.time())


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated


@auth_bp.route('/register', methods=['POST'])
def register():
    ip = request.remote_addr
    if _check_rate_limit('reg:' + ip):
        return jsonify({'error': '操作过于频繁，请稍后再试'}), 429

    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(username) < 3:
        return jsonify({'error': '用户名至少3个字符'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码至少6个字符'}), 400

    db = get_db()
    existing = db.execute(
        'SELECT id FROM users WHERE username = ?', (username,)
    ).fetchone()
    if existing:
        return jsonify({'error': '用户名已存在'}), 400

    _record_attempt('reg:' + ip)
    db.execute(
        'INSERT INTO users (username, password_hash, phone, email) '
        'VALUES (?, ?, ?, ?)',
        (username, generate_password_hash(password), phone, email)
    )
    db.commit()
    return jsonify({'message': '注册成功'}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    ip = request.remote_addr
    if _check_rate_limit(ip):
        return jsonify({'error': '尝试次数过多，请5分钟后再试'}), 429

    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')

    _record_attempt(ip)

    db = get_db()
    user = db.execute(
        'SELECT * FROM users WHERE username = ?', (username,)
    ).fetchone()
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': '用户名或密码错误'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']
    _login_attempts.pop(ip, None)
    return jsonify({
        'message': '登录成功',
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'phone': user['phone'],
            'email': user['email']
        }
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': '已退出登录'})


@auth_bp.route('/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'user': None})
    db = get_db()
    user = db.execute(
        'SELECT * FROM users WHERE id = ?', (session['user_id'],)
    ).fetchone()
    if not user:
        session.clear()
        return jsonify({'user': None})
    return jsonify({
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'phone': user['phone'],
            'email': user['email']
        }
    })
