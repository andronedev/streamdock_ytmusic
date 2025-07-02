let port;

function connectToServiceWorker() {
    port = chrome.runtime.connect({ name: 'ytmusic-content-script' });

    port.onDisconnect.addListener(() => {
        setTimeout(connectToServiceWorker, 3000);
    });
}

function getPositionState() {
    const video = document.querySelector('video');
    return video ? video.currentTime : 0;
}

function extractMetadata() {
    const mediaSession = navigator.mediaSession;
    if (!mediaSession || !mediaSession.metadata) {
        return null;
    }

    const metadata = mediaSession.metadata;
    const artworkSrc = metadata.artwork.length > 0 ? metadata.artwork[metadata.artwork.length - 1].src : null;

    return {
        event: "track",
        payload: {
            title: metadata.title || "Unknown Title",
            artist: metadata.artist || "Unknown Artist",
            album: metadata.album || "",
            artwork: artworkSrc,
            duration: document.querySelector('video')?.duration || 0,
            position: getPositionState(),
            playing: mediaSession.playbackState === "playing"
        }
    };
}

async function sendState() {
    const state = extractMetadata();
    if (state && port) {
        if (state.payload.artwork) {
            try {
                const response = await fetch(state.payload.artwork);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    state.payload.artwork = reader.result;
                    port.postMessage(state);
                };
                reader.readAsDataURL(blob);
            } catch (e) {
                state.payload.artwork = null;
                port.postMessage(state);
            }
        } else {
            port.postMessage(state);
        }
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const player = document.querySelector('ytmusic-player-bar');
    if (!player) {
        return;
    }

    const getButton = (selector) => {
        return player.querySelector(selector);
    };

    switch (message.cmd) {
        case 'play':
        case 'pause':
        case 'toggle':
            getButton('.play-pause-button')?.click();
            break;
        case 'next':
            getButton('.next-button')?.click();
            break;
        case 'previous':
            getButton('.previous-button')?.click();
            break;
        case 'volume':
            if (message.val !== undefined) {
                const volumeSlider = player.querySelector('#volume-slider');
                if(volumeSlider) {
                    volumeSlider.value = message.val;
                    volumeSlider.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            break;
    }
    setTimeout(sendState, 150);
    sendResponse({ status: "done" });
});

connectToServiceWorker();

setInterval(sendState, 1000);
navigator.mediaSession.addEventListener('metadata', sendState);
navigator.mediaSession.addEventListener('playbackstatechange', sendState);