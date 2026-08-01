const DEFAULT_CONFIG = {
    enabled: true,
    blacklist: [],
    targetBitrate: 320000,
    protocols: {
        killEcho: true,
        killNoise: true,
        killGain: true,
        sdpMunge: true,
        compressorKill: true,
        mediaRecorder: true,
        audioWorklet: true,
        displayMedia: true,
        encodedTransform: true,
        workletFetch: false
    }
};

let currentHostname = '';
let currentUrl = '';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener la pestaña activa
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                currentHostname = url.hostname;
                currentUrl = tabs[0].url;
            } catch(e) {
                currentHostname = '';
                currentUrl = '';
            }
        }
        updateSiteUI();
    });

    // 2. Cargar estado desde Storage
    loadState();

    // 3. Event Listeners
    document.getElementById('masterToggle').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        chrome.storage.local.set({ enabled: enabled }, () => {
            updateMasterUI(enabled);
        });
    });

    document.getElementById('btnSiteToggle').addEventListener('click', () => {
        if (!currentHostname) return;
        chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
            let blacklist = items.blacklist || [];
            const index = blacklist.indexOf(currentHostname);
            if (index >= 0) {
                blacklist.splice(index, 1);
            } else {
                blacklist.push(currentHostname);
            }
            chrome.storage.local.set({ blacklist: blacklist }, () => {
                updateSiteUI(blacklist);
            });
        });
    });

    // Acordeón
    const accordion = document.getElementById('expertAccordion');
    document.getElementById('accordionHeader').addEventListener('click', () => {
        accordion.classList.toggle('open');
    });

    // Protocolos individuales
    const protoKeys = ['killEcho', 'killNoise', 'killGain', 'sdpMunge', 'compressorKill', 'mediaRecorder', 'audioWorklet', 'displayMedia', 'encodedTransform', 'workletFetch'];
    protoKeys.forEach(key => {
        const id = 'proto' + key.charAt(0).toUpperCase() + key.slice(1);
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', () => {
                saveProtocols();
            });
        }
    });

    // Abrir Opciones
    document.getElementById('btnOpenOptions').addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });
});

function loadState() {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
        const enabled = items.enabled !== undefined ? items.enabled : true;
        const blacklist = items.blacklist || [];
        const protocols = items.protocols || DEFAULT_CONFIG.protocols;

        document.getElementById('masterToggle').checked = enabled;
        updateMasterUI(enabled);
        updateSiteUI(blacklist);

        document.getElementById('protoKillEcho').checked = protocols.killEcho !== false;
        document.getElementById('protoKillNoise').checked = protocols.killNoise !== false;
        document.getElementById('protoKillGain').checked = protocols.killGain !== false;
        document.getElementById('protoSdpMunge').checked = !!protocols.sdpMunge;
        document.getElementById('protoCompressorKill').checked = !!protocols.compressorKill;
        document.getElementById('protoMediaRecorder').checked = !!protocols.mediaRecorder;
        document.getElementById('protoAudioWorklet').checked = protocols.audioWorklet !== false;
        document.getElementById('protoDisplayMedia').checked = protocols.displayMedia !== false;
        document.getElementById('protoEncodedTransform').checked = protocols.encodedTransform !== false;
        document.getElementById('protoWorkletFetch').checked = !!protocols.workletFetch;
    });
}

function updateMasterUI(enabled) {
    const card = document.getElementById('masterCard');
    const statusText = document.getElementById('statusText');
    if (enabled) {
        card.classList.add('active');
        statusText.textContent = 'Modo RAW Activo';
    } else {
        card.classList.remove('active');
        statusText.textContent = 'Desactivado (Nativo)';
    }
}

function updateSiteUI(blacklistArray) {
    const domainEl = document.getElementById('siteDomain');
    const btn = document.getElementById('btnSiteToggle');
    
    // Página del sistema: cualquier protocolo que no sea http o https
    // (cubre chrome://, brave://, edge://, vivaldi://, opera://, file://, about:, etc.)
    if (!currentHostname || !currentUrl.startsWith('http')) {
        domainEl.textContent = 'Página del sistema';
        btn.style.display = 'none';
        return;
    }

    btn.style.display = 'block';
    domainEl.textContent = currentHostname;

    const checkList = blacklistArray || [];
    const isExcluded = checkList.includes(currentHostname);

    if (isExcluded) {
        btn.textContent = 'Re-activar sitio';
        btn.classList.add('excluded');
    } else {
        btn.textContent = 'Excluir sitio';
        btn.classList.remove('excluded');
    }
}

function saveProtocols() {
    const protocols = {
        killEcho: document.getElementById('protoKillEcho').checked,
        killNoise: document.getElementById('protoKillNoise').checked,
        killGain: document.getElementById('protoKillGain').checked,
        sdpMunge: document.getElementById('protoSdpMunge').checked,
        compressorKill: document.getElementById('protoCompressorKill').checked,
        mediaRecorder: document.getElementById('protoMediaRecorder').checked,
        audioWorklet: document.getElementById('protoAudioWorklet').checked,
        displayMedia: document.getElementById('protoDisplayMedia').checked,
        encodedTransform: document.getElementById('protoEncodedTransform').checked,
        workletFetch: document.getElementById('protoWorkletFetch').checked
    };
    chrome.storage.local.set({ protocols: protocols });
}
