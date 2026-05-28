async function api(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const data = await res.json();
    if (!res.ok) {
        showToast(data.error || '操作失败');
        throw new Error(data.error);
    }
    return data;
}

function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
}

const STATUS_MAP = {pending: '待确认', confirmed: '已确认', cancelled: '已取消', completed: '已完成'};
const HOUSE_STATUS_MAP = {available: '可租', rented: '已租', offline: '下架'};
