const { Plugins, Actions, log, EventEmitter } = require('./utils/plugin');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const plugin = new Plugins('dev.androne.plugin.streamdock.ytmusic');

let wss = null;
let chromeWs = null;
let currentTrack = {};
let globalSettings = {};

let lastArtwork = {};

const ERROR_ICON_PATH = 'static/error-icon.png';
const PLAY_ICON_PATH = 'static/play-icon.png';
const PAUSE_ICON_PATH = 'static/pause-icon.png';
const DEFAULT_ICON_PATH = 'static/ytmusic-icon.png';
const NEXT_ICON_PATH = 'static/next-icon.png';
const PREVIOUS_ICON_PATH = 'static/previous-icon.png';

const tempImageDir = path.join(__dirname, 'temp_images');

const openYouTubeMusic = () => {
    const url = 'https://music.youtube.com';
    const command = process.platform === 'darwin' ? `open "${url}"` : 
                   process.platform === 'win32' ? `start "${url}"` : 
                   `xdg-open "${url}"`;
    
    exec(command, (error) => {
        if (error) {
            log.error(`Error opening YouTube Music: ${error.message}`);
        } else {
            log.info('YouTube Music opened successfully');
        }
    });
};

const cleanupOldArtwork = () => {
    if (!fs.existsSync(tempImageDir)) return;

    fs.readdir(tempImageDir, (err, files) => {
        if (err) {
            log.error(`Error reading temp image directory: ${err.message}`);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(tempImageDir, file);
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) return;


                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                if (stats.mtime.getTime() < oneHourAgo) {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                            log.error(`Error cleaning up old artwork file: ${filePath}`);
                        }
                    });
                }
            });
        });
    });
};

const startWebSocketServer = () => {
    if (wss) {
        wss.close();
    }

    const port = globalSettings.websocketPort || 9489;
    wss = new WebSocket.Server({ port: port });

    wss.on('listening', () => {

    });

    wss.on('connection', (ws) => {
        chromeWs = ws;

        chromeWs.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.event === 'track') {
                    currentTrack = data.payload;
                    updateAllButtons();
                } else {
                    log.warn('Received unknown event type from Chrome Extension:', data.event);
                }
            } catch (e) {
                log.error('Error parsing WebSocket message from Chrome Extension:', e.message);
            }
        });

        chromeWs.on('close', () => {
            chromeWs = null;
            updateAllButtons();
        });

        chromeWs.on('error', (err) => {
            log.error('WebSocket error with Chrome Extension:', err.message);
        });
    });

    wss.on('error', (err) => {
        log.error('WebSocket server encountered an error:', err.message);
        setTimeout(startWebSocketServer, 5000);
    });
};

plugin.didReceiveGlobalSettings = ({ payload: { settings } }) => {
    globalSettings = settings;
    startWebSocketServer();
};

plugin.onDidConnect = () => {
    plugin.getGlobalSettings();
    cleanupOldArtwork();
};

const updateButton = (context) => {
    const actionUUID = Actions.actions[context];

    if (!chromeWs || chromeWs.readyState !== WebSocket.OPEN) {
        if (actionUUID === 'dev.androne.plugin.streamdock.ytmusic.artwork') {
            plugin.setImage(context, DEFAULT_ICON_PATH);
        } else if (actionUUID === 'dev.androne.plugin.streamdock.ytmusic.next') {
            plugin.setImage(context, NEXT_ICON_PATH);
        } else if (actionUUID === 'dev.androne.plugin.streamdock.ytmusic.previous') {
            plugin.setImage(context, PREVIOUS_ICON_PATH);
        }
        lastArtwork[context] = null;
        return;
    }

    if (currentTrack.title) {
        const { title, artist, artwork, playing } = currentTrack;

        if (actionUUID === 'dev.androne.plugin.streamdock.ytmusic.artwork') {
            plugin.setTitle(context, '');
            if (artwork) {
                if (artwork !== lastArtwork[context]) {
                    try {
                        plugin.setImage(context, artwork);
                        lastArtwork[context] = artwork;
                    } catch (err) {
                        log.error(`Failed to set artwork for context ${context}: ${err.message}`);
                        plugin.setImage(context, DEFAULT_ICON_PATH);
                    }
                }
            } else {
                plugin.setImage(context, DEFAULT_ICON_PATH);
                lastArtwork[context] = null;
            }
        } else if (actionUUID === 'dev.androne.plugin.streamdock.ytmusic.next') {

            plugin.setImage(context, NEXT_ICON_PATH);
        } else if (actionUUID === 'dev.androne.plugin.streamdock.ytmusic.previous') {

            plugin.setImage(context, PREVIOUS_ICON_PATH);
        }
    } else {
        log.warn(`No track information available for context ${context}.`);
        plugin.setTitle(context, 'No Track');
        plugin.setImage(context, DEFAULT_ICON_PATH);
        lastArtwork[context] = null;
    }
};

const updateAllButtons = () => {
    const activeContexts = Object.keys(Actions.actions);
    if (activeContexts.length === 0) {
        log.warn('No active StreamDock button contexts found.');
        return;
    }
    activeContexts.forEach(updateButton);
};

plugin.artwork = new Actions({
    _willAppear({ context }) {
        updateButton(context);
    },
    keyUp({ context }) {
        if (!chromeWs || chromeWs.readyState !== WebSocket.OPEN) {
            // Pas de connexion Chrome - ouvrir YouTube Music
            openYouTubeMusic();
            return;
        }
        
        if (currentTrack.title) {
            // Musique en cours - toggle play/pause
            const command = currentTrack.playing ? 'pause' : 'play';
            chromeWs.send(JSON.stringify({ cmd: command }));
        } else {
            // Pas de musique - ouvrir YouTube Music
            openYouTubeMusic();
        }
    },
    _willDisappear({ context }) {
        delete lastArtwork[context];
    }
});

plugin.next = new Actions({
    _willAppear({ context }) {
        updateButton(context);
    },
    keyUp({ context }) {
        if (!chromeWs || chromeWs.readyState !== WebSocket.OPEN) {
            log.warn('Cannot send command: Chrome Extension WebSocket not connected.');
            return;
        }
        chromeWs.send(JSON.stringify({ cmd: 'next' }));
    },
    _willDisappear({ context }) {
        delete lastArtwork[context];
    }
});

plugin.previous = new Actions({
    _willAppear({ context }) {
        updateButton(context);
    },
    keyUp({ context }) {
        if (!chromeWs || chromeWs.readyState !== WebSocket.OPEN) {
            log.warn('Cannot send command: Chrome Extension WebSocket not connected.');
            return;
        }
        chromeWs.send(JSON.stringify({ cmd: 'previous' }));
    },
    _willDisappear({ context }) {
        delete lastArtwork[context];
    }
});

startWebSocketServer();