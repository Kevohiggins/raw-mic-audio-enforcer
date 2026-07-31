// content.js - Isolated World Content Script
const DEFAULT_CONFIG = {
    enabled: true,
    blacklist: [],
    targetBitrate: 320000,
    protocols: {
        killFilters: true,
        sdpMunge: true,
        compressorKill: true,
        mediaRecorder: true,
        audioWorklet: true,
        displayMedia: true,
        encodedTransform: true,
        workletFetch: false
    }
};

function getHostName() {
    try {
        return window.location.hostname;
    } catch(e) {
        return '';
    }
}

function checkIsActive(config) {
    if (!config.enabled) return false;
    const hostname = getHostName();
    if (!hostname) return true;
    return !config.blacklist.some(domain => {
        const clean = domain.trim().toLowerCase();
        return clean && (hostname === clean || hostname.endsWith('.' + clean));
    });
}

function sendConfigToMainWorld() {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
        const config = {
            enabled: items.enabled !== undefined ? items.enabled : true,
            blacklist: items.blacklist || [],
            targetBitrate: items.targetBitrate || 320000,
            protocols: Object.assign({}, DEFAULT_CONFIG.protocols, items.protocols || {})
        };

        const isActive = checkIsActive(config);

        window.postMessage({
            type: 'RAW_MIC_CONFIG_UPDATE',
            config: {
                isActive: isActive,
                targetBitrate: config.targetBitrate,
                protocols: config.protocols
            }
        }, '*');
    });
}

// Enviar estado inicial nada más iniciar
sendConfigToMainWorld();

// Enviar estado cada vez que se modifique en las opciones o popup
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        sendConfigToMainWorld();
    }
});

// Escuchar peticiones desde el MAIN world por si se cargó primero y pide el estado
window.addEventListener('message', (event) => {
    if (event && event.data && event.data.type === 'RAW_MIC_REQUEST_CONFIG') {
        sendConfigToMainWorld();
    }
});
