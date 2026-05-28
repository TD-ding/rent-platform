let housesPage = 1, usersPage = 1, aptPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    initTabs();
});

async function checkAdminAuth() {
    try {
        const data = await api('/auth/me');
        if (!data.user || data.user.role !== 'admin') {
            window.location.href = '/';
            return;
        }
        loadDashboard();
    } catch {
        window.location.href = '/';
    }
}

function initTabs() {
    document.querySelectorAll('.nav-tabs .tab').forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById(tabName + '-tab').classList.add('active');
            if (tabName === 'houses') loadAdminHouses();
            if (tabName === 'users') loadUsers();
            if (tabName === 'appointments') loadAdminAppointments();
        });
    });
}

async function loadDashboard() {
    try {
        const s = await api('/admin/api/stats');
        document.getElementById('statHouses').textContent = s.houses;
        document.getElementById('statUsers').textContent = s.users;
        document.getElementById('statAppointments').textContent = s.appointments;
        document.getElementById('statPending').textContent = s.pending;
    } catch {
        // 仪表盘加载失败不应阻断页面
    }
}

async function loadAdminHouses(page) {
    if (page !== undefined) housesPage = page;
    const data = await api('/admin/api/houses?page=' + housesPage);
    const houses = data.items;
    const el = document.getElementById('adminHousesList');
    if (!data.total) {
        el.innerHTML = '<p style="color:var(--color-text-muted);padding:20px">暂无房源</p>';
        return;
    }
    el.innerHTML = `<table class="data-table">
        <thead><tr><th>ID</th><th>标题</th><th>地址</th><th>价格</th><th>户型</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${houses.map(h => `
            <tr>
                <td>${h.id}</td>
                <td>${escHtml(h.title)}</td>
                <td>${escHtml(h.address)}</td>
                <td>${h.price.toLocaleString()}元/月</td>
                <td>${escHtml(h.house_type || '-')}</td>
                <td><span class="status-badge status-${h.status}">${HOUSE_STATUS_MAP[h.status] || h.status}</span></td>
                <td>
                    <button class="btn-sm btn-edit" onclick="editHouse(${h.id})">编辑</button>
                    <button class="btn-sm btn-delete" onclick="deleteHouse(${h.id})">删除</button>
                </td>
            </tr>
        `).join('')}</tbody>
    </table>` + renderPagination(data, 'loadAdminHouses');
}

function showHouseForm(house) {
    document.getElementById('houseFormContainer').style.display = 'block';
    document.getElementById('houseFormTitle').textContent = house ? '编辑房源' : '添加房源';
    document.getElementById('houseId').value = house ? house.id : '';
    document.getElementById('hTitle').value = house ? house.title : '';
    document.getElementById('hAddress').value = house ? house.address : '';
    document.getElementById('hPrice').value = house ? house.price : '';
    document.getElementById('hArea').value = house ? house.area || '' : '';
    document.getElementById('hRooms').value = house ? house.rooms || '' : '';
    document.getElementById('hHouseType').value = house ? house.house_type || '' : '';
    document.getElementById('hFloor').value = house ? house.floor_info || '' : '';
    document.getElementById('hOrientation').value = house ? house.orientation || '' : '';
    document.getElementById('hDecoration').value = house ? house.decoration || '' : '';
    document.getElementById('hStatus').value = house ? house.status : 'available';
    document.getElementById('hDescription').value = house ? house.description || '' : '';
    document.getElementById('hFacilities').value = house ? (house.facilities || []).join(', ') : '';
}

function hideHouseForm() {
    document.getElementById('houseFormContainer').style.display = 'none';
    document.getElementById('houseForm').reset();
}

async function editHouse(id) {
    const house = await api('/admin/api/houses/' + id);
    showHouseForm(house);
}

async function saveHouse(e) {
    e.preventDefault();
    const id = document.getElementById('houseId').value;
    const payload = {
        title: document.getElementById('hTitle').value,
        address: document.getElementById('hAddress').value,
        price: parseFloat(document.getElementById('hPrice').value),
        area: document.getElementById('hArea').value ? parseFloat(document.getElementById('hArea').value) : null,
        rooms: document.getElementById('hRooms').value ? parseInt(document.getElementById('hRooms').value) : null,
        house_type: document.getElementById('hHouseType').value,
        floor_info: document.getElementById('hFloor').value,
        orientation: document.getElementById('hOrientation').value,
        decoration: document.getElementById('hDecoration').value,
        description: document.getElementById('hDescription').value,
        facilities: document.getElementById('hFacilities').value.split(',').map(s => s.trim()).filter(Boolean),
        status: document.getElementById('hStatus').value
    };

    if (id) {
        await api('/admin/api/houses/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('房源更新成功');
    } else {
        await api('/admin/api/houses', { method: 'POST', body: JSON.stringify(payload) });
        showToast('房源创建成功');
    }
    hideHouseForm();
    loadAdminHouses();
    loadDashboard();
}

async function deleteHouse(id) {
    if (!confirm('确定要删除这个房源吗？相关的预约也会被删除。')) return;
    await api('/admin/api/houses/' + id, { method: 'DELETE' });
    showToast('房源已删除');
    housesPage = 1;
    loadAdminHouses();
    loadDashboard();
}

async function loadUsers(page) {
    if (page !== undefined) usersPage = page;
    const data = await api('/admin/api/users?page=' + usersPage);
    const users = data.items;
    const el = document.getElementById('usersList');
    el.innerHTML = `<table class="data-table">
        <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>手机</th><th>邮箱</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>${users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${escHtml(u.username)}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'status-confirmed' : 'status-available'}">${u.role === 'admin' ? '管理员' : '普通用户'}</span></td>
                <td>${escHtml(u.phone || '-')}</td>
                <td>${escHtml(u.email || '-')}</td>
                <td>${u.created_at || '-'}</td>
                <td>
                    ${u.role !== 'admin' ? `
                        <button class="btn-sm btn-confirm" onclick="toggleRole(${u.id}, '${u.role}')">设为管理员</button>
                        <button class="btn-sm btn-delete" onclick="deleteUser(${u.id})">删除</button>
                    ` : '<span style="color:var(--color-text-muted);font-size:13px">-</span>'}
                </td>
            </tr>
        `).join('')}</tbody>
    </table>` + renderPagination(data, 'loadUsers');
}

async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await api(`/admin/api/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
    showToast('角色已更新');
    loadUsers();
}

async function deleteUser(id) {
    if (!confirm('确定要删除这个用户吗？')) return;
    await api('/admin/api/users/' + id, { method: 'DELETE' });
    showToast('用户已删除');
    usersPage = 1;
    loadUsers();
    loadDashboard();
}

async function loadAdminAppointments(page) {
    if (page !== undefined) aptPage = page;
    const data = await api('/admin/api/appointments?page=' + aptPage);
    const appointments = data.items;
    const el = document.getElementById('adminAppointmentsList');
    if (!data.total) {
        el.innerHTML = '<p style="color:var(--color-text-muted);padding:20px">暂无预约</p>';
        return;
    }
    el.innerHTML = `<table class="data-table">
        <thead><tr><th>ID</th><th>用户</th><th>房源</th><th>联系人</th><th>电话</th><th>预约时间</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${appointments.map(a => `
            <tr>
                <td>${a.id}</td>
                <td>${escHtml(a.user_name)}</td>
                <td>${escHtml(a.house_title)}</td>
                <td>${escHtml(a.contact_name)}</td>
                <td>${escHtml(a.contact_phone)}</td>
                <td>${a.appointment_time}</td>
                <td><span class="status-badge status-${a.status}">${STATUS_MAP[a.status] || a.status}</span></td>
                <td>
                    ${a.status === 'pending' ? `
                        <button class="btn-sm btn-confirm" onclick="updateAptStatus(${a.id}, 'confirmed')">确认</button>
                        <button class="btn-sm btn-delete" onclick="updateAptStatus(${a.id}, 'cancelled')">取消</button>
                    ` : ''}
                    ${a.status === 'confirmed' ? `<button class="btn-sm btn-confirm" onclick="updateAptStatus(${a.id}, 'completed')">完成</button>` : ''}
                </td>
            </tr>
        `).join('')}</tbody>
    </table>` + renderPagination(data, 'loadAdminAppointments');
}

async function updateAptStatus(id, status) {
    await api(`/admin/api/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    showToast('状态已更新');
    loadAdminAppointments();
    loadDashboard();
}

function adminLogout() {
    fetch('/auth/logout', { method: 'POST' }).then(() => window.location.href = '/');
}
