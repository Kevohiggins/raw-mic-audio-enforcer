# Raw Mic Audio Enforcer

Extensión para navegadores basados en Chromium (Brave, Chrome, Edge) diseñada para deshabilitar las cancelaciones de ruido, supresores de eco y compresores de volumen automáticos impuestos por el navegador y las aplicaciones web.

Fuerza la transmisión y grabación de audio crudo sin procesar, permitiendo bitrates de hasta 320 kbps (estéreo).

## Características
- Bloqueo de filtros nativos (`echoCancellation`, `noiseSuppression`, `autoGainControl`).
- Forzado de bitrate Opus hasta 320 kbps en llamadas WebRTC (Meet, Discord, etc.).
- Neutralización de compresores dinámicos en el motor Web Audio (`AudioContext`).
- Selector de calidad global (64, 128, 192 y 320 kbps).
- Control de estado global (ON/OFF) e interfaz para excluir sitios específicos (Lista Negra).

## Instalación

1. Descarga o clona este repositorio en tu equipo.
2. Abre tu navegador e ingresa a `chrome://extensions` (o `brave://extensions`).
3. Activa el **Modo de desarrollador** (esquina superior derecha).
4. Haz clic en **Cargar descomprimida** (Load unpacked).
5. Selecciona la carpeta `RawMicExtension` donde se encuentran los archivos.

## Créditos
- **Dirección y Diseño:** Kevin O'Higgins
- **Desarrollo de Código:** Gemini
