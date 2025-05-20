// JavaScript for chat functionality will go here.
// For example, handling input, sending messages to a backend, and displaying responses.

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.querySelector('.input-area input[type="text"]');
    const sendButton = document.getElementById('send-button');
    const micButton = document.querySelector('.input-area .mic-button');
    const chatArea = document.getElementById('chat-area');
    const uploadFileButton = document.getElementById('upload-file-button');
    const fileUploadInput = document.getElementById('file-upload-input');
    const selectedFilesContainer = document.getElementById('selected-files-container');

    let selectedFiles = []; // Store selected files
    let isFileListExpanded = false; // Track if the full file list is shown
    const maxInitialFilesToShow = 2;

    // Trigger file input click when upload button is clicked
    uploadFileButton.addEventListener('click', () => {
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
        micButton.addEventListener('click', () => {
            console.log('Microphone button clicked');
            // Implement voice input functionality here
        });
    }

    // Function to append messages to the chat area
    function appendMessage(text, sender, messageId) {
        let messageElement = messageId ? document.getElementById(messageId) : null;
        let textNode;

        if (messageElement) {
            // Update existing message element (for streaming)
            textNode = messageElement.querySelector('p');
            if (!textNode) { // Should not happen if structured correctly
                textNode = document.createElement('p');
                messageElement.appendChild(textNode);
            }
        } else {
            // Create new message element
            messageId = sender + '-' + Date.now(); // Generate a unique ID for new messages
            messageElement = document.createElement('div');
            messageElement.id = messageId;
            messageElement.classList.add('message', `${sender}-message`);
            textNode = document.createElement('p');
            messageElement.appendChild(textNode);
            
            if (chatArea) {
                chatArea.appendChild(messageElement);
            } else {
                console.error("Chat area not found for new message!");
                return null; // Cannot append
            }
        }

        if (sender === 'ai' && typeof marked !== 'undefined') {
            // Ensure text is a string before parsing. Default to empty string if null/undefined.
            const markdownInput = (text === null || typeof text === 'undefined') ? '' : String(text);
            textNode.innerHTML = marked.parse(markdownInput);
        } else {
            textNode.textContent = (text === null || typeof text === 'undefined') ? '' : String(text);
        }
        
        if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;

        if (sender === 'ai-thinking' && !messageElement.classList.contains('ai-thinking')) {
            messageElement.classList.add('ai-thinking');
        }
        return messageId; // Return the ID so it can be used for updates
    }

    function removeThinking() {
        if (chatArea) {
            const thinking = chatArea.querySelector('.ai-thinking');
            if (thinking) thinking.remove();
        } else {
            console.error("Chat area not found when trying to remove thinking message!");
        }
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
        appendMessage('AI正在思考...', 'ai-thinking');

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
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
                        ].includes(file.type)) {
                            reader.readAsDataURL(file); // Base64 for these document types
                        } else {
                            console.warn(`Unsupported file type: ${file.name} (${file.type}). Skipping.`);
                            resolve({ name: file.name, type: file.type, content: null, error: 'Unsupported file type' });
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
            const aiReply = await fetchLLMReply(activeModel, messages, fileAttachmentsForRequestBody);
            
            removeThinking();
            appendMessage(aiReply, 'ai');
            
            selectedFiles = []; // Clear files after sending
            renderSelectedFiles(); // Update UI

        } catch (error) {
            removeThinking();
            appendMessage(`错误: ${error.message}`, 'ai');
            console.error("Detailed error:", error);
        }
    }

    async function fetchLLMReply(model, messages, attachments) { // Added attachments argument
        // 根据模型类型适配不同API
        if (model.type === 'openrouter') {
            return await callOpenRouter(model, messages, attachments);
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

    async function callOpenRouter(model, messages, attachments) {
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
                    // 'Accept': 'text/event-stream' // Front-end doesn't need to set this, backend does
                },
                body: JSON.stringify(requestBody)
            });

            removeThinking(); // Remove "AI is thinking..." once stream starts or if error

            if (!response.ok) {
                const errorText = await response.text(); 
                console.error('API Relay Error:', response.status, errorText);
                try {
                    const errorJson = JSON.parse(errorText);
                    appendMessage(`错误: ${errorJson.error || errorText}`, 'ai');
                } catch (e) {
                    appendMessage(`错误: ${errorText}`, 'ai');
                }
                return; // Stop processing on error
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = '';
            // Create an AI message bubble with an initial "Receiving..." message
            let aiMessageId = appendMessage('正在接收AI回复...', 'ai'); 
            if (!aiMessageId) { // Could not create message bubble
                console.error("Failed to create AI message bubble for streaming.");
                return; 
            }

            // Function to process stream chunks
            function processStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        // Stream finished
                        // console.log("Stream complete.");
                        // Markdown processing will happen here on accumulatedResponse later
                        return;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    // Assuming SSE format from OpenRouter via our relay
                    // Example chunk: "data: {\"id\":\"cmpl-xxx\", \"choices\":[{\"delta\":{\"content\":\"Hello\"}}], ...}\n\n"
                    // Or just "data: { ... }\n\ndata: { ... }\n\n"
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.substring(6);
                            if (jsonStr.trim() === '[DONE]') { // OpenRouter specific DONE signal
                                // console.log("Stream marked [DONE]");
                                return;
                            }
                            try {
                                const parsed = JSON.parse(jsonStr);
                                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                    accumulatedResponse += parsed.choices[0].delta.content;
                                    appendMessage(accumulatedResponse, 'ai', aiMessageId); // Update existing bubble
                                }
                            } catch (e) {
                                // console.warn('Error parsing stream JSON:', jsonStr, e);
                                // Might be a non-JSON part of the stream or an error, ignore for now or log
                            }
                        }
                    }
                    processStream(); // Continue reading
                }).catch(err => {
                    console.error('Error reading stream from /api/relay:', err);
                    appendMessage('读取回复流时出错。', 'ai', aiMessageId);
                });
            }
            processStream(); // Start processing the stream
            
            // Since we are streaming, this function no longer returns the full AI reply directly.
            // The reply is appended to the DOM reactively.
            return; // Or return a promise that resolves when stream is done, if needed elsewhere

        } catch (error) {
            console.error('callOpenRouter Fetch/Setup Error:', error);
            removeThinking();
            appendMessage(`调用OpenRouter出错: ${error.message}`, 'ai');
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