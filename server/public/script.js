// JavaScript for chat functionality will go here.
// For example, handling input, sending messages to a backend, and displaying responses.

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.querySelector('.input-area input[type="text"]');
    const sendButton = document.querySelector('.input-area .send-button');
    const micButton = document.querySelector('.input-area .mic-button');
    const chatArea = document.querySelector('.chat-area');

    // Example: Log input value when send button is clicked
    if (sendButton && inputField) {
        sendButton.addEventListener('click', () => {
            const messageText = inputField.value.trim();
            if (messageText) {
                console.log('Sending message:', messageText);
                // Here you would typically send the message to a backend
                // and then display the user's message and AI's response in chatArea
                appendMessage(messageText, 'user');
                inputField.value = ''; // Clear input field
                // Simulate AI response for now
                setTimeout(() => {
                    appendMessage('AI is thinking...', 'ai-thinking');
                    setTimeout(() => {
                         // Remove 'AI is thinking...' message
                        const thinkingMessage = chatArea.querySelector('.ai-thinking');
                        if (thinkingMessage) {
                            thinkingMessage.remove();
                        }
                        appendMessage('This is a simulated AI response.', 'ai');
                    }, 2000);
                }, 500);
            }
        });
    }

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
}); 