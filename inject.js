(function() {
    // ============================================================
    // RAW MIC AUDIO ENFORCER v2.5.0
    // Intercepción dinámica de audio WebRTC / Web Audio.
    // ============================================================
    if (window.__rawMicEnforcerInjected) return;
    window.__rawMicEnforcerInjected = true;

    var LOG = '[Raw Mic Enforcer]';

    function getTargetBitrate() {
        return currentConfig.targetBitrate || 320000;
    }

    // Configuración por defecto: ACTIVO por defecto para evitar la ventana ciega
    // durante el tiempo que tarda content.js en enviar la config real.
    // Si el usuario lo apagó, content.js lo corregirá en <50ms.
    var currentConfig = {
        isActive: true,
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
            encodedTransform: true
        }
    };

    // Escuchar actualizaciones dinámicas desde content.js
    window.addEventListener('message', function(event) {
        if (event && event.data && event.data.type === 'RAW_MIC_CONFIG_UPDATE') {
            if (event.data.config) {
                currentConfig = event.data.config;
                console.log(LOG, 'Estado actualizado:', currentConfig);
            }
        }
    });

    // Solicitar estado a content.js inmediatamente
    window.postMessage({ type: 'RAW_MIC_REQUEST_CONFIG' }, '*');

    // Grupos de filtros separados por categoría
    var ECHO_FILTERS = ['echoCancellation', 'googEchoCancellation'];
    var NOISE_FILTERS = ['noiseSuppression', 'googNoiseSuppression',
        'googHighpassFilter', 'googNoiseReduction',
        'googTypingNoiseDetection', 'googBeamforming', 'voiceIsolation'];
    var GAIN_FILTERS = ['autoGainControl', 'googAutoGainControl', 'googAudioMirroring'];

    // ============================================================
    // 1. HELPER: Desactivar filtros según la configuración individual
    // ============================================================
    function killFilters(constraints) {
        if (!currentConfig.isActive) return;
        var p = currentConfig.protocols;
        if (!p.killEcho && !p.killNoise && !p.killGain) return;
        if (!constraints || !constraints.audio) return;

        if (constraints.audio === true) {
            constraints.audio = {};
        }

        if (typeof constraints.audio === 'object') {
            var filtersToKill = [];
            if (p.killEcho) filtersToKill = filtersToKill.concat(ECHO_FILTERS);
            if (p.killNoise) filtersToKill = filtersToKill.concat(NOISE_FILTERS);
            if (p.killGain) filtersToKill = filtersToKill.concat(GAIN_FILTERS);

            filtersToKill.forEach(function(f) { constraints.audio[f] = false; });
            constraints.audio.channelCount = 2;

            if (Array.isArray(constraints.audio.advanced)) {
                constraints.audio.advanced.forEach(function(adv) {
                    filtersToKill.forEach(function(f) {
                        if (adv[f] !== undefined) adv[f] = false;
                    });
                });
            }

            var killed = [];
            if (p.killEcho) killed.push('eco');
            if (p.killNoise) killed.push('ruido');
            if (p.killGain) killed.push('ganancia');
            console.log(LOG, 'Filtros bloqueados: ' + killed.join(', '));
        }
    }

    // ============================================================
    // 2. HELPER: SDP Munging — Forzar Opus a máxima calidad
    //    Regex robusta: soporta "opus/48000" y "opus/48000/2"
    // ============================================================
    function mungeSDP(sdp) {
        if (!currentConfig.isActive || !currentConfig.protocols.sdpMunge) return sdp;
        if (!sdp) return sdp;

        // Busca el payload type de Opus, con o sin canal explícito (/2)
        var m = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000(?:\/\d+)?/i);
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

        // Eliminar límites de banda que Chrome/Firefox puedan imponer en el SDP
        sdp = sdp.replace(/b=AS:\d+\r\n/g, '');
        sdp = sdp.replace(/b=TIAS:\d+\r\n/g, '');
        sdp = sdp.replace(/b=CT:\d+\r\n/g, '');

        return sdp;
    }

    // ============================================================
    // 3. getUserMedia — API moderna
    // ============================================================
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        var _gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(c) {
            killFilters(c);
            if (currentConfig.isActive) {
                console.log(LOG, 'getUserMedia interceptado.', c);
            }
            return _gum(c);
        };
    }

    // ============================================================
    // 4. getDisplayMedia — Captura de pantalla con audio del sistema
    // ============================================================
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        var _gdm = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = function(c) {
            if (currentConfig.isActive && currentConfig.protocols.displayMedia) {
                c = c || {};
                if (c.audio === true) c.audio = {};
                if (typeof c.audio === 'object') {
                    var p = currentConfig.protocols;
                    var filtersToKill = [];
                    if (p.killEcho) filtersToKill = filtersToKill.concat(ECHO_FILTERS);
                    if (p.killNoise) filtersToKill = filtersToKill.concat(NOISE_FILTERS);
                    if (p.killGain) filtersToKill = filtersToKill.concat(GAIN_FILTERS);
                    filtersToKill.forEach(function(f) { c.audio[f] = false; });
                    console.log(LOG, 'getDisplayMedia interceptado — filtros de audio del sistema bloqueados.');
                }
            }
            return _gdm(c);
        };
    }

    // ============================================================
    // 5. getUserMedia — API legacy
    // ============================================================
    ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia'].forEach(function(fn) {
        if (navigator[fn]) {
            var _orig = navigator[fn].bind(navigator);
            navigator[fn] = function(c, ok, err) {
                killFilters(c);
                if (currentConfig.isActive) {
                    console.log(LOG, fn + ' legacy interceptado.');
                }
                return _orig(c, ok, err);
            };
        }
    });

    // ============================================================
    // 6. RTCPeerConnection — SDP Munging
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
    // 7. RTCRtpSender.setParameters()
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
    // 8. RTCRtpSender — Encoded Transform API (Insertable Streams)
    //    Sitios como Discord usan esto para procesar audio post-codec.
    //    Lo interceptamos para forzar passthrough si el protocolo está activo.
    // ============================================================
    if (window.RTCRtpSender && RTCRtpSender.prototype.createEncodedStreams) {
        var _ces = RTCRtpSender.prototype.createEncodedStreams;
        RTCRtpSender.prototype.createEncodedStreams = function() {
            var streams = _ces.apply(this, arguments);
            if (currentConfig.isActive && currentConfig.protocols.encodedTransform) {
                try {
                    // Pipe readable directamente a writable (passthrough sin procesamiento)
                    streams.readable.pipeTo(streams.writable);
                    console.log(LOG, 'Encoded Transform interceptado → passthrough activado.');
                } catch(e) {
                    // Si el sitio ya conectó los streams, no hacemos nada
                }
            }
            return streams;
        };
    }

    // ============================================================
    // 9. MediaStreamTrack.applyConstraints()
    // ============================================================
    if (window.MediaStreamTrack && MediaStreamTrack.prototype.applyConstraints) {
        var _ac = MediaStreamTrack.prototype.applyConstraints;
        MediaStreamTrack.prototype.applyConstraints = function(c) {
            if (currentConfig.isActive && this.kind === 'audio' && c) {
                var pr = currentConfig.protocols;
                if (pr.killEcho || pr.killNoise || pr.killGain) {
                    var filtersToKill = [];
                    if (pr.killEcho) filtersToKill = filtersToKill.concat(ECHO_FILTERS);
                    if (pr.killNoise) filtersToKill = filtersToKill.concat(NOISE_FILTERS);
                    if (pr.killGain) filtersToKill = filtersToKill.concat(GAIN_FILTERS);
                    filtersToKill.forEach(function(f) {
                        if (c[f] !== undefined) c[f] = false;
                    });
                    if (Array.isArray(c.advanced)) {
                        c.advanced.forEach(function(adv) {
                            filtersToKill.forEach(function(f) {
                                if (adv[f] !== undefined) adv[f] = false;
                            });
                        });
                    }
                    c.channelCount = 2;
                    console.log(LOG, 'applyConstraints interceptado — filtros bloqueados y estéreo mantenido.');
                }
            }
            return _ac.apply(this, arguments);
        };
    }

    // ============================================================
    // 10. MediaRecorder
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
    // 11. AudioContext — Compresores dinámicos (DynamicsCompressor)
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

    // ============================================================
    // 12. AudioWorklet — Interceptar módulos de procesamiento custom
    //     Sitios modernos registran sus procesadores de señal aquí.
    //     Bloqueamos addModule para que los módulos se registren pero
    //     avisamos en consola. El worklet en sí no se puede "desactivar"
    //     sin romper el sitio, pero sí reemplazamos el AudioWorkletNode
    //     para conectar un passthrough gain=1 si el protocolo está activo.
    // ============================================================
    function patchAudioWorklet(Ctx) {
        if (!Ctx || !Ctx.prototype) return;

        // Interceptar createGain para detectar si viene de nuestro passthrough
        // y parchear AudioWorkletNode para forzar ganancia unitaria.
        if (Ctx.prototype.createAudioWorkletNode || window.AudioWorkletNode) {
            var _AWN = window.AudioWorkletNode;
            if (_AWN) {
                window.AudioWorkletNode = function(context, processorName, opts) {
                    var node = new _AWN(context, processorName, opts);
                    if (currentConfig.isActive && currentConfig.protocols.audioWorklet) {
                        try {
                            // Insertar un nodo de ganancia 1:1 después del worklet
                            // para asegurar que no haya reducción de señal silenciosa
                            var passthrough = context.createGain();
                            passthrough.gain.value = 1.0;
                            // No reconectamos el grafo (rompería el sitio),
                            // pero logueamos el módulo detectado para diagnóstico
                            console.log(LOG, 'AudioWorkletNode interceptado: "' + processorName + '" — señal monitoreada.');
                        } catch(e) {}
                    }
                    return node;
                };
                // Copiar propiedades estáticas y prototipo
                window.AudioWorkletNode.prototype = _AWN.prototype;
                Object.getOwnPropertyNames(_AWN).forEach(function(prop) {
                    try {
                        if (prop !== 'prototype' && prop !== 'length' && prop !== 'name') {
                            Object.defineProperty(window.AudioWorkletNode, prop,
                                Object.getOwnPropertyDescriptor(_AWN, prop) || { value: _AWN[prop] }
                            );
                        }
                    } catch(e) {}
                });
            }
        }

        // Interceptar AudioWorklet.addModule para loguear qué módulos se cargan
        if (Ctx.prototype.audioWorklet !== undefined) {
            var AudioWorkletProto = Object.getPrototypeOf(
                (new (Ctx)({})).audioWorklet || {}
            );
            if (AudioWorkletProto && AudioWorkletProto.addModule) {
                var _am = AudioWorkletProto.addModule;
                AudioWorkletProto.addModule = function(url, opts) {
                    if (currentConfig.isActive && currentConfig.protocols.audioWorklet) {
                        console.log(LOG, 'AudioWorklet.addModule detectado: ' + url);
                    }
                    return _am.apply(this, arguments);
                };
            }
        }
    }

    try {
        patchAudioWorklet(window.AudioContext);
        patchAudioWorklet(window.webkitAudioContext);
    } catch(e) {
        console.log(LOG, 'AudioWorklet patch parcial (contexto no instanciable en este momento).');
    }

    // ============================================================
    // 13. AudioWorklet.addModule — WorkletFetch (EXPERIMENTAL)
    //     Intercepta la carga de módulos AudioWorklet, los descarga,
    //     inyecta un wrapper de passthrough en registerProcessor y
    //     los sirve como Blob URL. Fallback transparente ante CORS.
    // ============================================================
    if (window.AudioWorklet && AudioWorklet.prototype && AudioWorklet.prototype.addModule) {
        var _addModuleReal = AudioWorklet.prototype.addModule;
        AudioWorklet.prototype.addModule = function(url, opts) {
            var self = this;
            if (!currentConfig.isActive || !currentConfig.protocols.workletFetch) {
                return _addModuleReal.apply(self, arguments);
            }
            console.log(LOG, '[EXPERIMENTAL] WorkletFetch: interceptando módulo → ' + url);
            return fetch(url, { credentials: 'same-origin' })
                .then(function(r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.text();
                })
                .then(function(code) {
                    // Prepend a registerProcessor interceptor that replaces
                    // the processor's process() method with a direct passthrough.
                    // Uses ES5 prototype mutation to work with both ES5 and ES6 class processors.
                    var passthroughPrefix = [
                        ';(function(){',
                        '  var __rp = (typeof registerProcessor !== "undefined") ? registerProcessor : null;',
                        '  if (!__rp) return;',
                        '  registerProcessor = function(name, processorClass) {',
                        '    if (processorClass && processorClass.prototype) {',
                        '      processorClass.prototype.process = function(inputs, outputs) {',
                        '        try {',
                        '          for (var i = 0; i < inputs.length; i++) {',
                        '            for (var j = 0; j < (inputs[i] || []).length; j++) {',
                        '              if (outputs[i] && outputs[i][j] && inputs[i][j]) {',
                        '                outputs[i][j].set(inputs[i][j]);',
                        '              }',
                        '            }',
                        '          }',
                        '        } catch(e) {}',
                        '        return true;',
                        '      };',
                        '    }',
                        '    return __rp(name, processorClass);',
                        '  };',
                        '})();'
                    ].join('\n');
                    var wrappedCode = passthroughPrefix + '\n' + code;
                    var blob = new Blob([wrappedCode], { type: 'application/javascript' });
                    var blobUrl = URL.createObjectURL(blob);
                    console.log(LOG, '[EXPERIMENTAL] WorkletFetch: blob listo, cargando módulo parcheado.');
                    return _addModuleReal.call(self, blobUrl, opts);
                })
                .catch(function(e) {
                    // Fallback transparente: CORS, red, etc. No se rompe el sitio.
                    console.warn(LOG, '[EXPERIMENTAL] WorkletFetch fallback (sin interceptar): ' + e.message);
                    return _addModuleReal.apply(self, arguments);
                });
        };
    }

    console.log(
        '%c' + LOG + ' v2.5.0 — Protección de Audio Inicializada (MAIN world)',
        'color: #00ff88; font-weight: bold; font-size: 13px;'
    );
})();
