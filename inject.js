(function() {
    // ============================================================
    // RAW MIC AUDIO ENFORCER v2.2.1
    // Intercepción dinámica de audio WebRTC / Web Audio.
    // ============================================================
    if (window.__rawMicEnforcerInjected) return;
    window.__rawMicEnforcerInjected = true;

    var LOG = '[Raw Mic Enforcer]';
    
    function getTargetBitrate() {
        return currentConfig.targetBitrate || 320000;
    }

    // Configuración por defecto. Asumimos inactivo hasta recibir confirmación
    // para evitar falsos positivos si el usuario lo apagó.
    var currentConfig = {
        isActive: false,
        targetBitrate: 320000,
        protocols: {
            killFilters: true,
            sdpMunge: true,
            compressorKill: true,
            mediaRecorder: true
        }
    };
    var configReceived = false;

    // Escuchar actualizaciones dinámicas desde content.js
    window.addEventListener('message', function(event) {
        if (event && event.data && event.data.type === 'RAW_MIC_CONFIG_UPDATE') {
            if (event.data.config) {
                currentConfig = event.data.config;
                configReceived = true;
                console.log(LOG, 'Estado actualizado:', currentConfig);
            }
        }
    });

    // Solicitar estado a content.js inmediatamente
    window.postMessage({ type: 'RAW_MIC_REQUEST_CONFIG' }, '*');

    // Propiedades de procesamiento de audio a desactivar
    var AUDIO_KILL = [
        'echoCancellation', 'noiseSuppression', 'autoGainControl',
        'googEchoCancellation', 'googAutoGainControl', 'googNoiseSuppression',
        'googHighpassFilter', 'googAudioMirroring', 'googNoiseReduction',
        'googTypingNoiseDetection', 'googBeamforming', 'voiceIsolation'
    ];

    // ============================================================
    // 1. HELPER: Desactivar todos los filtros en constraints de audio
    // ============================================================
    function killFilters(constraints) {
        if (!currentConfig.isActive || !currentConfig.protocols.killFilters) return;
        if (!constraints || !constraints.audio) return;

        if (constraints.audio === true) {
            constraints.audio = {};
        }

        if (typeof constraints.audio === 'object') {
            AUDIO_KILL.forEach(function(p) { constraints.audio[p] = false; });
            constraints.audio.channelCount = 2;

            if (Array.isArray(constraints.audio.advanced)) {
                constraints.audio.advanced.forEach(function(adv) {
                    AUDIO_KILL.forEach(function(p) {
                        if (adv[p] !== undefined) adv[p] = false;
                    });
                });
            }
        }
    }

    // ============================================================
    // 2. HELPER: SDP Munging — Forzar Opus a máxima calidad
    // ============================================================
    function mungeSDP(sdp) {
        if (!currentConfig.isActive || !currentConfig.protocols.sdpMunge) return sdp;
        if (!sdp) return sdp;

        var m = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
        if (!m) return sdp;

        var pt = m[1];
        var br = getTargetBitrate();
        var hq = 'minptime=10; maxaveragebitrate=' + br +
                 '; stereo=1; sprop-stereo=1; usedtx=0; useinbandfec=1' +
                 '; maxplaybackrate=48000; cbr=1';

        var fmtpRe = new RegExp('a=fmtp:' + pt + '\\s[^\\r\\n]*');

        if (fmtpRe.test(sdp)) {
            sdp = sdp.replace(fmtpRe, 'a=fmtp:' + pt + ' ' + hq);
        } else {
            var mapRe = new RegExp('(a=rtpmap:' + pt + '[^\\r\\n]*\\r\\n)');
            sdp = sdp.replace(mapRe, '$1a=fmtp:' + pt + ' ' + hq + '\r\n');
        }

        sdp = sdp.replace(/b=AS:\d+\r\n/g, '');
        sdp = sdp.replace(/b=TIAS:\d+\r\n/g, '');
        sdp = sdp.replace(/b=CT:\d+\r\n/g, '');

        return sdp;
    }

    // Para evitar problemas de inicialización, interceptamos funciones con asincronía.
    
    // ============================================================
    // 3. getUserMedia — API moderna
    // ============================================================
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        var _gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(c) {
            // Permitimos un breve retardo si la configuración no llegó (solo primera llamada)
            if (!configReceived) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        if (currentConfig.isActive && currentConfig.protocols.killFilters) {
                            killFilters(c);
                            console.log(LOG, 'getUserMedia interceptado (retrasado).', c);
                        }
                        _gum(c).then(resolve).catch(reject);
                    }, 25);
                });
            }
            if (currentConfig.isActive && currentConfig.protocols.killFilters) {
                killFilters(c);
                console.log(LOG, 'getUserMedia interceptado.', c);
            }
            return _gum(c);
        };
    }

    // ============================================================
    // 4. getUserMedia — API legacy
    // ============================================================
    ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia'].forEach(function(fn) {
        if (navigator[fn]) {
            var _orig = navigator[fn].bind(navigator);
            navigator[fn] = function(c, ok, err) {
                if (currentConfig.isActive && currentConfig.protocols.killFilters) {
                    killFilters(c);
                    console.log(LOG, fn + ' legacy interceptado.');
                }
                return _orig(c, ok, err);
            };
        }
    });

    // ============================================================
    // 5. RTCPeerConnection — SDP Munging
    // ============================================================
    if (window.RTCPeerConnection) {
        var proto = RTCPeerConnection.prototype;

        var _sld = proto.setLocalDescription;
        proto.setLocalDescription = function(desc) {
            if (currentConfig.isActive && currentConfig.protocols.sdpMunge && desc && desc.sdp) {
                desc = { type: desc.type, sdp: mungeSDP(desc.sdp) };
                console.log(LOG, 'SDP local modificado → Opus ' + (getTargetBitrate()/1000) + 'kbps stereo CBR.');
            }
            return _sld.apply(this, [desc]);
        };

        var _srd = proto.setRemoteDescription;
        proto.setRemoteDescription = function(desc) {
            if (currentConfig.isActive && currentConfig.protocols.sdpMunge && desc && desc.sdp) {
                desc = { type: desc.type, sdp: mungeSDP(desc.sdp) };
                console.log(LOG, 'SDP remoto modificado.');
            }
            return _srd.apply(this, [desc]);
        };

        var _co = proto.createOffer;
        proto.createOffer = function() {
            return _co.apply(this, arguments).then(function(offer) {
                if (currentConfig.isActive && currentConfig.protocols.sdpMunge && offer && offer.sdp) {
                    offer.sdp = mungeSDP(offer.sdp);
                    console.log(LOG, 'Offer SDP modificado.');
                }
                return offer;
            });
        };

        var _ca = proto.createAnswer;
        proto.createAnswer = function() {
            return _ca.apply(this, arguments).then(function(answer) {
                if (currentConfig.isActive && currentConfig.protocols.sdpMunge && answer && answer.sdp) {
                    answer.sdp = mungeSDP(answer.sdp);
                    console.log(LOG, 'Answer SDP modificado.');
                }
                return answer;
            });
        };
    }

    // ============================================================
    // 6. RTCRtpSender.setParameters()
    // ============================================================
    if (window.RTCRtpSender && RTCRtpSender.prototype.setParameters) {
        var _sp = RTCRtpSender.prototype.setParameters;
        RTCRtpSender.prototype.setParameters = function(params) {
            if (currentConfig.isActive && currentConfig.protocols.sdpMunge && params && params.encodings) {
                var br = getTargetBitrate();
                params.encodings.forEach(function(enc) {
                    if (enc.maxBitrate !== undefined && enc.maxBitrate < br) {
                        console.log(LOG, 'Bitrate ' + enc.maxBitrate + ' → ' + br);
                        enc.maxBitrate = br;
                    }
                });
            }
            return _sp.apply(this, arguments);
        };
    }

    // ============================================================
    // 7. MediaStreamTrack.applyConstraints()
    // ============================================================
    if (window.MediaStreamTrack && MediaStreamTrack.prototype.applyConstraints) {
        var _ac = MediaStreamTrack.prototype.applyConstraints;
        MediaStreamTrack.prototype.applyConstraints = function(c) {
            if (currentConfig.isActive && currentConfig.protocols.killFilters && this.kind === 'audio' && c) {
                AUDIO_KILL.forEach(function(p) {
                    if (c[p] !== undefined) c[p] = false;
                });
                if (Array.isArray(c.advanced)) {
                    c.advanced.forEach(function(adv) {
                        AUDIO_KILL.forEach(function(p) {
                            if (adv[p] !== undefined) adv[p] = false;
                        });
                    });
                }
                c.channelCount = 2;
                console.log(LOG, 'applyConstraints interceptado — filtros bloqueados y estéreo mantenido.');
            }
            return _ac.apply(this, arguments);
        };
    }

    // ============================================================
    // 8. MediaRecorder
    // ============================================================
    if (window.MediaRecorder) {
        var _MR = window.MediaRecorder;
        window.MediaRecorder = function(stream, opts) {
            opts = opts || {};
            if (currentConfig.isActive && currentConfig.protocols.mediaRecorder) {
                opts.audioBitsPerSecond = getTargetBitrate();
                console.log(LOG, 'MediaRecorder → ' + (getTargetBitrate()/1000) + 'kbps.');
            }
            return new _MR(stream, opts);
        };
        window.MediaRecorder.isTypeSupported = _MR.isTypeSupported;
        window.MediaRecorder.prototype = _MR.prototype;
    }

    // ============================================================
    // 9. AudioContext — Compresores dinámicos
    // ============================================================
    function patchCtx(Ctx) {
        if (!Ctx || !Ctx.prototype || !Ctx.prototype.createDynamicsCompressor) return;
        var _cc = Ctx.prototype.createDynamicsCompressor;
        Ctx.prototype.createDynamicsCompressor = function() {
            var node = _cc.apply(this, arguments);
            if (currentConfig.isActive && currentConfig.protocols.compressorKill) {
                try {
                    node.threshold.value = 0;
                    node.knee.value = 0;
                    node.ratio.value = 1;   // 1:1 = passthrough
                    node.attack.value = 0;
                    node.release.value = 0.25;
                    console.log(LOG, 'DynamicsCompressor neutralizado.');
                } catch(e) {}
            }
            return node;
        };
    }
    patchCtx(window.AudioContext);
    patchCtx(window.webkitAudioContext);

    console.log(
        '%c' + LOG + ' v2.2.1 — Protección de Audio Inicializada (MAIN world)',
        'color: #00ff88; font-weight: bold; font-size: 13px;'
    );
})();
