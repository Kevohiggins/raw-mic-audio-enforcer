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

document.addEventListener('DOMContentLoaded', () => {
    loadOptions();

    // Switch Maestro
    document.getElementById('masterToggle').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        chrome.storage.local.set({ enabled: enabled }, () => {
            updateMasterUI(enabled);
        });
    });

    // Agregar Dominio
    document.getElementById('btnAddDomain').addEventListener('click', addDomain);
    document.getElementById('inputDomain').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDomain();
    });

    // Switchees de Protocolos
    const protoKeys = ['killEcho', 'killNoise', 'killGain', 'sdpMunge', 'compressorKill', 'mediaRecorder', 'audioWorklet', 'displayMedia', 'encodedTransform', 'workletFetch'];
    protoKeys.forEach(key => {
        const id = 'proto' + key.charAt(0).toUpperCase() + key.slice(1);
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', saveProtocols);
        }
    });

    // Selector de Bitrate
    const bitrateSelect = document.getElementById('bitrateSelect');
    if (bitrateSelect) {
        bitrateSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                chrome.storage.local.set({ targetBitrate: val });
            }
        });
    }
});

function loadOptions() {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
        const enabled = items.enabled !== undefined ? items.enabled : true;
        const blacklist = items.blacklist || [];
        const targetBitrate = items.targetBitrate || 320000;
        const protocols = items.protocols || DEFAULT_CONFIG.protocols;

        document.getElementById('masterToggle').checked = enabled;
        updateMasterUI(enabled);
        renderBlacklist(blacklist);
        
        const bitrateSelect = document.getElementById('bitrateSelect');
        if (bitrateSelect) {
            bitrateSelect.value = targetBitrate.toString();
        }

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

function renderBlacklist(blacklist) {
    const listEl = document.getElementById('domainList');
    listEl.innerHTML = '';

    if (blacklist.length === 0) {
        listEl.innerHTML = '<li style="font-size: 12px; color: var(--text-muted); padding: 8px;">No hay sitios excluidos. La extensión se aplicará en todas las webs.</li>';
        return;
    }

    blacklist.forEach(domain => {
        const li = document.createElement('li');
        li.className = 'domain-item';
        
        const span = document.createElement('span');
        span.textContent = domain;

        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-remove';
        btnRemove.textContent = 'Eliminar';
        btnRemove.title = 'Eliminar de lista negra';
        btnRemove.addEventListener('click', () => removeDomain(domain));

        li.appendChild(span);
        li.appendChild(btnRemove);
        listEl.appendChild(li);
    });
}

function addDomain() {
    const input = document.getElementById('inputDomain');
    let domain = input.value.trim().toLowerCase();
    
    // Limpiar protocolo si lo pegaron completo (https://meet.google.com -> meet.google.com)
    try {
        if (domain.includes('://')) {
            domain = new URL(domain).hostname;
        }
    } catch(e) {}

    if (!domain) return;

    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
        let blacklist = items.blacklist || [];
        if (!blacklist.includes(domain)) {
            blacklist.push(domain);
            chrome.storage.local.set({ blacklist: blacklist }, () => {
                renderBlacklist(blacklist);
                input.value = '';
            });
        }
    });
}

function removeDomain(domain) {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
        let blacklist = items.blacklist || [];
        blacklist = blacklist.filter(d => d !== domain);
        chrome.storage.local.set({ blacklist: blacklist }, () => {
            renderBlacklist(blacklist);
        });
    });
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
