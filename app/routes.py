import json
from flask import Blueprint, request, jsonify, session
from . import get_db
from .auth import login_required

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    from flask import render_template
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
        'INSERT INTO appointments (user_id, house_id, contact_name, contact_phone, appointment_time, message) VALUES (?, ?, ?, ?, ?, ?)',
        (session['user_id'], house_id, contact_name, contact_phone, appointment_time, message)
    )
    db.commit()
    return jsonify({'message': '预约成功'}), 201


@main_bp.route('/api/appointments', methods=['GET'])
@login_required
def my_appointments():
    db = get_db()
    appointments = db.execute('''
        SELECT a.*, h.title as house_title, h.address as house_address, h.price as house_price, h.image_url
        FROM appointments a
        JOIN houses h ON a.house_id = h.id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
    ''', (session['user_id'],)).fetchall()
    return jsonify([dict(a) for a in appointments])
