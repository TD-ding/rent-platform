import csv
import io
import json
from flask import Blueprint, request, jsonify, render_template, Response
from . import get_db
from .auth import admin_required

admin_bp = Blueprint('admin', __name__)


def _parse_house(row):
    house = dict(row)
    house['facilities'] = json.loads(house.get('facilities', '[]'))
    house['images'] = json.loads(house.get('images', '[]'))
    return house


@admin_bp.route('/dashboard')
def dashboard():
    return render_template('admin.html')


@admin_bp.route('/api/stats', methods=['GET'])
@admin_required
def stats():
    db = get_db()
    houses = db.execute('SELECT COUNT(*) FROM houses').fetchone()[0]
    users = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    appointments = db.execute('SELECT COUNT(*) FROM appointments').fetchone()[0]
    pending = db.execute(
        'SELECT COUNT(*) FROM appointments WHERE status = "pending"'
    ).fetchone()[0]
    return jsonify({
        'houses': houses, 'users': users,
        'appointments': appointments, 'pending': pending
    })


@admin_bp.route('/api/users', methods=['GET'])
@admin_required
def list_users():
    db = get_db()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 15, type=int)
    offset = (page - 1) * per_page

    total = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    users = db.execute(
        'SELECT id, username, role, phone, email, created_at '
        'FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        (per_page, offset)
    ).fetchall()

    return jsonify({
        'items': [dict(u) for u in users],
        'total': total, 'page': page,
        'pages': (total + per_page - 1) // per_page
    })


@admin_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    db = get_db()
    user = db.execute(
        'SELECT * FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    if user['role'] == 'admin':
        return jsonify({'error': '不能删除管理员'}), 400
    db.execute('DELETE FROM appointments WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    return jsonify({'message': '用户已删除'})


@admin_bp.route('/api/users/<int:user_id>/role', methods=['PUT'])
@admin_required
def update_user_role(user_id):
    data = request.get_json()
    new_role = data.get('role')
    if new_role not in ('user', 'admin'):
        return jsonify({'error': '无效角色'}), 400
    db = get_db()
    db.execute(
        'UPDATE users SET role = ? WHERE id = ?', (new_role, user_id)
    )
    db.commit()
    return jsonify({'message': '角色已更新'})


@admin_bp.route('/api/houses', methods=['POST'])
@admin_required
def create_house():
    data = request.get_json()
    required = ['title', 'address', 'price']
    if not all(data.get(f) for f in required):
        return jsonify({'error': '标题、地址、价格为必填项'}), 400

    db = get_db()
    db.execute(
        'INSERT INTO houses '
        '(title, description, address, price, area, rooms, house_type, '
        'floor_info, orientation, decoration, facilities, images) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (
            data['title'], data.get('description', ''), data['address'],
            data['price'], data.get('area'), data.get('rooms'),
            data.get('house_type'), data.get('floor_info'),
            data.get('orientation'), data.get('decoration'),
            json.dumps(data.get('facilities', []), ensure_ascii=False),
            json.dumps(data.get('images', []), ensure_ascii=False)
        )
    )
    db.commit()
    return jsonify({'message': '房源创建成功'}), 201


@admin_bp.route('/api/houses/<int:house_id>', methods=['GET'])
@admin_required
def get_house(house_id):
    db = get_db()
    house = db.execute(
        'SELECT * FROM houses WHERE id = ?', (house_id,)
    ).fetchone()
    if not house:
        return jsonify({'error': '房源不存在'}), 404
    return jsonify(_parse_house(house))


@admin_bp.route('/api/houses/<int:house_id>', methods=['PUT'])
@admin_required
def update_house(house_id):
    data = request.get_json()
    db = get_db()
    house = db.execute(
        'SELECT id FROM houses WHERE id = ?', (house_id,)
    ).fetchone()
    if not house:
        return jsonify({'error': '房源不存在'}), 404

    fields = []
    params = []
    for key in ['title', 'description', 'address', 'price', 'area',
                'rooms', 'house_type', 'floor_info', 'orientation',
                'decoration', 'status']:
        if key in data:
            fields.append(f'{key} = ?')
            params.append(data[key])

    if 'facilities' in data:
        fields.append('facilities = ?')
        params.append(
            json.dumps(data['facilities'], ensure_ascii=False)
        )
    if 'images' in data:
        fields.append('images = ?')
        params.append(
            json.dumps(data['images'], ensure_ascii=False)
        )

    if fields:
        params.append(house_id)
        db.execute(
            f'UPDATE houses SET {", ".join(fields)} WHERE id = ?',
            params
        )
        db.commit()

    return jsonify({'message': '房源更新成功'})


@admin_bp.route('/api/houses/<int:house_id>', methods=['DELETE'])
@admin_required
def delete_house(house_id):
    db = get_db()
    db.execute(
        'DELETE FROM appointments WHERE house_id = ?', (house_id,)
    )
    db.execute('DELETE FROM houses WHERE id = ?', (house_id,))
    db.commit()
    return jsonify({'message': '房源已删除'})


@admin_bp.route('/api/houses', methods=['GET'])
@admin_required
def list_houses():
    db = get_db()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 15, type=int)
    offset = (page - 1) * per_page

    total = db.execute('SELECT COUNT(*) FROM houses').fetchone()[0]
    houses = db.execute(
        'SELECT * FROM houses ORDER BY created_at DESC '
        'LIMIT ? OFFSET ?',
        (per_page, offset)
    ).fetchall()

    return jsonify({
        'items': [_parse_house(h) for h in houses],
        'total': total, 'page': page,
        'pages': (total + per_page - 1) // per_page
    })


@admin_bp.route('/api/appointments', methods=['GET'])
@admin_required
def list_appointments():
    db = get_db()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 15, type=int)
    offset = (page - 1) * per_page

    total = db.execute('SELECT COUNT(*) FROM appointments').fetchone()[0]
    appointments = db.execute('''
        SELECT a.*, h.title as house_title, h.address as house_address,
               u.username as user_name
        FROM appointments a
        JOIN houses h ON a.house_id = h.id
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    ''', (per_page, offset)).fetchall()

    return jsonify({
        'items': [dict(a) for a in appointments],
        'total': total, 'page': page,
        'pages': (total + per_page - 1) // per_page
    })


@admin_bp.route('/api/appointments/<int:apt_id>/status', methods=['PUT'])
@admin_required
def update_appointment_status(apt_id):
    data = request.get_json()
    status = data.get('status')
    if status not in ('confirmed', 'cancelled', 'completed'):
        return jsonify({'error': '无效状态'}), 400
    db = get_db()
    db.execute(
        'UPDATE appointments SET status = ? WHERE id = ?',
        (status, apt_id)
    )
    db.commit()
    return jsonify({'message': '状态已更新'})


# --- CSV Export ---

@admin_bp.route('/api/export/users', methods=['GET'])
@admin_required
def export_users():
    db = get_db()
    users = db.execute(
        'SELECT id, username, role, phone, email, created_at '
        'FROM users ORDER BY created_at DESC'
    ).fetchall()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['ID', '用户名', '角色', '手机', '邮箱', '注册时间'])
    for u in users:
        writer.writerow([
            u['id'], u['username'], u['role'],
            u['phone'] or '', u['email'] or '', u['created_at']
        ])
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=users.csv'
        }
    )


@admin_bp.route('/api/export/appointments', methods=['GET'])
@admin_required
def export_appointments():
    db = get_db()
    appointments = db.execute('''
        SELECT a.id, u.username, h.title as house_title,
               h.address as house_address,
               a.contact_name, a.contact_phone,
               a.appointment_time, a.status, a.message, a.created_at
        FROM appointments a
        JOIN houses h ON a.house_id = h.id
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
    ''').fetchall()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        'ID', '用户', '房源', '地址', '联系人', '电话',
        '预约时间', '状态', '留言', '提交时间'
    ])
    for a in appointments:
        status_map = {
            'pending': '待确认', 'confirmed': '已确认',
            'cancelled': '已取消', 'completed': '已完成'
        }
        writer.writerow([
            a['id'], a['username'], a['house_title'],
            a['house_address'], a['contact_name'],
            a['contact_phone'], a['appointment_time'],
            status_map.get(a['status'], a['status']),
            a['message'] or '', a['created_at']
        ])
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=appointments.csv'
        }
    )


# --- Inquiries management ---

@admin_bp.route('/api/inquiries', methods=['GET'])
@admin_required
def list_inquiries():
    db = get_db()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 15, type=int)
    offset = (page - 1) * per_page

    total = db.execute('SELECT COUNT(*) FROM inquiries').fetchone()[0]
    rows = db.execute('''
        SELECT i.*, u.username, h.title as house_title
        FROM inquiries i
        JOIN users u ON i.user_id = u.id
        JOIN houses h ON i.house_id = h.id
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
    ''', (per_page, offset)).fetchall()

    return jsonify({
        'items': [dict(r) for r in rows],
        'total': total, 'page': page,
        'pages': (total + per_page - 1) // per_page
    })


@admin_bp.route('/api/inquiries/<int:inq_id>/reply', methods=['PUT'])
@admin_required
def reply_inquiry(inq_id):
    data = request.get_json()
    reply = data.get('reply', '').strip()
    if not reply:
        return jsonify({'error': '请输入回复内容'}), 400
    db = get_db()
    db.execute(
        'UPDATE inquiries SET reply = ? WHERE id = ?',
        (reply, inq_id)
    )
    db.commit()
    return jsonify({'message': '回复成功'})
