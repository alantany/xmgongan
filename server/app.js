const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;
const MODELS_FILE = path.join(__dirname, 'models.json');

// 静态文件托管
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(bodyParser.json());

// 工具函数：读写models.json
function readModels() {
    if (!fs.existsSync(MODELS_FILE)) {
        return { models: [] };
    }
    return JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8'));
}
function writeModels(data) {
    fs.writeFileSync(MODELS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 获取所有模型
app.get('/api/models', (req, res) => {
    res.json(readModels().models);
});

// 新增模型
app.post('/api/models', (req, res) => {
    const data = readModels();
    const model = req.body;
    if (!model.id) model.id = model.name + '_' + Date.now();
    if (data.models.length === 0) model.isActive = true;
    data.models.push(model);
    writeModels(data);
    res.json({ success: true });
});

// 修改模型
app.put('/api/models/:id', (req, res) => {
    const data = readModels();
    const idx = data.models.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    data.models[idx] = { ...data.models[idx], ...req.body };
    writeModels(data);
    res.json({ success: true });
});

// 删除模型
app.delete('/api/models/:id', (req, res) => {
    const data = readModels();
    const idx = data.models.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    const wasActive = data.models[idx].isActive;
    data.models.splice(idx, 1);
    // 如果删除的是active，自动激活第一个
    if (wasActive && data.models.length > 0) {
        data.models[0].isActive = true;
    }
    writeModels(data);
    res.json({ success: true });
});

// 切换active模型
app.post('/api/models/active', (req, res) => {
    const { id } = req.body;
    const data = readModels();
    data.models.forEach(m => m.isActive = (m.id === id));
    writeModels(data);
    res.json({ success: true });
});

// 获取active模型
app.get('/api/models/active', (req, res) => {
    const data = readModels();
    const active = data.models.find(m => m.isActive);
    res.json(active || null);
});

// 导入models.json
app.post('/api/models/import', (req, res) => {
    if (!req.body.models || !Array.isArray(req.body.models)) {
        return res.status(400).json({ error: '格式错误，需包含models数组' });
    }
    writeModels({ models: req.body.models });
    res.json({ success: true });
});

// 导出models.json
app.get('/api/models/export', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.download(MODELS_FILE, 'models.json');
});

// OpenRouter代理接口
app.post('/api/relay', async (req, res) => {
    // 动态读取当前激活模型
    const data = readModels();
    const active = data.models.find(m => m.isActive);
    if (!active) {
        return res.status(400).json({ error: '未配置激活模型' });
    }
    const apiUrl = active.apiUrl;
    const apiKey = active.apikey;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.text();
        res.status(response.status).send(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 