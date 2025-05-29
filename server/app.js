const express = require('express');
const fs = require('fs');
const fsPromises = require('fs').promises; // For modern fs operations like mkdtemp, rm
const path = require('path');
const os = require('os'); // For os.tmpdir()
const { spawn } = require('child_process'); // For executing antiword
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
        return res.status(400).json({ errorType: 'configError', message: '未配置激活模型' });
    }
    const apiUrl = activeModel.apiUrl;
    const apiKey = activeModel.apikey;

    try {
        let userQuery = '';
        let combinedFileTexts = '';
        let criticalFileErrorOccurred = false;
        const fileProcessingErrorMessages = [];
        
        const isErrorMessageString = (text) => typeof text === 'string' && (text.startsWith('[文件处理错误') || text.startsWith('[文件处理提示'));

        const userMessages = req.body.messages;
        if (userMessages && userMessages.length > 0 && userMessages[0].content) {
            if (Array.isArray(userMessages[0].content)) {
                 const textPart = userMessages[0].content.find(part => part.type === 'text');
                 if (textPart) {
                     userQuery = textPart.text || '';
                 }
            } else if (typeof userMessages[0].content === 'string') {
                 userQuery = userMessages[0].content;
            }
        }
        
        if (req.body.attachments && Array.isArray(req.body.attachments)) {
            for (const attachment of req.body.attachments) {
                if (!attachment.data || !attachment.filename) {
                    console.warn('Skipping invalid attachment (missing data or filename):', attachment);
                    fileProcessingErrorMessages.push(`[文件处理提示：检测到无效的附件数据 (文件名: ${attachment.filename || '未知'})，已跳过处理。]`);
                    criticalFileErrorOccurred = true; // Treat as an error to report
                    continue;
                }
                
                const buffer = Buffer.from(attachment.data, 'base64');
                let extractedText = ''; // Holds content OR error message for THIS file
                let fileTypeForLog = 'Unknown';

                try {
                    console.log(`Processing attachment: Original Filename: '${attachment.filename}', Original MimeType: '${attachment.mime_type}'`);
                    const mimeType = attachment.mime_type ? attachment.mime_type.trim() : '';
                    const fileName = attachment.filename ? attachment.filename.trim().toLowerCase() : '';
                    console.log(`Sanitized values - fileName: '${fileName}', mimeType: '${mimeType}'`);

                    // Detailed DOC/DOCX Check
                    console.log(`DOC/DOCX Check part 1 (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'): ${mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}`);
                    console.log(`DOC/DOCX Check part 2 (fileName.endsWith('.docx')): ${fileName.endsWith('.docx')}`);
                    console.log(`DOC/DOCX Check part 3 (mimeType === 'application/msword'): ${mimeType === 'application/msword'}`);
                    console.log(`DOC/DOCX Check part 4 (fileName.endsWith('.doc')): ${fileName.endsWith('.doc')}`);

                    console.log(`CSV Check part 1 (mimeType === 'text/csv'): ${mimeType === 'text/csv'}`);
                    console.log(`CSV Check part 2 (fileName.endsWith('.csv')): ${fileName.endsWith('.csv')}`);

                    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
                        fileTypeForLog = 'PDF';
                        const pdfData = await pdf(buffer);
                        extractedText = pdfData.text;
                    } else if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
                        fileTypeForLog = 'DOC (antiword)';
                        let tempFilePath = '';
                        let tempDir = '';
                        try {
                            tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'doc-processing-'));
                            tempFilePath = path.join(tempDir, fileName.endsWith('.doc') ? fileName : Date.now() + '-tempfile.doc');
                            await fsPromises.writeFile(tempFilePath, buffer);
                            extractedText = await new Promise((resolve, reject) => {
                                const antiwordProc = spawn('antiword', [tempFilePath]);
                                let output = ''; let errorOutput = '';
                                antiwordProc.stdout.on('data', (data) => output += data.toString());
                                antiwordProc.stderr.on('data', (data) => errorOutput += data.toString());
                                antiwordProc.on('close', (code) => {
                                    if (code === 0) resolve(output);
                                    else {
                                        if (errorOutput.includes('ENOENT') || (process.platform !== 'win32' && code === 127)) { 
                                           reject(new Error('antiword 命令未找到或无法执行。请确保已正确安装并在系统 PATH 中。'));
                                        } else {
                                           reject(new Error(`antiword 执行失败，退出码: ${code}. 错误输出: ${errorOutput || '无特定错误输出'}`));
                                        }
                                    }
                                });
                                antiwordProc.on('error', (err) => reject(new Error(`执行 antiword 失败: ${err.message}.`)));
                            });
                        } catch (antiwordError) {
                            console.error(`Error processing .doc file ${fileName} with antiword:`, antiwordError);
                            if (antiwordError.message && antiwordError.message.includes('is not a Word Document')) {
                                extractedText = `[文件处理提示：文件 '${attachment.filename}' 似乎不是系统可识别的 Word (.doc) 类型，或者文件已损坏。请尝试使用 Word 程序打开该文件，并将其另存为 .docx 格式后重新上传。]`;
                            } else if (antiwordError.message && (antiwordError.message.includes('antiword 命令未找到') || antiwordError.message.includes('执行 antiword 失败'))) {
                                extractedText = `[文件处理错误：无法从 '${attachment.filename}' 中提取内容。服务器无法执行 .doc 文件解析命令 (antiword)。请联系管理员检查服务器配置。]`;
                            } else {
                                extractedText = `[文件处理错误：无法从 '${attachment.filename}' 中提取内容。未知错误导致解析失败。详情: ${antiwordError.message}]`;
                            }
                        } finally {
                            if (tempFilePath) await fsPromises.unlink(tempFilePath).catch(e => console.error('Failed to delete temp file:', e));
                            if (tempDir) await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(e => console.error('Failed to delete temp dir:', e));
                        }
                    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
                        fileTypeForLog = 'DOCX';
                        try {
                            const mammothResult = await mammoth.extractRawText({ buffer });
                            extractedText = mammothResult.value;
                        } catch (mammothError) {
                            console.error(`Mammoth error processing ${fileName}:`, mammothError);
                            extractedText = `[文件处理错误：提取 '${attachment.filename}' (.docx) 内容失败。详情: ${mammothError.message}]`;
                        }
                    } else if (fileName.endsWith('.wps')) {
                        fileTypeForLog = 'WPS (LibreOffice)';
                        let tempInputFilePath = '', tempOutputDir = '', tempOutputTxtFilePath = '';
                        try {
                            tempOutputDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'wps-processing-'));
                            const originalFileNameWPS = attachment.filename ? attachment.filename.trim() : Date.now() + '-tempfile.wps';
                            tempInputFilePath = path.join(tempOutputDir, originalFileNameWPS);
                            await fsPromises.writeFile(tempInputFilePath, buffer);
                            const outputTxtFileName = path.basename(tempInputFilePath, path.extname(tempInputFilePath)) + '.txt';
                            tempOutputTxtFilePath = path.join(tempOutputDir, outputTxtFileName);
                            extractedText = await new Promise((resolve, reject) => {
                                const command = 'soffice'; // or 'libreoffice' depending on system
                                const args = [
                                    '--headless',
                                    '--convert-to',
                                    'txt:Text',
                                    '--outdir',
                                    tempOutputDir,
                                    tempInputFilePath
                                ];
                                
                                console.log(`Executing: ${command} ${args.join(' ')}`); // Log command execution

                                const libreoffice = spawn(command, args);
                                let errorOutput = '';
                                let stdOutput = ''; // Capture stdout for potential info/debug messages from soffice

                                libreoffice.stdout.on('data', (data) => {
                                    stdOutput += data.toString();
                                });
                                libreoffice.stderr.on('data', (data) => {
                                    errorOutput += data.toString();
                                });

                                libreoffice.on('close', async (code) => {
                                    console.log(`LibreOffice exited with code ${code}.`);
                                    if (stdOutput) console.log('LibreOffice stdout:', stdOutput);
                                    if (errorOutput) console.log('LibreOffice stderr:', errorOutput);

                                    if (code === 0 && await fsPromises.stat(tempOutputTxtFilePath).then(() => true).catch(() => false)) {
                                        resolve(await fsPromises.readFile(tempOutputTxtFilePath, 'utf-8'));
                                    } else {
                                        reject(new Error(`LibreOffice 转换失败 (code ${code}) 或输出文件未找到. ${errorOutput || stdOutput}`));
                                    }
                                });
                                libreoffice.on('error', (err) => {
                                    reject(new Error(`执行 soffice (LibreOffice) 失败: ${err.message}. 请确保 LibreOffice 已安装并在系统 PATH 中。`));
                                });
                            });
                        } catch (wpsError) {
                            console.error(`Error processing .wps file ${attachment.filename || fileName} with LibreOffice:`, wpsError);
                            extractedText = `[文件处理错误：使用 LibreOffice 处理 .wps 文件 '${attachment.filename || fileName}' 失败。详情: ${wpsError.message}]`;
                        } finally {
                            if (tempInputFilePath) await fsPromises.unlink(tempInputFilePath).catch(e => {});
                            if (tempOutputTxtFilePath) await fsPromises.unlink(tempOutputTxtFilePath).catch(e => {});
                            if (tempOutputDir) await fsPromises.rm(tempOutputDir, { recursive: true, force: true }).catch(e => {});
                        }
                    } else if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
                        fileTypeForLog = 'CSV';
                        extractedText = buffer.toString('utf-8');
                    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileName.endsWith('.xlsx') ||
                               mimeType === 'application/vnd.ms-excel' || fileName.endsWith('.xls')) {
                        fileTypeForLog = 'Excel';
                        try {
                            const workbook = xlsx.read(buffer, { type: 'buffer' });
                            let excelContent = [];
                            workbook.SheetNames.forEach(sheetName => {
                                excelContent.push(`Sheet: ${sheetName}`);
                                const worksheet = workbook.Sheets[sheetName];
                                const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                                jsonData.forEach(row => excelContent.push(row.join('\t')));
                            });
                            extractedText = excelContent.join('\n');
                        } catch (excelError) {
                            console.error(`Error processing Excel file ${fileName}:`, excelError);
                            extractedText = `[文件处理错误：提取 '${attachment.filename}' (Excel) 内容失败。详情: ${excelError.message}]`;
                        }
                    } else if (mimeType.startsWith('image/')) {
                        fileTypeForLog = 'Image (OCR)';
                        let worker = null;
                        try {
                            // 创建OCR worker
                            worker = await Tesseract.createWorker({
                                logger: m => console.log('[Tesseract]', m) // 添加日志
                            });
                            
                            // 加载中文简体和英文语言包
                            await worker.loadLanguage('chi_sim+eng');
                            await worker.initialize('chi_sim+eng');
                            
                            // 设置OCR参数以提高中文识别准确率
                            await worker.setParameters({
                                'preserve_interword_spaces': '1', // 保持词间空格
                                'tessedit_pageseg_mode': '1', // 使用自动页面分割
                                'tessedit_ocr_engine_mode': '1', // 使用神经网络引擎
                            });
                            
                            console.log(`Starting OCR for image: ${attachment.filename}`);
                            
                            // 进行OCR识别
                            const { data: { text: ocrText, confidence } } = await worker.recognize(buffer);
                            
                            console.log(`OCR completed for ${attachment.filename}, confidence: ${confidence}`);
                            
                            if (ocrText && ocrText.trim().length > 0) {
                                // 清理OCR结果，移除多余的空白字符
                                extractedText = ocrText
                                    .replace(/\n{3,}/g, '\n\n') // 替换多个换行为双换行
                                    .replace(/\s{2,}/g, ' ') // 替换多个空格为单空格
                                    .trim();
                                
                                // 如果置信度太低，添加提示
                                if (confidence < 60) {
                                    extractedText = `[OCR识别置信度较低(${confidence.toFixed(1)}%)，结果可能不准确]\n\n${extractedText}`;
                                }
                            } else {
                                extractedText = `[文件处理提示：图片 '${attachment.filename}' OCR识别结果为空，可能图片中没有文字或文字无法识别。]`;
                            }
                            
                        } catch (ocrError) {
                            console.error(`Error during OCR for ${fileName}:`, ocrError);
                            
                            // 更详细的错误信息
                            let errorMessage = ocrError.message || '未知OCR错误';
                            if (errorMessage.includes('language')) {
                                errorMessage = 'OCR语言包加载失败，请检查服务器配置';
                            } else if (errorMessage.includes('worker')) {
                                errorMessage = 'OCR工作进程创建失败';
                            } else if (errorMessage.includes('timeout')) {
                                errorMessage = 'OCR识别超时，图片可能过大或过于复杂';
                            }
                            
                            extractedText = `[文件处理错误：对图片 '${attachment.filename}' 进行OCR识别失败。详情: ${errorMessage}]`;
                        } finally {
                            // 确保worker被正确关闭
                            if (worker) {
                                try {
                                    await worker.terminate();
                                } catch (terminateError) {
                                    console.error('Error terminating OCR worker:', terminateError);
                                }
                            }
                        }
                    } else {
                        fileTypeForLog = 'Unsupported';
                        console.log(`Unsupported attachment type: ${mimeType} for file ${fileName}`);
                        extractedText = `[文件处理提示：文件 '${attachment.filename}' 类型 (${mimeType || '未知'}) 不被支持或无法识别。]`;
                    }
                } catch (fileProcessingError) { // Catch-all for unexpected errors within a single file's processing block
                    console.error(`Unexpected error processing file ${attachment.filename} (${fileTypeForLog}):`, fileProcessingError);
                    extractedText = `[文件处理错误：处理文件 '${attachment.filename}' (${fileTypeForLog}) 时发生意外。详情: ${fileProcessingError.message}]`;
                }

                // After attempting to process the file and populate extractedText (with content or error message)
                if (isErrorMessageString(extractedText)) {
                    criticalFileErrorOccurred = true;
                    fileProcessingErrorMessages.push(extractedText);
                } else if (extractedText && extractedText.trim().length > 0) { // Ensure non-empty actual content
                    combinedFileTexts += `--- Content from file: ${attachment.filename} (${fileTypeForLog}) ---\n${extractedText}\n--- End of file: ${attachment.filename} ---\n\n`;
                } else {
                    // File might be of a supported type but empty, or an error occurred that didn't set extractedText to an error string.
                    // To be safe, if extractedText is empty or only whitespace and not an error, consider it a silent failure or empty file.
                    // We could add a generic note if it's not an error but still empty, or just skip it.
                    // For now, only non-empty, non-error text is added to combinedFileTexts.
                    // If it was a parsing error, it should have set extractedText to an error string and been caught above.
                    if (!isErrorMessageString(extractedText)) { // If it's not an error, but empty/whitespace
                        console.log(`File '${attachment.filename}' (${fileTypeForLog}) yielded no content or only whitespace.`);
                        // Optionally add a note for empty files if desired, but not to error messages.
                        // fileProcessingErrorMessages.push(`[文件处理提示：文件 '${attachment.filename}' (${fileTypeForLog}) 内容为空或无法提取有效文本。]`);
                        // criticalFileErrorOccurred = true; // Decide if empty file is a "critical" error to stop LLM
                    }
                }
            }
        }

        if (criticalFileErrorOccurred) {
            const combinedErrorString = fileProcessingErrorMessages.join('\n');
            console.log("File processing errors occurred. Returning 400 to client:", combinedErrorString);
            return res.status(400).json({ 
                errorType: 'fileProcessingError', 
                message: combinedErrorString || "一个或多个文件处理失败。"
            });
        }
        
        // If we reach here, no critical file errors occurred (or no files were attached)
        // Proceed to prepare message for LLM

        let finalUserContentForLLM = userQuery;
        if (combinedFileTexts.trim().length > 0) { // Only add file texts if there are any
            finalUserContentForLLM = combinedFileTexts.trim() + "\n\nUser Query:\n" + userQuery;
        }
        
        if (!finalUserContentForLLM.trim() && (!req.body.attachments || req.body.attachments.length === 0)) {
            // If there's no user text and no files were processed successfully (or no files to begin with)
            // This check might be redundant if the frontend already prevents sending empty messages.
             return res.status(400).json({ errorType: 'emptyMessageError', message: '不能发送空消息或仅包含无法处理的文件。' });
        }

        const messagesForLLM = [{ role: 'user', content: finalUserContentForLLM }];
        const requestBodyForLLM = { ...req.body, messages: messagesForLLM, stream: true };
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
            // Check if response is JSON, otherwise send plain text
            try {
                const errorJson = JSON.parse(errorText);
                return res.status(llmResponse.status).json({ errorType: 'llmError', ...errorJson });
            } catch (e) {
                return res.status(llmResponse.status).json({ errorType: 'llmError', message: `LLM API Error: ${errorText}` });
            }
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        llmResponse.body.pipe(res); // Simplifies piping the stream
        
        llmResponse.body.on('error', (err) => { // Added error handling for the source stream
            console.error('Error in LLM response stream:', err);
            if (!res.headersSent) {
                 res.status(500).json({ errorType: 'streamError', message: 'LLM 响应流错误' });
            } else {
                res.end();
            }
        });

    } catch (err) { // Catch-all for the entire /api/relay block
        console.error('Relay error in /api/relay (outer try-catch):', err);
        if (!res.headersSent) {
             res.status(500).json({ errorType: 'relayGenericError', message: '服务器中继处理错误: ' + err.message });
        } else {
            res.end();
        }
    }
});

const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    // 提示用户可以通过服务器的实际IP地址访问
    console.log(`To access from other devices, use http://<your_server_ip>:${PORT} (replace <your_server_ip> with the server's actual IP address).`);
}); 