const $PI = {
    onConnected: (fn) => {
        window.addEventListener('connected', (evt) => {
            fn();
        });
    },
    onDidReceiveGlobalSettings: (fn) => {
        window.addEventListener('didReceiveGlobalSettings', (evt) => {
            fn(evt.detail);
        });
    },
    setGlobalSettings: (settings) => {
        window.dispatchEvent(new CustomEvent('didReceiveGlobalSettings', { detail: { payload: { settings } } }));
    },
    getGlobalSettings: () => {
        window.dispatchEvent(new CustomEvent('didReceiveGlobalSettings', { detail: { payload: { settings: {} } } }));
    }
};