# Raw Mic Audio Enforcer

Extensión para navegadores basados en Chromium (Brave, Chrome, Edge, Vivaldi, Opera) diseñada para deshabilitar las cancelaciones de ruido, supresores de eco y controles de ganancia automáticos impuestos por el navegador y las aplicaciones web.

Fuerza la transmisión y grabación de audio sin procesar, permitiendo personalizar la tasa de bits hasta 320 kbps en estéreo.

## Características
- Bloqueo e independiente de filtros nativos (Cancelación de Eco, Supresión de Ruido y Control Automático de Ganancia).
- Aplicación de cambios de configuración en tiempo real sobre micrófonos activos sin necesidad de refrescar la página.
- Forzado de bitrate Opus (64, 128, 192 y 320 kbps) en llamadas WebRTC (Meet, Discord, etc.).
- Eliminación de filtros de audio del sistema al compartir pantalla (`getDisplayMedia`).
- Passthrough en pipelines de audio codificado (Encoded Transform API / Insertable Streams).
- Neutralización de compresores dinámicos en el motor Web Audio (`AudioContext`).
- Monitoreo e intercepción de procesadores de audio avanzados (`AudioWorklet` / `WorkletFetch`).
- Control de estado (ON/OFF) e interfaz para excluir sitios específicos (Lista Negra).

## Instalación

1. Descargá o cloná este repositorio.
2. Ingresá a la sección de extensiones de tu navegador (chrome://extensions).
3. Activá el Modo de desarrollador.
4. Hacé clic en Cargar descomprimida (Load unpacked).
5. Seleccioná la carpeta `RawMicExtension`, donde están los archivos.

## Créditos
- **Dirección y Diseño:** Kevin O'Higgins
- **Desarrollo de Código:** Gemini
