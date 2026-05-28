let currentPage = 1;

const houseIcons = ['🏠', '🏢', '🏡', '🏘️', '🏗️', '🌆'];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadHouses();
    loadHouseTypes();
    initPricePresets();
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
                document.querySelector('.nav-links').insertBefore(
                    link, document.getElementById('userMenu')
                );
            }
        }
    } catch {
        // 未登录状态，静默忽略
    }
}

async function login(e) {
    e.preventDefault();
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
}

async function register(e) {
    e.preventDefault();
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
}

async function logout() {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/';
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
    document.getElementById('pagination').innerHTML =
        renderPagination(data, 'loadHouses');
}

function renderHouses(houses) {
    const grid = document.getElementById('housesGrid');
    if (!houses.length) {
        grid.innerHTML = '<div class="empty-state"><p class="empty-icon">🔍</p><p>暂无符合条件的房源</p></div>';
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
    const pricePerSqm = h.area ? (h.price / h.area).toFixed(1) : null;
    const createdDate = h.created_at ? h.created_at.split(' ')[0] : '';
    document.getElementById('houseDetail').innerHTML = `
        <div class="detail-img" style="background:linear-gradient(135deg,${getGradient(h.id)})">${houseIcons[h.id % houseIcons.length]}</div>
        <div class="detail-header">
            <h2>${escHtml(h.title)}</h2>
            <div class="detail-price">${h.price.toLocaleString()} <small>元/月</small>
                ${pricePerSqm ? `<span class="price-per-sqm">约 ${pricePerSqm} 元/㎡/月</span>` : ''}
            </div>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><div class="label">户型</div><div class="value">${escHtml(h.house_type || '未填写')}</div></div>
            <div class="detail-item"><div class="label">面积</div><div class="value">${h.area ? h.area + ' ㎡' : '未填写'}</div></div>
            <div class="detail-item"><div class="label">楼层</div><div class="value">${escHtml(h.floor_info || '未填写')}</div></div>
            <div class="detail-item"><div class="label">朝向</div><div class="value">${escHtml(h.orientation || '未填写')}</div></div>
            <div class="detail-item"><div class="label">装修</div><div class="value">${escHtml(h.decoration || '未填写')}</div></div>
            <div class="detail-item"><div class="label">地址</div><div class="value">${escHtml(h.address)}</div></div>
            ${createdDate ? `<div class="detail-item"><div class="label">发布时间</div><div class="value">${createdDate}</div></div>` : ''}
            ${h.rooms ? `<div class="detail-item"><div class="label">房间数</div><div class="value">${h.rooms} 间</div></div>` : ''}
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
    showSection('appointments-section');
}

async function loadMyAppointments() {
    const data = await api('/api/appointments');
    const el = document.getElementById('appointmentsList');
    if (!data.length) {
        el.innerHTML = '<div class="empty-state"><p class="empty-icon">📋</p><p>暂无预约记录</p></div>';
        return;
    }
    el.innerHTML = data.map(a => `
        <div class="apt-card">
            <div class="apt-card-body">
                <div class="apt-house-info">
                    <h4>${escHtml(a.house_title)}</h4>
                    <div class="apt-house-tags">
                        ${a.house_type ? `<span class="apt-tag">${escHtml(a.house_type)}</span>` : ''}
                        ${a.area ? `<span class="apt-tag">${a.area}㎡</span>` : ''}
                        ${a.orientation ? `<span class="apt-tag">${escHtml(a.orientation)}</span>` : ''}
                    </div>
                    <p class="apt-meta">📍 ${escHtml(a.house_address)}</p>
                    <p class="apt-meta">💰 ${a.house_price?.toLocaleString()}元/月</p>
                </div>
                <div class="apt-detail">
                    <div class="apt-detail-row">
                        <span class="apt-label">预约时间</span>
                        <span>${a.appointment_time}</span>
                    </div>
                    <div class="apt-detail-row">
                        <span class="apt-label">联系人</span>
                        <span>${escHtml(a.contact_name)}</span>
                    </div>
                    <div class="apt-detail-row">
                        <span class="apt-label">联系电话</span>
                        <span>${escHtml(a.contact_phone)}</span>
                    </div>
                    ${a.message ? `<div class="apt-detail-row"><span class="apt-label">留言</span><span>${escHtml(a.message)}</span></div>` : ''}
                </div>
            </div>
            <div class="apt-status-bar">
                <span class="status-badge status-${a.status}">
                    ${STATUS_MAP[a.status] || a.status}
                </span>
                <span class="apt-time">提交于 ${a.created_at || ''}</span>
            </div>
        </div>
    `).join('');
}

function initPricePresets() {
    document.querySelectorAll('.price-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('filterMinPrice').value =
                btn.dataset.min || '';
            document.getElementById('filterMaxPrice').value =
                btn.dataset.max || '';
            document.querySelectorAll('.price-preset').forEach(
                b => b.classList.remove('active')
            );
            btn.classList.add('active');
            searchHouses();
        });
    });

    ['filterMinPrice', 'filterMaxPrice'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            document.querySelectorAll('.price-preset').forEach(
                b => b.classList.remove('active')
            );
            searchHouses();
        });
    });
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
    document.querySelectorAll('.price-preset').forEach(
        b => b.classList.remove('active')
    );
    loadHouses(1);
}

function showModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function toggleMobileNav() {
    document.getElementById('navLinks').classList.toggle('open');
}
function closeMobileNav() {
    document.getElementById('navLinks').classList.remove('open');
}

document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});
