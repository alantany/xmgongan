// JavaScript for chat functionality will go here.
// For example, handling input, sending messages to a backend, and displaying responses.

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.querySelector('.input-area input[type="text"]');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const chatArea = document.getElementById('chat-area');
    const uploadFileButton = document.getElementById('upload-file-button');
    const fileUploadInput = document.getElementById('file-upload-input');
    const selectedFilesContainer = document.getElementById('selected-files-container');
    const newConversationBtn = document.getElementById('new-conversation-btn');

    let selectedFiles = []; // Store selected files
    let isFileListExpanded = false; // Track if the full file list is shown
    const maxInitialFilesToShow = 2;
    
    // 对话历史记录，存储完整的消息历史
    let conversationHistory = [];
    
    // 当前会话的文件内容，作为可选参考资料保留
    let sessionFileContent = null;

    // 新对话按钮事件处理
    newConversationBtn?.addEventListener('click', () => {
        // 清空对话历史
        conversationHistory = [];
        
        // 清空聊天区域
        chatArea.innerHTML = '';
        
        // 清空已选文件
        selectedFiles = [];
        renderSelectedFiles();
        
        // 清空输入框
        inputField.value = '';
        
        console.log('已开始新对话，历史记录已清空');
    });

    // Trigger file input click when upload button is clicked
    uploadFileButton.addEventListener('click', () => {
        fileUploadInput.accept = ".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpeg,.jpg,.png,.csv,.wps"; // Add .wps
        fileUploadInput.click();
    });

    // Handle file selection
    fileUploadInput.addEventListener('change', (event) => {
        const newFiles = Array.from(event.target.files);
        let addedCount = 0;
        let duplicateCount = 0;
        
        // 追加新文件到已选文件列表，并去重（基于文件名和大小）
        newFiles.forEach(newFile => {
            // 检查是否已存在相同的文件（通过文件名和大小判断）
            const isDuplicate = selectedFiles.some(existingFile => 
                existingFile.name === newFile.name && 
                existingFile.size === newFile.size
            );
            
            if (!isDuplicate) {
                selectedFiles.push(newFile);
                addedCount++;
            } else {
                duplicateCount++;
            }
        });
        
        // 给用户友好的提示
        if (duplicateCount > 0 && addedCount > 0) {
            console.log(`添加了 ${addedCount} 个新文件，跳过了 ${duplicateCount} 个重复文件`);
        } else if (duplicateCount > 0 && addedCount === 0) {
            console.log(`所选的 ${duplicateCount} 个文件已存在，未添加任何新文件`);
        } else if (addedCount > 0) {
            console.log(`成功添加了 ${addedCount} 个文件`);
        }
        
        // 如果有新文件被添加，重置展开状态
        if (newFiles.length > 0) {
            isFileListExpanded = false;
        }
        
        renderSelectedFiles();
        fileUploadInput.value = ''; // Reset file input to allow re-selecting the same file
    });

    function renderSelectedFiles() {
        selectedFilesContainer.innerHTML = '';
        if (selectedFiles.length === 0) {
            isFileListExpanded = false; // Ensure state is reset if no files
            return;
        }

        // 添加文件数量和清空按钮的标题栏
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 4px 8px; background: rgba(79, 70, 229, 0.1); border-radius: 4px;';
        
        const fileCountSpan = document.createElement('span');
        fileCountSpan.textContent = `已选择 ${selectedFiles.length} 个文件`;
        fileCountSpan.style.cssText = 'font-size: 14px; color: #4F46E5; font-weight: 500;';
        
        const clearAllBtn = document.createElement('button');
        clearAllBtn.textContent = '清空所有';
        clearAllBtn.style.cssText = 'padding: 2px 8px; font-size: 12px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer;';
        clearAllBtn.title = '清空所有已选文件';
        clearAllBtn.onclick = () => {
            selectedFiles.length = 0; // 清空数组
            isFileListExpanded = false;
            renderSelectedFiles();
        };
        
        headerDiv.appendChild(fileCountSpan);
        headerDiv.appendChild(clearAllBtn);
        selectedFilesContainer.appendChild(headerDiv);

        const list = document.createElement('ul');
        const filesToRender = isFileListExpanded ? selectedFiles : selectedFiles.slice(0, maxInitialFilesToShow);

        filesToRender.forEach(file => {
            const listItem = document.createElement('li');
            listItem.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.onclick = () => {
                selectedFiles = selectedFiles.filter(f => f !== file);
                // If the list was expanded and now has fewer files than maxInitial, 
                // or if it becomes empty, reset expansion or re-render correctly.
                if (selectedFiles.length <= maxInitialFilesToShow) {
                    isFileListExpanded = false;
                }
                renderSelectedFiles();
            };
            listItem.appendChild(removeBtn);
            list.appendChild(listItem);
        });
        selectedFilesContainer.appendChild(list);

        if (selectedFiles.length > maxInitialFilesToShow) {
            const toggleBtn = document.createElement('button');
            toggleBtn.classList.add('toggle-file-list-btn'); // Add class for styling
            if (isFileListExpanded) {
                toggleBtn.textContent = '收起';
            } else {
                toggleBtn.textContent = `还有 ${selectedFiles.length - maxInitialFilesToShow} 个文件... (点击展开)`;
            }
            toggleBtn.onclick = () => {
                isFileListExpanded = !isFileListExpanded;
                renderSelectedFiles();
            };
            selectedFilesContainer.appendChild(toggleBtn);
        }
    }

    // Send message when Send button is clicked
    sendButton.addEventListener('click', sendMessage);

    // Send message when Enter key is pressed in input field
    inputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent new line
            sendMessage();
        }
    });

    // Example: Log when mic button is clicked
    if (micButton) {
        // Web Speech API setup
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let recognition;
        const originalPlaceholder = inputField.placeholder; // Store original placeholder

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false; // Stop after first pause
            recognition.lang = 'zh-CN'; // Set language to Chinese
            recognition.interimResults = false; // Get final results
            recognition.maxAlternatives = 1;

            // Custom flag to track if recognition is active
            let recognitionIsActive = false;

        micButton.addEventListener('click', () => {
                if (recognitionIsActive) {
                    recognition.stop(); // Request to stop
                    // UI updates (placeholder, button style) handled by onend or onerror
                } else {
                    try {
                        inputField.value = ""; // Clear input field before starting
                        inputField.placeholder = "正在聆听，请说话..."; // Immediate feedback
                        micButton.classList.add('recording'); // Immediate visual feedback
                        micButton.title = "停止录音";
                        recognition.start();
                        // Further UI updates will be handled by onstart if successful
                    } catch (e) {
                        console.error("Speech recognition start error immediately caught:", e);
                        appendMessage("无法启动语音识别: " + e.message, 'ai');
                        recognitionIsActive = false; // Ensure state is correct
                        micButton.classList.remove('recording');
                        micButton.title = "语音输入";
                        inputField.placeholder = originalPlaceholder; // Restore placeholder on error
                    }
                }
            });

            recognition.onstart = () => {
                console.log('Voice recognition actually started.');
                recognitionIsActive = true;
                // UI updated in click handler for immediate feedback, confirm here or adjust if needed
                micButton.classList.add('recording');
                micButton.title = "停止录音";
                inputField.placeholder = "正在聆听，请说话...";
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                inputField.value = inputField.value ? inputField.value + ' ' + transcript : transcript;
                inputField.focus(); // Focus on input field after transcript
                // Placeholder will be restored by onend
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                let errorMessage = '语音识别发生错误';
                if (event.error === 'no-speech') {
                    errorMessage = '未检测到语音，请重试。';
                } else if (event.error === 'audio-capture') {
                    errorMessage = '无法捕获麦克风音频，请检查权限。';
                } else if (event.error === 'not-allowed') {
                    errorMessage = '麦克风权限未授予或被阻止。';
                } else if (event.error === 'aborted') {
                    errorMessage = '语音识别已中止。'; // Common if stopped manually or by short silence
                } else if (event.error === 'network') {
                    errorMessage = '语音识别网络错误。';
                } else if (event.error === 'service-not-allowed') {
                    errorMessage = '语音识别服务未授权。';
                }
                // Only show error in chat if it's not a simple abort or no-speech after a stop command
                if (event.error !== 'aborted' && event.error !== 'no-speech') {
                    appendMessage(errorMessage, 'ai');
                }
                // onend will also be called, so UI updates (placeholder, button) are handled there
            };

            recognition.onend = () => {
                console.log('Voice recognition ended.');
                recognitionIsActive = false;
                micButton.classList.remove('recording');
                micButton.title = "语音输入";
                inputField.placeholder = originalPlaceholder; // Restore original placeholder
            };
            
        } else {
            micButton.disabled = true;
            micButton.title = "浏览器不支持语音识别";
            console.warn('Speech Recognition not supported by this browser.');
            // Optionally inform the user that the feature is not available
            // appendMessage('您的浏览器不支持语音识别功能。', 'ai');
        }
    }

    // Function to append messages to the chat area
    function appendMessage(text, sender, messageId) {
        let messageElement = messageId ? document.getElementById(messageId) : null;
        let textNodeP;
        let iconContainer;

        const userSvgIcon = `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px; margin-right: 8px;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;
        const aiSvgIcon = `<svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"> <rect x="12" y="16" width="40" height="32" rx="8" fill="#4F46E5"/> <circle cx="24" cy="32" r="4" fill="white"/> <circle cx="40" cy="32" r="4" fill="white"/> <path d="M20 48c2 4 8 6 12 6s10-2 12-6" stroke="white" stroke-width="2" stroke-linecap="round"/> <path d="M32 10v6" stroke="#4F46E5" stroke-width="4" stroke-linecap="round"/> <circle cx="32" cy="10" r="4" fill="#4F46E5"/></svg>`;

        if (messageElement) { // Updating an existing message
            iconContainer = messageElement.querySelector('.message-icon'); // Icon should already exist
            textNodeP = messageElement.querySelector('p');
            
            // If for some reason p tag is missing (should not happen with correct initial creation)
            if (!textNodeP) {
                textNodeP = document.createElement('p');
                if (iconContainer && iconContainer.nextSibling) {
                    messageElement.insertBefore(textNodeP, iconContainer.nextSibling);
                } else if (iconContainer) {
                    messageElement.appendChild(textNodeP);
                } else { // Should not happen if icon is always there for AI messages
                    messageElement.appendChild(textNodeP);
                }
            }
        } else { // Creating a new message
            messageId = sender + '-' + Date.now();
            messageElement = document.createElement('div');
            messageElement.id = messageId;
        messageElement.classList.add('message', `${sender}-message`);
        
            iconContainer = document.createElement('span');
            iconContainer.classList.add('message-icon');
            iconContainer.innerHTML = sender === 'user' ? userSvgIcon : aiSvgIcon;
            messageElement.appendChild(iconContainer);

            textNodeP = document.createElement('p');
            messageElement.appendChild(textNodeP);
            
            if (chatArea) {
        chatArea.appendChild(messageElement);
            } else {
                console.error("Chat area not found for new message!");
                return null;
            }
        }

        // Update text content
        if (sender === 'ai' && typeof marked !== 'undefined') {
            const markdownInput = (text === null || typeof text === 'undefined') ? '' : String(text);
            textNodeP.innerHTML = marked.parse(markdownInput); // Render Markdown for AI
        } else {
            textNodeP.textContent = (text === null || typeof text === 'undefined') ? '' : String(text); // Plain text for user or if marked is not available
        }
        
        // Manage 'ai-thinking' class correctly for new or updated messages
        if (sender === 'ai-thinking') {
            if (!messageElement.classList.contains('ai-thinking')) {
            messageElement.classList.add('ai-thinking');
            }
        } else {
            // If it's a normal AI message (not thinking), ensure thinking class is removed
            // This is important if a thinking message bubble is being updated to a real AI message
            if (sender === 'ai' && messageElement.classList.contains('ai-thinking')){
                messageElement.classList.remove('ai-thinking');
            }
        }

        if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        return messageId; 
    }

    function removeThinking() {
        const thinkingElements = chatArea.querySelectorAll('.ai-thinking');
        thinkingElements.forEach(el => el.remove());
    }

    async function getActiveModel() {
        const res = await fetch('/api/models/active');
        if (!res.ok) return null;
        return await res.json();
    }

    async function sendMessage() {
        const userInput = inputField.value.trim();
        // 允许有文本输入或选择了文件时发送消息
        if (!userInput && selectedFiles.length === 0) return;

        // 显示用户消息（如果只有文件没有文本，显示占位符）
        const displayUserMessage = userInput || (selectedFiles.length > 0 ? "[上传文件...]" : "");
        appendMessage(displayUserMessage, 'user');
        inputField.value = '';
        
        // 创建思考消息
        const thinkingMessageId = appendMessage('AI正在思考...', 'ai-thinking'); 

        try {
            const activeModel = await getActiveModel();
            if (!activeModel) {
                removeThinking();
                appendMessage('错误：没有激活的模型。', 'ai');
                return;
            }

            // 处理文件上传
            let fileAttachmentsForRequestBody = [];
            let textFileCombinedContent = "";
            
            if (selectedFiles.length > 0) {
                const filePromises = selectedFiles.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve({ name: file.name, type: file.type, content: reader.result });
                        reader.onerror = reject;

                        if (file.type.startsWith('image/')) {
                            reader.readAsDataURL(file); // Base64 for images
                        } else if (file.type === 'text/plain') {
                            reader.readAsText(file); // Text for .txt
                        } else if ([
                            'application/pdf',
                            'application/msword', // .doc
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
                            'application/vnd.ms-excel', // .xls
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                            'text/csv',
                            'application/vnd.ms-works'
                        ].includes(file.type) || file.name.toLowerCase().endsWith('.wps')) {
                            reader.readAsDataURL(file); // Base64 for document types
                        } else {
                            console.warn(`Unsupported file type: ${file.name} (${file.type}). Trying Base64.`);
                            reader.readAsDataURL(file);
                        }
                    });
                });

                const processedFiles = await Promise.all(filePromises);

                for (const pf of processedFiles) {
                    if (!pf.content) continue;

                    if (pf.type.startsWith('image/')) {
                        fileAttachmentsForRequestBody.push({
                            filename: pf.name,
                            mime_type: pf.type,
                            data: pf.content.split(',')[1] // Base64 data
                        });
                    } else if (pf.type === 'text/plain') {
                        textFileCombinedContent += `--- BEGIN FILE: ${pf.name} ---\n${pf.content}\n--- END FILE: ${pf.name} ---\n\n`;
                    } else { // PDF, DOCX, XLSX etc. as Base64
                        fileAttachmentsForRequestBody.push({
                            filename: pf.name,
                            mime_type: pf.type,
                            data: pf.content.split(',')[1] // Remove "data:...;base64," prefix
                        });
                    }
                }
            }

            // 构建当前用户消息内容
            let currentUserMessageContent = "";
            if (textFileCombinedContent) {
                currentUserMessageContent += textFileCombinedContent;
            }
            if (userInput) {
                currentUserMessageContent += userInput;
            }
            if (fileAttachmentsForRequestBody.length > 0) {
                const fileList = fileAttachmentsForRequestBody.map(f => f.filename).join(', ');
                currentUserMessageContent += `\n[附件文件: ${fileList}]`;
            }
            
            // 确保有内容
            if (!currentUserMessageContent.trim()) {
                currentUserMessageContent = "[处理上传的文件]";
            }

            // 将用户消息添加到对话历史
            const currentUserMessage = { role: 'user', content: currentUserMessageContent.trim() };
            conversationHistory.push(currentUserMessage);
            
            console.log('用户消息已添加到历史记录:', currentUserMessage);
            console.log('发送给大模型的对话历史:', JSON.stringify(conversationHistory, null, 2));
            
            // 限制历史记录长度，避免超出上下文限制 (保留最近10轮对话)
            const MAX_HISTORY_TURNS = 10;
            if (conversationHistory.length > MAX_HISTORY_TURNS * 2) { // 每轮包含用户和AI消息
                conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
                console.log('历史记录已截断，当前长度:', conversationHistory.length);
            }
            
            // 发送包含历史记录的完整消息
            await fetchLLMReply(activeModel, conversationHistory, fileAttachmentsForRequestBody, thinkingMessageId);
            
            // 清空已选文件
            selectedFiles = [];
            renderSelectedFiles();

        } catch (error) {
            removeThinking();
            appendMessage(`错误: ${error.message}`, 'ai');
            console.error("Detailed error:", error);
        }
    }

    async function fetchLLMReply(model, messages, attachments, baseMessageId) { // Renamed thinkingMessageId to baseMessageId for clarity
        // 根据模型类型适配不同API
        if (model.type === 'openrouter') {
            return await callOpenRouter(model, messages, attachments, baseMessageId);
        } else if (model.type === 'ollama') {
            // Ollama简化处理
            const latestMessage = messages[messages.length - 1]?.content || '';
            return await callOllama(model, latestMessage);
        } else if (model.type === 'telcom') {
            // Telcom简化处理
            const latestMessage = messages[messages.length - 1]?.content || '';
            return await callTelcom(model, latestMessage);
        } else {
            throw new Error('暂不支持的模型类型: ' + model.type);
        }
    }

    // OpenRouter API
    function cleanupExcessiveWhitespace(text) {
        const cleanedText = text.replace(/\n{3,}/g, '\n\n');
        return cleanedText.replace(/^\s+/, '');
    }

    async function callOpenRouter(model, messages, attachments, baseMessageId) { // Renamed thinkingMessageId to baseMessageId for clarity
        try {
            const requestBody = {
                model: model.modelName,
                messages: messages,
                temperature: 0.7,
                max_tokens: 4000,
                // stream: true is now set by the backend /api/relay
            };
            
            if (attachments && attachments.length > 0) {
                requestBody.attachments = attachments;
            }

            const response = await fetch('/api/relay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (baseMessageId) {
                appendMessage('正在接收AI回复...', 'ai', baseMessageId);
            } else {
                console.error("baseMessageId not provided to callOpenRouter");
                removeThinking();
                baseMessageId = appendMessage('正在接收AI回复...', 'ai');
                if (!baseMessageId) return;
            }

            if (!response.ok) {
                const errorText = await response.text(); 
                console.error('API Relay Error:', response.status, errorText);
                try {
                    const errorJson = JSON.parse(errorText);
                    // Check if it's our specific file processing error from the backend
                    if (errorJson.errorType === 'fileProcessingError') {
                        appendMessage(errorJson.message || '一个或多个文件处理失败。', 'ai', baseMessageId);
                    } else { // Other backend errors (LLM, config, etc.)
                        appendMessage(`错误: ${errorJson.message || errorJson.error || errorText}`, 'ai', baseMessageId);
                    }
                } catch (e) { // If errorText is not JSON
                    appendMessage(`错误: ${errorText}`, 'ai', baseMessageId);
                }
                return; 
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = '';
            let ellipsisInterval = null; // Variable to hold the interval ID

            // Start ellipsis animation for "Receiving..." message
            if (baseMessageId) {
                let dotCount = 0;
                const baseText = "正在接收AI回复";
                ellipsisInterval = setInterval(() => {
                    dotCount = (dotCount + 1) % 4; // 0, 1, 2, 3
                    const dots = Array(dotCount).fill('.').join(''); // '', '.', '..', '...'
                    // Update the message content with animated ellipsis
                    // We pass 'ai-receiving' as sender to prevent marked.parse if text hasn't changed much
                    // and to potentially style it differently if needed, though appendMessage currently doesn't use it beyond 'ai' or 'user' for markdown.
                    appendMessage(baseText + dots, 'ai', baseMessageId);
                }, 500); // Adjust speed as needed
            }

            function processStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        clearInterval(ellipsisInterval); 
                        appendMessage(accumulatedResponse, 'ai', baseMessageId);
                        
                        // 将AI回复添加到对话历史
                        if (accumulatedResponse && accumulatedResponse.trim()) {
                            const aiMessage = { 
                                role: 'assistant', 
                                content: accumulatedResponse.trim() 
                            };
                            conversationHistory.push(aiMessage);
                            console.log('AI回复已添加到历史记录:', aiMessage);
                            console.log('当前完整对话历史:', JSON.stringify(conversationHistory, null, 2));
                        }
                        
                        return;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    let hasNewContent = false; // Flag to check if this chunk added visible content

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.substring(6);
                            if (jsonStr.trim() === '[DONE]') {
                                clearInterval(ellipsisInterval);
                                appendMessage(accumulatedResponse, 'ai', baseMessageId); // Final update
                                
                                // 将AI回复添加到对话历史
                                if (accumulatedResponse && accumulatedResponse.trim()) {
                                    const aiMessage = { 
                                        role: 'assistant', 
                                        content: accumulatedResponse.trim() 
                                    };
                                    conversationHistory.push(aiMessage);
                                    console.log('AI回复已添加到历史记录:', aiMessage);
                                    console.log('当前完整对话历史:', JSON.stringify(conversationHistory, null, 2));
                                }
                                
                                return;
                            }
                            try {
                                const parsed = JSON.parse(jsonStr);
                                
                                // 处理包含文件内容的processed_user_message，更新历史记录
                                if (parsed.type === 'processed_user_message') {
                                    // 只有当消息包含文件内容时才更新历史记录
                                    if (parsed.message.content.includes('--- Content from file:')) {
                                        // 找到最后一条用户消息并替换为包含文件内容的完整版本
                                        for (let i = conversationHistory.length - 1; i >= 0; i--) {
                                            if (conversationHistory[i].role === 'user') {
                                                conversationHistory[i] = parsed.message;
                                                break;
                                            }
                                        }
                                        console.log('已更新对话历史中的用户消息，包含文件内容');
                                    }
                                    continue; // 跳过这个特殊消息的其他处理
                                }
                                
                                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                    accumulatedResponse += parsed.choices[0].delta.content;
                                    hasNewContent = true; 
                                }
                            } catch (e) {
                                // console.warn('Error parsing stream JSON:', jsonStr, e);
                            }
                        }
                    }

                    // If new content was actually added, stop ellipsis and update message with content
                    if (hasNewContent) {
                        if (ellipsisInterval) {
                            clearInterval(ellipsisInterval);
                            ellipsisInterval = null; 
                        }
                        appendMessage(accumulatedResponse, 'ai', baseMessageId); 
                    } else if (!ellipsisInterval && !done) {
                        // If ellipsis was stopped but there's no new content yet (e.g. empty data chunks) and not done,
                        // potentially restart it or ensure the "Receiving..." message stays without dots if preferred.
                        // For now, we do nothing, relying on the interval to continue if it wasn't cleared.
                    }

                    if (!done) {
                        processStream(); 
                    }
                }).catch(err => {
                    clearInterval(ellipsisInterval); // Stop ellipsis on error
                    console.error('Error reading stream from /api/relay:', err);
                    appendMessage('读取回复流时出错。', 'ai', baseMessageId);
                });
            }
            processStream(); // Start processing the stream
            
            // Since we are streaming, this function no longer returns the full AI reply directly.
            // The reply is appended to the DOM reactively.
            return; // Or return a promise that resolves when stream is done, if needed elsewhere

        } catch (error) {
            console.error('callOpenRouter Fetch/Setup Error:', error);
            // If an error occurs, ensure ellipsisInterval is cleared if it was started
            if (ellipsisInterval) {
                 clearInterval(ellipsisInterval);
            }
            if (baseMessageId) {
                appendMessage(`调用OpenRouter出错: ${error.message}`, 'ai', baseMessageId);
            } else {
                removeThinking(); // Fallback if no baseMessageId
                appendMessage(`调用OpenRouter出错: ${error.message}`, 'ai');
            }
        }
    }

    // Ollama API
    async function callOllama(model, userInput) {
        const res = await fetch(model.apiUrl + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model.modelName,
                messages: [
                    { role: 'user', content: userInput }
                ]
            })
        });
        if (!res.ok) throw new Error('Ollama请求失败');
        const data = await res.json();
        return data.message?.content || '[无回复]';
    }

    // Telcom DeepSeek API
    async function callTelcom(model, userInput) {
        const res = await fetch(model.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model.modelName,
                messages: [
                    { role: 'user', content: userInput }
                ]
            })
        });
        if (!res.ok) throw new Error('Telcom请求失败');
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '[无回复]';
    }
}); 