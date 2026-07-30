# Raw Mic Audio Enforcer

Extensión para navegadores basados en Chromium (Brave, Chrome, Edge) diseñada para deshabilitar las cancelaciones de ruido, supresores de eco y compresores de volumen automáticos impuestos por el navegador y las aplicaciones web.

## Características
- Bloqueo de filtros nativos (`echoCancellation`, `noiseSuppression`, `autoGainControl`).
- Forzado de bitrate Opus hasta 320 kbps en llamadas WebRTC (Meet, Discord, etc.).
- Neutralización de compresores dinámicos en el motor Web Audio (`AudioContext`).
- Selector de calidad global (64, 128, 192 y 320 kbps).
- Control de estado global (ON/OFF) e interfaz para excluir sitios específicos (Lista Negra).

## Instalación

1. Descargá o cloná este repositorio.
2. Ingresá a chrome://extensions (funciona con otros navegadores, pero Chrome es el estándar).
3. Activá el Modo de desarrollador.
4. Hacé clic en Cargar descomprimida (Load unpacked).
5. Seleccioná la carpeta RawMicExtension, donde están los archivos.

## Créditos
- **Dirección y Diseño:** Kevin O'Higgins
- **Desarrollo de Código:** Gemini
