const WEBSOCKET_URL = "ws://127.0.0.1:9489/ytmusic";
let socket;

function connectWebSocket() {
    socket = new WebSocket(WEBSOCKET_URL);

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            chrome.tabs.query({ url: "https://music.youtube.com/*" }, (tabs) => {
                if (tabs.length > 0) {
                    const targetTab = tabs.find(t => t.audible) || tabs[0];
                    chrome.tabs.sendMessage(targetTab.id, message);
                }
            });
        } catch (e) {
            // Ignore JSON parse errors
        }
    };

    socket.onclose = () => {
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = () => {
        socket.close();
    };
}

chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'ytmusic-content-script') {
        port.onMessage.addListener((message) => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                try {
                    socket.send(JSON.stringify(message));
                } catch (e) {
                    // Ignore send errors
                }
            }
        });
    }
});

connectWebSocket();
