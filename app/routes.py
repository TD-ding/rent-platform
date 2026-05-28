import json
from flask import Blueprint, request, jsonify, session, render_template
from . import get_db
from .auth import login_required


main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    return render_template('index.html')


@main_bp.route('/api/houses', methods=['GET'])
def list_houses():
    db = get_db()
    query = request.args.get('q', '').strip()
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    rooms = request.args.get('rooms', type=int)
    house_type = request.args.get('house_type', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 9, type=int)

    sql = 'SELECT * FROM houses WHERE status = "available"'
    params = []

    if query:
        sql += ' AND (title LIKE ? OR address LIKE ? OR description LIKE ?)'
        params.extend([f'%{query}%'] * 3)
    if min_price is not None:
        sql += ' AND price >= ?'
        params.append(min_price)
    if max_price is not None:
        sql += ' AND price <= ?'
        params.append(max_price)
    if rooms:
        sql += ' AND rooms = ?'
        params.append(rooms)
    if house_type:
        sql += ' AND house_type = ?'
        params.append(house_type)

    sql += ' ORDER BY created_at DESC'

    total = db.execute('SELECT COUNT(*) FROM (' + sql + ')', params).fetchone()[0]

    offset = (page - 1) * per_page
    sql += ' LIMIT ? OFFSET ?'
    params.extend([per_page, offset])

    houses = db.execute(sql, params).fetchall()
    result = []
    for h in houses:
        house = dict(h)
        house['facilities'] = json.loads(house.get('facilities', '[]'))
        house['images'] = json.loads(house.get('images', '[]'))
        result.append(house)

    return jsonify({
        'houses': result,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    })


@main_bp.route('/api/houses/<int:house_id>', methods=['GET'])
def get_house(house_id):
    db = get_db()
    house = db.execute('SELECT * FROM houses WHERE id = ?', (house_id,)).fetchone()
    if not house:
        return jsonify({'error': '房源不存在'}), 404
    result = dict(house)
    result['facilities'] = json.loads(result.get('facilities', '[]'))
    result['images'] = json.loads(result.get('images', '[]'))
    return jsonify(result)


@main_bp.route('/api/house-types', methods=['GET'])
def house_types():
    db = get_db()
    types = db.execute('SELECT DISTINCT house_type FROM houses WHERE house_type IS NOT NULL').fetchall()
    return jsonify([t['house_type'] for t in types])


@main_bp.route('/api/appointments', methods=['POST'])
@login_required
def create_appointment():
    data = request.get_json()
    house_id = data.get('house_id')
    contact_name = data.get('contact_name', '').strip()
    contact_phone = data.get('contact_phone', '').strip()
    appointment_time = data.get('appointment_time', '')
    message = data.get('message', '').strip()

    if not all([house_id, contact_name, contact_phone, appointment_time]):
        return jsonify({'error': '请填写完整的预约信息'}), 400

    db = get_db()
    house = db.execute('SELECT id FROM houses WHERE id = ? AND status = "available"', (house_id,)).fetchone()
    if not house:
        return jsonify({'error': '房源不存在或已下架'}), 404

    db.execute(
        'INSERT INTO appointments '
        '(user_id, house_id, contact_name, contact_phone, '
        'appointment_time, message) VALUES (?, ?, ?, ?, ?, ?)',
        (session['user_id'], house_id, contact_name,
         contact_phone, appointment_time, message)
    )
    db.commit()
    return jsonify({'message': '预约成功'}), 201


@main_bp.route('/api/appointments', methods=['GET'])
@login_required
def my_appointments():
    db = get_db()
    appointments = db.execute('''
        SELECT a.*, h.title as house_title, h.address as house_address,
               h.price as house_price, h.house_type, h.area,
               h.orientation, h.decoration
        FROM appointments a
        JOIN houses h ON a.house_id = h.id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
    ''', (session['user_id'],)).fetchall()
    return jsonify([dict(a) for a in appointments])


# --- Favorites ---

@main_bp.route('/api/favorites', methods=['GET'])
@login_required
def my_favorites():
    db = get_db()
    rows = db.execute('''
        SELECT h.* FROM favorites f
        JOIN houses h ON f.house_id = h.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    ''', (session['user_id'],)).fetchall()
    result = []
    for h in rows:
        house = dict(h)
        house['facilities'] = json.loads(house.get('facilities', '[]'))
        house['images'] = json.loads(house.get('images', '[]'))
        result.append(house)
    return jsonify(result)


@main_bp.route('/api/favorites/<int:house_id>', methods=['POST'])
@login_required
def add_favorite(house_id):
    db = get_db()
    house = db.execute(
        'SELECT id FROM houses WHERE id = ?', (house_id,)
    ).fetchone()
    if not house:
        return jsonify({'error': '房源不存在'}), 404
    try:
        db.execute(
            'INSERT INTO favorites (user_id, house_id) VALUES (?, ?)',
            (session['user_id'], house_id)
        )
        db.commit()
    except Exception:
        return jsonify({'message': '已收藏'})
    return jsonify({'message': '已收藏'})


@main_bp.route('/api/favorites/<int:house_id>', methods=['DELETE'])
@login_required
def remove_favorite(house_id):
    db = get_db()
    db.execute(
        'DELETE FROM favorites WHERE user_id = ? AND house_id = ?',
        (session['user_id'], house_id)
    )
    db.commit()
    return jsonify({'message': '已取消收藏'})


@main_bp.route('/api/favorites/check/<int:house_id>', methods=['GET'])
@login_required
def check_favorite(house_id):
    db = get_db()
    row = db.execute(
        'SELECT id FROM favorites WHERE user_id = ? AND house_id = ?',
        (session['user_id'], house_id)
    ).fetchone()
    return jsonify({'is_favorite': row is not None})


# --- Inquiries ---

@main_bp.route('/api/inquiries/<int:house_id>', methods=['POST'])
@login_required
def create_inquiry(house_id):
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': '请输入留言内容'}), 400
    db = get_db()
    house = db.execute(
        'SELECT id FROM houses WHERE id = ?', (house_id,)
    ).fetchone()
    if not house:
        return jsonify({'error': '房源不存在'}), 404
    db.execute(
        'INSERT INTO inquiries (user_id, house_id, content) '
        'VALUES (?, ?, ?)',
        (session['user_id'], house_id, content)
    )
    db.commit()
    return jsonify({'message': '留言成功'}), 201


@main_bp.route('/api/inquiries/<int:house_id>', methods=['GET'])
def list_inquiries(house_id):
    db = get_db()
    rows = db.execute('''
        SELECT i.*, u.username
        FROM inquiries i
        JOIN users u ON i.user_id = u.id
        WHERE i.house_id = ?
        ORDER BY i.created_at DESC
    ''', (house_id,)).fetchall()
    return jsonify([dict(r) for r in rows])
