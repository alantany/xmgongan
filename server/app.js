const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const Tesseract = require('tesseract.js');

const app = express();
const PORT = 3000;
const MODELS_FILE = path.join(__dirname, 'models.json');

// 静态文件托管
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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
    const data = readModels();
    const activeModel = data.models.find(m => m.isActive);
    if (!activeModel) {
        return res.status(400).json({ error: '未配置激活模型' });
    }
    const apiUrl = activeModel.apiUrl;
    const apiKey = activeModel.apikey;

    try {
        let userQuery = '';
        let combinedFileTexts = '';

        // 提取用户原始问题 (假设它在 messages[0].content[0].text)
        // 注意: 前端构造的 messages 是 [{ role: 'user', content: userMessageContentParts }]
        // userMessageContentParts 是一个数组, e.g., [{type: 'text', text: '...'}, {type: 'image_url', ...}]
        // 我们需要找到 type: 'text' 的部分作为基础用户查询

        const userMessages = req.body.messages; // messages from request body
        if (userMessages && userMessages.length > 0 && userMessages[0].content) {
            if (Array.isArray(userMessages[0].content)) { // New structure with content parts
                 const textPart = userMessages[0].content.find(part => part.type === 'text');
                 if (textPart) {
                     userQuery = textPart.text || '';
                 }
            } else if (typeof userMessages[0].content === 'string') { // Older simple string content
                 userQuery = userMessages[0].content;
            }
        }
        
        // 处理附件 (PDF, DOCX, XLSX, Images for OCR)
        if (req.body.attachments && Array.isArray(req.body.attachments)) {
            for (const attachment of req.body.attachments) {
                if (!attachment.data || !attachment.mime_type || !attachment.filename) {
                    console.warn('Skipping invalid attachment:', attachment);
                    continue;
                }
                
                const buffer = Buffer.from(attachment.data, 'base64');
                let extractedText = '';
                let fileTypeForLog = 'Unknown';

                try {
                    if (attachment.mime_type === 'application/pdf') {
                        fileTypeForLog = 'PDF';
                        const pdfData = await pdf(buffer);
                        extractedText = pdfData.text;
                    } else if (attachment.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || attachment.filename.endsWith('.docx')) {
                        fileTypeForLog = 'DOCX';
                        const mammothResult = await mammoth.extractRawText({ buffer });
                        extractedText = mammothResult.value;
                    } else if (attachment.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || attachment.filename.endsWith('.xlsx') || 
                               attachment.mime_type === 'application/vnd.ms-excel' || attachment.filename.endsWith('.xls')) {
                        fileTypeForLog = 'Excel';
                        const workbook = xlsx.read(buffer, { type: 'buffer' });
                        let excelContent = [];
                        workbook.SheetNames.forEach(sheetName => {
                            excelContent.push(`Sheet: ${sheetName}`);
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                            jsonData.forEach(row => {
                                excelContent.push(row.join('\\t')); // Tab separated values in a row
                            });
                        });
                        extractedText = excelContent.join('\\n');
                    } else if (attachment.mime_type.startsWith('image/')) {
                        fileTypeForLog = 'Image (OCR)';
                        // Re-enable OCR with tesseract.js v5.0.5
                        
                        const worker = await Tesseract.createWorker({
                            // logger: m => console.log(m), // Keep logger commented out
                        });
                        try {
                            await worker.loadLanguage(['eng', 'chi_sim']); 
                            await worker.initialize(); 
                            const { data: { text: ocrText } } = await worker.recognize(buffer);
                            extractedText = ocrText;
                        } finally {
                            await worker.terminate(); 
                        }
                    } else {
                        console.log(`Unsupported attachment type: ${attachment.mime_type} for file ${attachment.filename}`);
                    }

                    if (extractedText) {
                        combinedFileTexts += `--- Content from file: ${attachment.filename} (${fileTypeForLog}) ---\\n${extractedText}\\n--- End of file: ${attachment.filename} ---\\n\\n`;
                    }
                } catch (fileProcessingError) {
                    console.error(`Error processing file ${attachment.filename} (${fileTypeForLog}):`, fileProcessingError);
                    combinedFileTexts += `--- Error processing file: ${attachment.filename} (${fileTypeForLog}). Could not extract content. ---\\n\\n`;
                }
            }
        }

        // 构造最终发送给LLM的messages
        // The user's original query will be the primary text.
        // Extracted file contents will be prepended or appended.
        // For now, let's prepend file texts to the user query.
        
        let finalUserContentForLLM = userQuery;
        if (combinedFileTexts) {
            finalUserContentForLLM = combinedFileTexts.trim() + "\\n\\nUser Query:\\n" + userQuery;
        }
        
        // Construct the messages array for the LLM, ensuring 'content' is a string.
        const messagesForLLM = [
            {
                role: 'user',
                content: finalUserContentForLLM // This should now be a string
            }
            // Potentially add other parts of original req.body.messages if they were not 'text' and need to be preserved
            // For now, simplifying to single user message with combined text.
        ];


        const requestBodyForLLM = {
            // model: activeModel.modelName, // This is usually part of req.body from frontend
            ...req.body, // Pass through other params like temperature, max_tokens, and importantly model name
            messages: messagesForLLM, // Override messages with our processed content
            stream: true
        };
        // Remove our custom 'attachments' field as LLM won't understand it
        delete requestBodyForLLM.attachments;


        const llmResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(requestBodyForLLM)
        });

        if (!llmResponse.ok) {
            const errorText = await llmResponse.text();
            console.error('LLM API Error:', llmResponse.status, errorText);
            return res.status(llmResponse.status).json({ error: `LLM API Error: ${errorText}` });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        llmResponse.body.on('data', (chunk) => {
            res.write(chunk);
        });
        llmResponse.body.on('end', () => {
            res.end();
        });
        llmResponse.body.on('error', (err) => {
            console.error('Error streaming data from LLM (llmResponse.body error):', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error streaming data from LLM' });
            } else {
                res.end();
            }
        });

    } catch (err) {
        console.error('Relay error in /api/relay:', err);
        if (!res.headersSent) {
             res.status(500).json({ error: 'Relay processing error: ' + err.message });
        } else {
            res.end();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 