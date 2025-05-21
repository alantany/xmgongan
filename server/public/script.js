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

    let selectedFiles = []; // Store selected files
    let isFileListExpanded = false; // Track if the full file list is shown
    const maxInitialFilesToShow = 2;

    // Trigger file input click when upload button is clicked
    uploadFileButton.addEventListener('click', () => {
        fileUploadInput.accept = ".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpeg,.jpg,.png,.csv,.wps"; // Add .wps
        fileUploadInput.click();
    });

    // Handle file selection
    fileUploadInput.addEventListener('change', (event) => {
        selectedFiles = Array.from(event.target.files);
        isFileListExpanded = false; // Reset expanded state on new selection
        renderSelectedFiles();
        fileUploadInput.value = ''; // Reset file input to allow re-selecting the same file
    });

    function renderSelectedFiles() {
        selectedFilesContainer.innerHTML = '';
        if (selectedFiles.length === 0) {
            isFileListExpanded = false; // Ensure state is reset if no files
            return;
        }

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
        // Allow sending message if there is text input or files selected
        if (!userInput && selectedFiles.length === 0) return;

        // Use placeholder if input is empty but files are present
        const displayUserMessage = userInput || (selectedFiles.length > 0 ? "[发送文件中...]" : "");
        if(displayUserMessage) appendMessage(displayUserMessage, 'user');
        
        inputField.value = '';
        // Create thinking message and store its ID
        const thinkingMessageId = appendMessage('AI正在思考...', 'ai-thinking'); 

        try {
            const activeModel = await getActiveModel();
            if (!activeModel) {
                removeThinking();
                appendMessage('错误：没有激活的模型。', 'ai');
                return;
            }

            let userMessageContentParts = [];
            if (userInput) {
                userMessageContentParts.push({ type: 'text', text: userInput });
            }
            
            const fileAttachmentsForRequestBody = []; // For non-image base64 data for 'attachments' field

            if (selectedFiles.length > 0) {
                const filePromises = selectedFiles.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve({ name: file.name, type: file.type, content: reader.result, file_obj: file });
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
                            'application/vnd.ms-works', // Common MIME for .wps, though often generic
                            // Add other potential WPS MIME types if known, or rely on extension for backend.
                            // For files not matching specific MIME types but ending with .wps, we can still try backend processing.
                            (file.name.toLowerCase().endsWith('.wps') && !file.type) // If no specific MIME but ends with .wps
                        ].includes(file.type) || file.name.toLowerCase().endsWith('.wps')) { // Also check extension directly
                            reader.readAsDataURL(file); // Base64 for these document types, including WPS
                        } else {
                            console.warn(`Unsupported file type from browser: ${file.name} (${file.type}). Trying to read as Base64 for backend processing.`);
                            // Fallback for unknown types, potentially including CSV if MIME type isn't 'text/csv'
                            // The backend will have the final say on processing based on filename/content.
                            reader.readAsDataURL(file);
                        }
                    });
                });

                const processedFiles = await Promise.all(filePromises);
                let textFileCombinedContent = "";

                for (const pf of processedFiles) {
                    if (pf.error) {
                        appendMessage(`无法处理文件 ${pf.name}: ${pf.error}`, 'ai');
                        continue;
                    }
                    if (!pf.content) continue;

                    if (pf.type.startsWith('image/')) {
                        fileAttachmentsForRequestBody.push({
                            filename: pf.name,
                            mime_type: pf.type,
                            data: pf.content.split(',')[1] // Base64 data
                        });
                        const imagePlaceholder = `[用户上传了图片: ${pf.name} - 将由后端OCR处理]`;
                        if (userMessageContentParts.find(p => p.type === 'text')) {
                            userMessageContentParts.find(p => p.type === 'text').text += `\\n${imagePlaceholder}`;
                        } else {
                            userMessageContentParts.unshift({ type: 'text', text: imagePlaceholder });
                        }
                    } else if (pf.type === 'text/plain') {
                        textFileCombinedContent += `--- BEGIN FILE: ${pf.name} ---\n${pf.content}\n--- END FILE: ${pf.name} ---\n\n`;
                    } else { // PDF, DOCX, XLSX etc. as Base64
                        fileAttachmentsForRequestBody.push({
                            filename: pf.name,
                            mime_type: pf.type,
                            data: pf.content.split(',')[1] // Remove "data:...;base64," prefix
                        });
                        // Add a placeholder in the text message part
                        const filePlaceholder = `[用户上传了文件: ${pf.name}]`;
                        if (userMessageContentParts.find(p => p.type === 'text')) {
                            userMessageContentParts.find(p => p.type === 'text').text += `\n${filePlaceholder}`;
                        } else {
                            userMessageContentParts.unshift({ type: 'text', text: filePlaceholder });
                        }
                    }
                }
                
                if (textFileCombinedContent) {
                    if (userMessageContentParts.find(p => p.type === 'text')){
                        userMessageContentParts.find(p => p.type === 'text').text = textFileCombinedContent + userMessageContentParts.find(p => p.type === 'text').text;
                    } else {
                        userMessageContentParts.unshift({ type: 'text', text: textFileCombinedContent });
                    }
                }
            }
            
            // Ensure there's at least one text part if other parts exist or if it was only files
            if (userMessageContentParts.length > 0 && !userMessageContentParts.find(p=>p.type === 'text')){
                 userMessageContentParts.unshift({ type: 'text', text: "[处理上传的文件]" });
            } else if (userMessageContentParts.length === 0 && selectedFiles.length > 0){
                 userMessageContentParts.push({ type: 'text', text: "[处理上传的文件]" });
            }
            
            const messages = [{ role: 'user', content: userMessageContentParts }];
            // Pass thinkingMessageId to fetchLLMReply, so it can be updated
            await fetchLLMReply(activeModel, messages, fileAttachmentsForRequestBody, thinkingMessageId);
            
            selectedFiles = []; // Clear files after sending
            renderSelectedFiles(); // Update UI

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
            // Ollama might not support complex message structures or attachments directly in this way.
            // For simplicity, we'll just send the first text part if available.
            const simpleTextInput = messages[0]?.content?.find(p => p.type === 'text')?.text || '';
            return await callOllama(model, simpleTextInput);
        } else if (model.type === 'telcom') {
            // Similar to Ollama, Telcom might expect simpler input.
            const simpleTextInput = messages[0]?.content?.find(p => p.type === 'text')?.text || '';
            return await callTelcom(model, simpleTextInput);
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
                                return;
                            }
                            try {
                                const parsed = JSON.parse(jsonStr);
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