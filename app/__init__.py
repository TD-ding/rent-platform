import sqlite3
import os
from flask import Flask, g, current_app
from config import BASE_DIR


def create_app():
    app = Flask(__name__,
                template_folder=os.path.join(BASE_DIR, 'templates'),
                static_folder=os.path.join(BASE_DIR, 'static'))
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['DATABASE'] = os.path.join(BASE_DIR, 'rental.db')

    app.teardown_appcontext(close_db)

    from .routes import main_bp
    from .auth import auth_bp
    from .admin import admin_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(admin_bp, url_prefix='/admin')

    with app.app_context():
        init_db()

    return app


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            phone TEXT,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS houses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            address TEXT NOT NULL,
            price REAL NOT NULL,
            area REAL,
            rooms INTEGER,
            house_type TEXT,
            floor_info TEXT,
            orientation TEXT,
            decoration TEXT,
            facilities TEXT,
            images TEXT DEFAULT '[]',
            status TEXT DEFAULT 'available',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            house_id INTEGER NOT NULL,
            contact_name TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (house_id) REFERENCES houses(id)
        );
    ''')

    # Seed admin user if not exists
    cursor = db.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
    if cursor.fetchone()[0] == 0:
        from werkzeug.security import generate_password_hash
        db.execute(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            ('admin', generate_password_hash('admin123'), 'admin')
        )

    # Seed sample houses if empty
    cursor = db.execute('SELECT COUNT(*) FROM houses')
    if cursor.fetchone()[0] == 0:
        sample_houses = [
            ('阳光花园精装两室一厅', '精装修，家电齐全，拎包入住。紧邻地铁口，交通便利。', '北京市朝阳区阳光花园小区3号楼501', 5500, 85, 2, '两室一厅', '5/18', '南北通透', '精装修',
             '["空调","洗衣机","冰箱","热水器","宽带"]'),
            ('望京SOHO一居室', '现代简约风格，全新家电家具，24小时安保。', '北京市朝阳区望京SOHO T1-1208', 4800, 55, 1, '一室一厅', '12/28', '朝南', '精装修',
             '["空调","洗衣机","冰箱","热水器","宽带","衣柜"]'),
            ('海淀学区房三居室', '临近多所名校，适合陪读家庭，小区环境优美。', '北京市海淀区中关村南大街22号', 8500, 120, 3, '三室一厅', '6/6', '南北通透', '中装修',
             '["空调","洗衣机","冰箱","热水器","宽带","衣柜","书桌"]'),
            ('通州地铁旁两居室', '紧邻八通线，新装修，首次出租，价格优惠。', '北京市通州区梨园地铁站旁翠屏北里', 3200, 78, 2, '两室一厅', '3/22', '朝南', '简装修',
             '["空调","洗衣机","热水器"]'),
            ('西直门商务公寓', '精装公寓式住宅，适合商务人士，拎包入住。', '北京市西城区西直门外大街18号', 6800, 65, 1, '一室一厅', '15/20', '朝东', '豪华装修',
             '["空调","洗衣机","冰箱","热水器","宽带","衣柜","微波炉","烤箱"]'),
            ('丰台万达广场旁两居', '紧邻万达广场，生活便利，小区绿化好。', '北京市丰台区丰台万达广场南侧', 4200, 90, 2, '两室两厅', '8/25', '南北通透', '中装修',
             '["空调","洗衣机","冰箱","热水器","宽带"]'),
        ]
        db.executemany(
            'INSERT INTO houses (title, description, address, price, area, rooms, house_type, floor_info, orientation, decoration, facilities) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            sample_houses
        )

    db.commit()
