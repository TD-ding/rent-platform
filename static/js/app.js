let currentPage = 1;

const houseIcons = ['🏠', '🏢', '🏡', '🏘️', '🏗️', '🌆'];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadHouses();
    loadHouseTypes();
});

async function checkAuth() {
    try {
        const data = await api('/auth/me');
        const user = data.user;
        if (user) {
            document.getElementById('navUser').textContent = user.username;
            document.getElementById('loginBtn').style.display = 'none';
            document.getElementById('registerBtn').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'block';
            if (user.role === 'admin') {
                const link = document.createElement('a');
                link.href = '/admin/dashboard';
                link.textContent = '管理后台';
                link.className = 'admin-link';
                document.querySelector('.nav-links').insertBefore(link, document.getElementById('userMenu'));
            }
        }
    } catch {}
}

async function login(e) {
    e.preventDefault();
    try {
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('loginUsername').value,
                password: document.getElementById('loginPassword').value
            })
        });
        showToast(data.message);
        closeModal('loginModal');
        checkAuth();
    } catch {}
}

async function register(e) {
    e.preventDefault();
    try {
        const data = await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('regUsername').value,
                password: document.getElementById('regPassword').value,
                phone: document.getElementById('regPhone').value,
                email: document.getElementById('regEmail').value
            })
        });
        showToast(data.message);
        closeModal('registerModal');
        showModal('loginModal');
    } catch {}
}

async function logout() {
    try {
        await api('/auth/logout', { method: 'POST' });
        location.reload();
    } catch {}
}

async function loadHouses(page = 1) {
    currentPage = page;
    const params = new URLSearchParams({ page, per_page: 9 });
    const q = document.getElementById('searchInput').value.trim();
    if (q) params.set('q', q);
    const minPrice = document.getElementById('filterMinPrice').value;
    if (minPrice) params.set('min_price', minPrice);
    const maxPrice = document.getElementById('filterMaxPrice').value;
    if (maxPrice) params.set('max_price', maxPrice);
    const rooms = document.getElementById('filterRooms').value;
    if (rooms) params.set('rooms', rooms);
    const houseType = document.getElementById('filterType').value;
    if (houseType) params.set('house_type', houseType);

    const data = await api('/api/houses?' + params.toString());
    renderHouses(data.houses);
    renderPagination(data);
}

function renderHouses(houses) {
    const grid = document.getElementById('housesGrid');
    if (!houses.length) {
        grid.innerHTML = '<div style="text-align:center;padding:60px;color:#999;grid-column:1/-1"><p style="font-size:48px;margin-bottom:16px">🔍</p><p>暂无符合条件的房源</p></div>';
        return;
    }
    grid.innerHTML = houses.map(h => `
        <div class="house-card" onclick="showHouseDetail(${h.id})">
            <div class="house-img" style="background:linear-gradient(135deg,${getGradient(h.id)})">
                ${houseIcons[h.id % houseIcons.length]}
                <div class="price-tag">${h.price.toLocaleString()}<small> 元/月</small></div>
            </div>
            <div class="house-info">
                <h3>${escHtml(h.title)}</h3>
                <p class="address">📍 ${escHtml(h.address)}</p>
                <div class="house-tags">
                    ${h.house_type ? `<span>${escHtml(h.house_type)}</span>` : ''}
                    ${h.orientation ? `<span>${escHtml(h.orientation)}</span>` : ''}
                    ${h.decoration ? `<span>${escHtml(h.decoration)}</span>` : ''}
                    ${h.area ? `<span>${h.area}㎡</span>` : ''}
                </div>
                <div class="house-meta">
                    <span>${h.rooms ? h.rooms + '室' : ''} ${h.floor_info || ''}</span>
                    <span>${(h.facilities || []).length}项设施</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPagination(data) {
    const el = document.getElementById('pagination');
    if (data.pages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += `<button ${data.page <= 1 ? 'disabled' : ''} onclick="loadHouses(${data.page - 1})">上一页</button>`;
    for (let i = 1; i <= data.pages; i++) {
        html += `<button class="${i === data.page ? 'active' : ''}" onclick="loadHouses(${i})">${i}</button>`;
    }
    html += `<button ${data.page >= data.pages ? 'disabled' : ''} onclick="loadHouses(${data.page + 1})">下一页</button>`;
    el.innerHTML = html;
}

function getGradient(id) {
    const gradients = [
        '#667eea,#764ba2', '#f093fb,#f5576c', '#4facfe,#00f2fe',
        '#43e97b,#38f9d7', '#fa709a,#fee140', '#a18cd1,#fbc2eb',
        '#fccb90,#d57eeb', '#e0c3fc,#8ec5fc'
    ];
    return gradients[id % gradients.length];
}

async function showHouseDetail(id) {
    const h = await api('/api/houses/' + id);
    document.getElementById('houseDetail').innerHTML = `
        <div class="detail-img" style="background:linear-gradient(135deg,${getGradient(h.id)})">${houseIcons[h.id % houseIcons.length]}</div>
        <div class="detail-header">
            <h2>${escHtml(h.title)}</h2>
            <div class="detail-price">${h.price.toLocaleString()} <small>元/月</small></div>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><div class="label">户型</div><div class="value">${escHtml(h.house_type || '未填写')}</div></div>
            <div class="detail-item"><div class="label">面积</div><div class="value">${h.area ? h.area + ' ㎡' : '未填写'}</div></div>
            <div class="detail-item"><div class="label">楼层</div><div class="value">${escHtml(h.floor_info || '未填写')}</div></div>
            <div class="detail-item"><div class="label">朝向</div><div class="value">${escHtml(h.orientation || '未填写')}</div></div>
            <div class="detail-item"><div class="label">装修</div><div class="value">${escHtml(h.decoration || '未填写')}</div></div>
            <div class="detail-item"><div class="label">地址</div><div class="value">${escHtml(h.address)}</div></div>
        </div>
        <div class="detail-desc"><h3>房源描述</h3><p>${escHtml(h.description || '暂无描述')}</p></div>
        ${(h.facilities || []).length ? `<div class="detail-facilities"><h3>配套设施</h3><div>${h.facilities.map(f => `<span>${escHtml(f)}</span>`).join('')}</div></div>` : ''}
        <button class="btn-book" onclick="bookHouse(${h.id})">预约看房</button>
    `;
    showModal('houseDetailModal');
}

function bookHouse(houseId) {
    closeModal('houseDetailModal');
    document.getElementById('aptHouseId').value = houseId;
    showModal('appointmentModal');
}

async function submitAppointment(e) {
    e.preventDefault();
    try {
        const data = await api('/api/appointments', {
            method: 'POST',
            body: JSON.stringify({
                house_id: parseInt(document.getElementById('aptHouseId').value),
                contact_name: document.getElementById('aptName').value,
                contact_phone: document.getElementById('aptPhone').value,
                appointment_time: document.getElementById('aptTime').value,
                message: document.getElementById('aptMessage').value
            })
        });
        showToast(data.message);
        closeModal('appointmentModal');
        document.getElementById('appointmentForm').reset();
    } catch {}
}

async function loadMyAppointments() {
    try {
        const data = await api('/api/appointments');
        const el = document.getElementById('appointmentsList');
        if (!data.length) {
            el.innerHTML = '<p style="color:#999;padding:20px">暂无预约记录</p>';
            return;
        }
        el.innerHTML = data.map(a => `
            <div class="appointment-card">
                <div class="appointment-info">
                    <h4>${escHtml(a.house_title)}</h4>
                    <p>📍 ${escHtml(a.house_address)} | ${a.house_price?.toLocaleString()}元/月</p>
                    <p>预约时间：${a.appointment_time} | 联系电话：${escHtml(a.contact_phone)}</p>
                    ${a.message ? `<p>留言：${escHtml(a.message)}</p>` : ''}
                </div>
                <span class="status-badge status-${a.status}">${STATUS_MAP[a.status] || a.status}</span>
            </div>
        `).join('');
    } catch {}
}

function showSection(id) {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('appointments-section').style.display = 'none';
    document.getElementById(id).style.display = 'block';
    if (id === 'appointments-section') loadMyAppointments();
}

async function loadHouseTypes() {
    const types = await api('/api/house-types');
    const select = document.getElementById('filterType');
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });
}

function searchHouses() {
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('appointments-section').style.display = 'none';
    loadHouses(1);
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';
    document.getElementById('filterRooms').value = '';
    document.getElementById('filterType').value = '';
    loadHouses(1);
}

function showModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});
