// admin.js
// 纯前端 localStorage 管理大模型配置

const API_BASE = '/api/models';

let models = [];
let editingId = null;

// DOM元素
const tableBody = document.getElementById('model-table-body');
const form = document.getElementById('model-form');
const formTitle = document.getElementById('form-title');
const editIndexInput = document.getElementById('edit-index');
const modelNameInput = document.getElementById('model_name');
const urlInput = document.getElementById('url');
const apiKeyInput = document.getElementById('api_key');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const typeInput = document.getElementById('type');

// 导入/导出功能
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');

// 初始化
window.onload = async function() {
    await fetchModels();
    renderTable();
};

async function fetchModels() {
    const res = await fetch(API_BASE);
    models = await res.json();
}

function renderTable() {
    tableBody.innerHTML = '';
    models.forEach((m, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.name || ''}</td>
            <td>${m.apiUrl || ''}</td>
            <td>${m.apikey || ''}</td>
            <td>${m.isActive ? '✅' : `<button onclick="setActive('${m.id}')">切换</button>`}</td>
            <td>
                <button onclick="editModel('${m.id}')">编辑</button>
                <button onclick="deleteModel('${m.id}')">删除</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

window.setActive = async function(id) {
    await fetch(`${API_BASE}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    await fetchModels();
    renderTable();
};

window.editModel = function(id) {
    const m = models.find(x => x.id === id);
    editingId = id;
    modelNameInput.value = m.name || '';
    urlInput.value = m.apiUrl || '';
    apiKeyInput.value = m.apikey || '';
    typeInput.value = m.type || '';
    formTitle.textContent = '编辑模型';
    cancelBtn.style.display = '';
};

window.deleteModel = async function(id) {
    if (!confirm('确定要删除该模型吗？')) return;
    await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await fetchModels();
    renderTable();
};

form.onsubmit = async function(e) {
    e.preventDefault();
    const data = {
        name: modelNameInput.value.trim(),
        apiUrl: urlInput.value.trim(),
        apikey: apiKeyInput.value.trim(),
        type: typeInput.value.trim()
    };
    if (!editingId) {
        // 新增
        await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } else {
        // 编辑
        await fetch(`${API_BASE}/${encodeURIComponent(editingId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
    await fetchModels();
    renderTable();
    form.reset();
    editingId = null;
    formTitle.textContent = '添加新模型';
    cancelBtn.style.display = 'none';
    typeInput.value = '';
};

cancelBtn.onclick = function() {
    form.reset();
    editingId = null;
    formTitle.textContent = '添加新模型';
    cancelBtn.style.display = 'none';
    typeInput.value = '';
};

importBtn.onclick = function() {
    importFile.value = '';
    importFile.click();
};

importFile.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const json = JSON.parse(evt.target.result);
            if (json.models && Array.isArray(json.models)) {
                await fetch(`${API_BASE}/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json)
                });
                await fetchModels();
                renderTable();
                alert('导入成功！');
            } else {
                alert('文件格式不正确，应包含 models 数组');
            }
        } catch (err) {
            alert('文件解析失败：' + err.message);
        }
    };
    reader.readAsText(file);
};

exportBtn.onclick = function() {
    window.open(`${API_BASE}/export`, '_blank');
}; 