// JavaScript for chat functionality will go here.
// For example, handling input, sending messages to a backend, and displaying responses.

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.querySelector('.input-area input[type="text"]');
    const sendButton = document.querySelector('.input-area .send-button');
    const micButton = document.querySelector('.input-area .mic-button');
    const chatArea = document.querySelector('.chat-area');

    sendButton.addEventListener('click', async () => {
        const messageText = inputField.value.trim();
        if (!messageText) return;
        appendMessage(messageText, 'user');
        inputField.value = '';
        // 获取当前激活模型
        const model = await getActiveModel();
        if (!model) {
            appendMessage('未配置可用的大模型，请联系管理员。', 'ai');
            return;
        }
        appendMessage('AI 正在思考...', 'ai-thinking');
        try {
            const aiReply = await fetchLLMReply(model, messageText);
            removeThinking();
            appendMessage(aiReply, 'ai');
        } catch (err) {
            removeThinking();
            appendMessage('请求大模型失败: ' + err.message, 'ai');
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
    function appendMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        const textNode = document.createElement('p');
        textNode.textContent = text;
        messageElement.appendChild(textNode);

        chatArea.appendChild(messageElement);
        chatArea.scrollTop = chatArea.scrollHeight; // Scroll to the bottom

        // Add specific class for 'AI is thinking...' for easy removal
        if (sender === 'ai-thinking') {
            messageElement.classList.add('ai-thinking');
        }
    }

    function removeThinking() {
        const thinking = chatArea.querySelector('.ai-thinking');
        if (thinking) thinking.remove();
    }

    async function getActiveModel() {
        const res = await fetch('/api/models/active');
        if (!res.ok) return null;
        return await res.json();
    }

    async function fetchLLMReply(model, userInput) {
        // 根据模型类型适配不同API
        if (model.type === 'openrouter') {
            return await callOpenRouter(model, userInput);
        } else if (model.type === 'ollama') {
            return await callOllama(model, userInput);
        } else if (model.type === 'telcom') {
            return await callTelcom(model, userInput);
        } else {
            throw new Error('暂不支持的模型类型: ' + model.type);
        }
    }

    // OpenRouter API
    function cleanupExcessiveWhitespace(text) {
        const cleanedText = text.replace(/\n{3,}/g, '\n\n');
        return cleanedText.replace(/^\s+/, '');
    }

    async function callOpenRouter(model, userInput) {
        try {
            // 构建多轮消息（可扩展为历史消息）
            const messages = [
                { role: 'user', content: userInput }
            ];
            // 构建请求体
            const requestBody = {
                model: model.modelName,
                messages: messages,
                temperature: 0.7,
                max_tokens: 4000,
            };
            // 发送请求到本地代理
            const response = await fetch('/api/relay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API响应错误:', response.status, response.statusText);
                console.error('错误详情:', errorText);
                throw new Error(`API请求失败: ${response.status} - ${errorText.substring(0, 200)}...`);
            }
            const responseText = await response.text();
            if (!responseText.trim()) {
                throw new Error('API响应为空');
            }
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON解析错误:', parseError);
                throw new Error('无法解析API响应: ' + parseError.message);
            }
            if (!data.choices || !data.choices.length || !data.choices[0].message) {
                throw new Error('API响应格式不正确');
            }
            let content = data.choices[0].message.content.trim();
            content = cleanupExcessiveWhitespace(content);
            return content;
        } catch (error) {
            console.error('API调用错误:', error);
            throw error;
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