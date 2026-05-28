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

function renderPagination(data, loadFn) {
    if (data.pages <= 1) return '';
    let html = '<div class="pagination">';
    html += `<button ${data.page <= 1 ? 'disabled' : ''} onclick="${loadFn}(${data.page - 1})">上一页</button>`;
    for (let i = 1; i <= data.pages; i++) {
        html += `<button class="${i === data.page ? 'active' : ''}" onclick="${loadFn}(${i})">${i}</button>`;
    }
    html += `<button ${data.page >= data.pages ? 'disabled' : ''} onclick="${loadFn}(${data.page + 1})">下一页</button>`;
    html += '</div>';
    return html;
}

const STATUS_MAP = {pending: '待确认', confirmed: '已确认', cancelled: '已取消', completed: '已完成'};
const HOUSE_STATUS_MAP = {available: '可租', rented: '已租', offline: '下架'};
