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

    // 智能上下文长度管理函数
    function estimateTokens(text) {
        // 粗略估算：中文字符约1-2个token，英文单词约1.3个token，标点和空格约0.3个token
        if (typeof text !== 'string') return 0;
        
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        const otherChars = text.length - chineseChars - englishWords;
        
        return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.3);
    }

    function getMessageTokenCount(message) {
        if (typeof message.content === 'string') {
            return estimateTokens(message.content);
        } else if (Array.isArray(message.content)) {
            return message.content.reduce((total, part) => {
                if (part.type === 'text') {
                    return total + estimateTokens(part.text || '');
                }
                return total;
            }, 0);
        }
        return 0;
    }

    function getTotalTokens(messages) {
        return messages.reduce((total, msg) => total + getMessageTokenCount(msg), 0);
    }

    function manageContextLength(history, maxTokens) {
        if (history.length === 0) return history;
        
        let totalTokens = getTotalTokens(history);
        console.log(`当前对话历史token数: ${totalTokens}, 最大限制: ${maxTokens}`);
        
        if (totalTokens <= maxTokens) {
            return history;
        }
        
        // 计算需要删除的token数量
        const tokensToRemove = totalTokens - maxTokens;
        console.log(`需要删除约 ${tokensToRemove} tokens`);
        
        // 新策略：确保最新对话优先级最高，避免被文件内容"绑架"
        const messageAnalysis = history.map((msg, idx) => {
            const tokens = getMessageTokenCount(msg);
            const isFileMessage = isMessageContainingFile(msg);
            const distanceFromEnd = history.length - 1 - idx; // 0表示最新消息
            
            // 重新设计优先级：距离当前越近优先级越高
            let priority;
            if (distanceFromEnd === 0) {
                // 最新用户问题：绝对最高优先级
                priority = 10;
            } else if (distanceFromEnd === 1) {
                // 最新AI回复：次高优先级
                priority = 9;
            } else if (distanceFromEnd <= 3) {
                // 最近2轮对话：高优先级
                priority = 8;
            } else if (isFileMessage) {
                // 文件消息：中等优先级（重要但不能压过新问题）
                priority = 5;
            } else {
                // 普通历史对话：低优先级
                priority = 1;
            }
            
            return {
                index: idx,
                message: msg,
                tokens: tokens,
                isFileMessage: isFileMessage,
                distanceFromEnd: distanceFromEnd,
                priority: priority,
                role: msg.role
            };
        });
        
        console.log('消息优先级分析:', messageAnalysis.map(m => 
            `${m.role}:${m.tokens}tokens(距今${m.distanceFromEnd}步,${m.isFileMessage ? '文件' : '对话'},优先级${m.priority})`
        ).join(', '));
        
        // 按优先级排序，优先级低的先删除，但绝对保护最新2条消息
        const absoluteProtectionCount = Math.min(2, history.length); // 绝对保护最新2条
        const sortedForDeletion = messageAnalysis
            .filter(m => m.distanceFromEnd >= absoluteProtectionCount) // 绝对保护最新消息
            .sort((a, b) => a.priority - b.priority); // 优先级低的排前面
        
        let newHistory = [...history];
        let removedTokens = 0;
        
        // 智能删除策略：确保最新问题不被历史内容干扰
        for (const analysis of sortedForDeletion) {
            if (getTotalTokens(newHistory) <= maxTokens) {
                break; // 已经达到目标
            }
            
            // 如果是文件消息，采用更严格的条件
            if (analysis.isFileMessage) {
                const currentOverage = getTotalTokens(newHistory) - maxTokens;
                const fileToTextRatio = analysis.tokens / totalTokens;
                
                // 如果单个文件消息占比过大（>30%），或者超限严重（>15K），才删除
                if (currentOverage > 15000 || fileToTextRatio > 0.3) {
                    console.warn(`删除大文件消息: ${analysis.tokens} tokens (占比${(fileToTextRatio*100).toFixed(1)}%, 当前超限${currentOverage})`);
                } else {
                    console.log(`保护文件消息: ${analysis.tokens} tokens，当前超限${currentOverage}不足以删除`);
                    continue;
                }
            }
            
            // 删除这条消息
            const messageIndex = newHistory.findIndex(m => m === analysis.message);
            if (messageIndex !== -1) {
                newHistory.splice(messageIndex, 1);
                removedTokens += analysis.tokens;
                console.log(`删除${analysis.isFileMessage ? '文件' : '对话'}消息(距今${analysis.distanceFromEnd}步): ${analysis.tokens} tokens，累计删除: ${removedTokens} tokens`);
            }
        }
        
        const finalTokens = getTotalTokens(newHistory);
        console.log(`智能上下文管理完成 - 删除: ${removedTokens} tokens, 剩余: ${finalTokens} tokens, 保留: ${newHistory.length} 条消息`);
        
        // 分析最终保留的消息分布
        const finalFileMessages = newHistory.filter(msg => isMessageContainingFile(msg)).length;
        const recentMessages = newHistory.filter((msg, idx) => newHistory.length - 1 - idx < 4).length;
        console.log(`最终保留: ${finalFileMessages} 条文件消息, ${recentMessages} 条最近对话`);
        
        // 检查是否有效保护了最新用户问题
        if (newHistory.length > 0) {
            const latestMessage = newHistory[newHistory.length - 1];
            if (latestMessage.role === 'user') {
                console.log(`✓ 最新用户问题已保护，内容: "${getMessagePreview(latestMessage)}"`);
            }
        }
        
        // 如果还是超限，给出详细警告
        if (finalTokens > maxTokens) {
            console.warn(`警告：即使智能删除后仍超出限制 ${finalTokens - maxTokens} tokens`);
            console.warn('建议用户减少文件数量或将大文件分段处理');
        }
        
        return newHistory;
    }

    // 获取消息预览的辅助函数
    function getMessagePreview(message) {
        if (typeof message.content === 'string') {
            return message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
        } else if (Array.isArray(message.content)) {
            const textPart = message.content.find(part => part.type === 'text');
            if (textPart && textPart.text) {
                return textPart.text.substring(0, 50) + (textPart.text.length > 50 ? '...' : '');
            }
        }
        return '[消息内容无法预览]';
    }

    // 判断消息是否包含文件内容的辅助函数
    function isMessageContainingFile(message) {
        if (typeof message.content === 'string') {
            // 检查是否包含文件内容标记
            return message.content.includes('--- Content from file:') || 
                   message.content.includes('[用户上传了文件:') ||
                   message.content.includes('[用户上传了图片:') ||
                   message.content.includes('--- BEGIN FILE:');
        } else if (Array.isArray(message.content)) {
            // 检查content数组中是否有文件相关内容
            return message.content.some(part => {
                if (part.type === 'text' && part.text) {
                    return part.text.includes('--- Content from file:') || 
                           part.text.includes('[用户上传了文件:') ||
                           part.text.includes('[用户上传了图片:') ||
                           part.text.includes('--- BEGIN FILE:');
                }
                return false;
            });
        }
        return false;
    }

    // 新对话按钮事件处理
    newConversationBtn?.addEventListener('click', () => {
        // 显示当前对话统计
        const totalTokens = getTotalTokens(conversationHistory);
        const messageCount = conversationHistory.length;
        
        // 清空对话历史
        conversationHistory = [];
        
        // 清空聊天区域
        chatArea.innerHTML = '';
        
        // 清空已选文件
        selectedFiles = [];
        renderSelectedFiles();
        
        // 清空输入框
        inputField.value = '';
        
        console.log(`已开始新对话。清空了 ${messageCount} 条消息，约 ${totalTokens} 个token`);
        
        // 在聊天区域显示欢迎信息
        if (messageCount > 0) {
            appendMessage(`🔄 已开始新对话\n\n清空了 ${messageCount} 条历史消息 (约 ${totalTokens.toLocaleString()} tokens)\n\n可以重新上传文件或提问了！`, 'ai');
        }
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
            
            // 将当前用户消息添加到对话历史
            const currentUserMessage = { role: 'user', content: userMessageContentParts };
            conversationHistory.push(currentUserMessage);
            
            // 智能上下文管理：基于token数量而不是轮数
            const MAX_CONTEXT_TOKENS = 120000; // 保留一些余量，不用满128K
            conversationHistory = manageContextLength(conversationHistory, MAX_CONTEXT_TOKENS);
            
            // 发送包含历史记录的完整消息
            await fetchLLMReply(activeModel, conversationHistory, fileAttachmentsForRequestBody, thinkingMessageId);
            
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
                    } else if (errorJson.errorType === 'textTooLongError') {
                        // 文本过长错误的特殊处理，显示更清晰的提示
                        const currentLength = errorJson.currentLength || 0;
                        const maxLength = errorJson.maxLength || 163840;
                        const overageKB = Math.round((currentLength - maxLength) / 1024);
                        
                        let errorMsg = `⚠️ 文本内容过长，无法处理\n\n`;
                        errorMsg += `📊 **当前文本长度**: ${currentLength.toLocaleString()} 字符\n`;
                        errorMsg += `📏 **最大支持长度**: ${maxLength.toLocaleString()} 字符\n`;
                        errorMsg += `📈 **超出长度**: ${(currentLength - maxLength).toLocaleString()} 字符 (约 ${overageKB}KB)\n\n`;
                        errorMsg += `💡 **解决建议**:\n`;
                        errorMsg += `• 减少上传的文件数量\n`;
                        errorMsg += `• 选择较小的文件\n`;
                        errorMsg += `• 将大文件分段处理\n`;
                        errorMsg += `• 删除不必要的文件内容`;
                        
                        appendMessage(errorMsg, 'ai', baseMessageId);
                    } else if (errorJson.errorType === 'llmError') {
                        // 大模型API错误
                        let llmErrorMsg = `🤖 大模型API错误\n\n`;
                        if (errorJson.error && errorJson.error.message) {
                            llmErrorMsg += `**错误信息**: ${errorJson.error.message}\n`;
                        } else if (errorJson.message) {
                            llmErrorMsg += `**错误信息**: ${errorJson.message}\n`;
                        }
                        if (errorJson.error && errorJson.error.code) {
                            llmErrorMsg += `**错误代码**: ${errorJson.error.code}\n`;
                        }
                        appendMessage(llmErrorMsg, 'ai', baseMessageId);
                    } else if (errorJson.errorType === 'configError') {
                        // 配置错误
                        appendMessage(`⚙️ 配置错误: ${errorJson.message || '模型配置有误'}`, 'ai', baseMessageId);
                    } else { // Other backend errors (LLM, config, etc.)
                        appendMessage(`❌ 系统错误: ${errorJson.message || errorJson.error || '未知错误'}`, 'ai', baseMessageId);
                    }
                } catch (e) { // If errorText is not JSON
                    appendMessage(`❌ 服务器错误: ${errorText}`, 'ai', baseMessageId);
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
                            conversationHistory.push({ 
                                role: 'assistant', 
                                content: accumulatedResponse.trim() 
                            });
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
                                    conversationHistory.push({ 
                                        role: 'assistant', 
                                        content: accumulatedResponse.trim() 
                                    });
                                }
                                return;
                            }
                            try {
                                const parsed = JSON.parse(jsonStr);
                                
                                // 检查是否有错误响应
                                if (parsed.error) {
                                    clearInterval(ellipsisInterval);
                                    let errorMsg = `🤖 大模型返回错误\n\n`;
                                    if (parsed.error.message) {
                                        errorMsg += `**错误信息**: ${parsed.error.message}\n`;
                                    }
                                    if (parsed.error.code) {
                                        errorMsg += `**错误代码**: ${parsed.error.code}\n`;
                                    }
                                    if (parsed.error.type) {
                                        errorMsg += `**错误类型**: ${parsed.error.type}\n`;
                                    }
                                    appendMessage(errorMsg, 'ai', baseMessageId);
                                    return;
                                }
                                
                                // 处理特殊的processed_user_message，更新对话历史中的用户消息
                                if (parsed.type === 'processed_user_message') {
                                    // 找到最后一条用户消息并替换为处理后的完整内容
                                    for (let i = conversationHistory.length - 1; i >= 0; i--) {
                                        if (conversationHistory[i].role === 'user') {
                                            conversationHistory[i] = parsed.message;
                                            break;
                                        }
                                    }
                                    console.log('已更新对话历史中的用户消息，包含完整文件内容');
                                    continue; // 跳过这个特殊消息的其他处理
                                }
                                
                                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                    accumulatedResponse += parsed.choices[0].delta.content;
                                    hasNewContent = true; 
                                }
                            } catch (e) {
                                console.warn('Error parsing stream JSON:', jsonStr, e);
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