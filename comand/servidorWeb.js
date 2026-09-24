import express from 'express';
import qrcode from 'qrcode';

/**
 * Servidor Web y Panel de Control para Render Web Service
 */

let estadoBot = 'iniciando'; // 'iniciando' | 'esperando_qr' | 'conectado' | 'desconectado'
let qrCodeActual = null;
let qrDataUrlActual = null;
let infoUsuario = null; // { id: string, name: string }
let tiempoInicioServidor = Date.now();
let tiempoUltimoQR = null;
let razonUltimaDesconexion = null;
let servidorIniciado = false;

const app = express();
app.use(express.json());

/**
 * Actualiza el código QR actual y genera su imagen en base64 para la web
 * @param {string} qrString 
 */
export async function actualizarQR(qrString) {
    estadoBot = 'esperando_qr';
    qrCodeActual = qrString;
    tiempoUltimoQR = Date.now();
    try {
        qrDataUrlActual = await qrcode.toDataURL(qrString, {
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 8,
            color: {
                dark: '#1e1e2f',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error('⚠️ Error al generar imagen DataURL del QR:', err.message);
    }
}

/**
 * Notifica que el bot se ha conectado con éxito
 * @param {object} info 
 */
export function actualizarConectado(info) {
    estadoBot = 'conectado';
    qrCodeActual = null;
    qrDataUrlActual = null;
    razonUltimaDesconexion = null;
    infoUsuario = info;
}

/**
 * Notifica que la conexión se ha cerrado o está reintentando
 * @param {string|number} razon 
 */
export function actualizarDesconectado(razon) {
    estadoBot = 'desconectado';
    razonUltimaDesconexion = razon;
}

/**
 * Devuelve el estado actual en formato objeto
 */
export function obtenerEstado() {
    const uptimeSegundos = Math.floor((Date.now() - tiempoInicioServidor) / 1000);
    const memoriaMB = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);

    return {
        estado: estadoBot,
        qr: qrDataUrlActual,
        usuario: infoUsuario,
        uptimeSegundos,
        memoriaMB,
        razonDesconexion: razonUltimaDesconexion
    };
}

// Ruta de comprobación de salud para Render / UptimeRobot (200 OK siempre)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        bot: estadoBot,
        uptime: Math.floor((Date.now() - tiempoInicioServidor) / 1000)
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// API para consultar el estado en tiempo real desde la web
app.get('/api/estado', (req, res) => {
    res.json(obtenerEstado());
});

// Dashboard Web Interactivo
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yui Hirasawa - Panel de Control WhatsApp Bot</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: rgba(22, 27, 34, 0.85);
            --card-border: rgba(255, 105, 180, 0.2);
            --accent-pink: #ff65a3;
            --accent-purple: #7952b3;
            --accent-blue: #58a6ff;
            --accent-green: #2ea043;
            --accent-yellow: #d29922;
            --accent-red: #f85149;
            --text-main: #f0f6fc;
            --text-muted: #8b949e;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a162b 100%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 24px 16px;
        }

        .container {
            width: 100%;
            max-width: 680px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .header-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 20px;
            padding: 24px;
            backdrop-filter: blur(12px);
            text-align: center;
            box-shadow: 0 8px 32px rgba(255, 101, 163, 0.08);
            position: relative;
            overflow: hidden;
        }

        .header-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #ff65a3, #b388ff, #ff65a3);
        }

        .avatar-title {
            font-size: 2.2rem;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-bottom: 12px;
        }

        .badge-status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            border-radius: 30px;
            font-size: 0.88rem;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            transition: all 0.3s ease;
        }

        .badge-conectado {
            background: rgba(46, 160, 67, 0.15);
            color: #3fb950;
            border: 1px solid rgba(46, 160, 67, 0.4);
        }

        .badge-esperando_qr {
            background: rgba(210, 153, 34, 0.15);
            color: #e3b341;
            border: 1px solid rgba(210, 153, 34, 0.4);
        }

        .badge-desconectado, .badge-iniciando {
            background: rgba(248, 81, 73, 0.15);
            color: #ff7b72;
            border: 1px solid rgba(248, 81, 73, 0.4);
        }

        .pulsing-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
            background-color: currentColor;
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.9); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.7; }
        }

        .card {
            background: var(--card-bg);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 18px;
            padding: 22px;
            backdrop-filter: blur(10px);
        }

        .qr-section {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }

        .qr-wrapper {
            background: #ffffff;
            padding: 16px;
            border-radius: 16px;
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
            display: inline-block;
            max-width: 290px;
            width: 100%;
        }

        .qr-wrapper img {
            width: 100%;
            height: auto;
            display: block;
        }

        .instructions {
            text-align: left;
            background: rgba(255, 255, 255, 0.04);
            padding: 14px 18px;
            border-radius: 12px;
            font-size: 0.9rem;
            color: #c9d1d9;
            width: 100%;
            line-height: 1.5;
        }

        .instructions ol {
            padding-left: 20px;
            margin-top: 6px;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
            margin-top: 14px;
        }

        .stat-box {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 12px;
            text-align: center;
        }

        .stat-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-value {
            font-size: 1.15rem;
            font-weight: 600;
            color: var(--text-main);
            margin-top: 4px;
        }

        .commands-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }

        .command-tag {
            background: rgba(255, 101, 163, 0.12);
            color: #ff85be;
            border: 1px solid rgba(255, 101, 163, 0.25);
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 0.82rem;
            font-family: monospace;
        }

        .keepalive-box {
            background: rgba(88, 166, 255, 0.08);
            border: 1px solid rgba(88, 166, 255, 0.2);
            border-radius: 12px;
            padding: 14px;
            font-size: 0.85rem;
            color: #8bb8e8;
            line-height: 1.4;
        }

        footer {
            margin-top: 24px;
            color: var(--text-muted);
            font-size: 0.82rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Encabezado con estado -->
        <div class="header-card">
            <h1 class="avatar-title">🎸 Yui Hirasawa 🍰</h1>
            <p class="subtitle">Bot de WhatsApp en Render Web Service</p>
            <div id="statusBadge" class="badge-status badge-iniciando">
                <span class="pulsing-dot"></span>
                <span id="statusText">Cargando estado...</span>
            </div>
        </div>

        <!-- Sección de QR (visible si esperando_qr) -->
        <div id="qrCard" class="card qr-section" style="display: none;">
            <h2 style="font-size: 1.2rem; color: #ff85be;">📱 Escanea el Código QR</h2>
            <div class="qr-wrapper">
                <img id="qrImage" src="" alt="Código QR de WhatsApp">
            </div>
            <div class="instructions">
                <strong>¿Cómo vincular tu bot?</strong>
                <ol>
                    <li>Abre WhatsApp en tu teléfono celular.</li>
                    <li>Toca <strong>Menú (⋮)</strong> o <strong>Ajustes (⚙️)</strong> > <strong>Dispositivos vinculados</strong>.</li>
                    <li>Toca <strong>"Vincular un dispositivo"</strong>.</li>
                    <li>Apunta la cámara hacia este código QR.</li>
                </ol>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted);">
                🔄 Este código se actualiza automáticamente cada 3 segundos si cambia.
            </p>
        </div>

        <!-- Sección de Conectado (visible si conectado) -->
        <div id="connectedCard" class="card" style="display: none;">
            <div style="text-align: center; padding: 12px;">
                <div style="font-size: 3rem; margin-bottom: 8px;">✨🎉</div>
                <h2 style="color: #3fb950; font-size: 1.3rem;">¡Bot Conectado y Listo!</h2>
                <p style="color: var(--text-muted); margin-top: 4px;" id="botWelcomeMsg">
                    Yui Hirasawa está activa en WhatsApp respondiendo comandos.
                </p>
            </div>
        </div>

        <!-- Estadísticas y detalles del servicio -->
        <div class="card">
            <h3 style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 8px;">📊 Telemetría del Servicio</h3>
            <div class="info-grid">
                <div class="stat-box">
                    <div class="stat-label">Número Bot</div>
                    <div class="stat-value" id="statNumero">--</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Uptime</div>
                    <div class="stat-value" id="statUptime">0s</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Memoria RAM</div>
                    <div class="stat-value" id="statMemoria">-- MB</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Puerto Web</div>
                    <div class="stat-value">${process.env.PORT || 3000}</div>
                </div>
            </div>
        </div>

        <!-- Comandos disponibles -->
        <div class="card">
            <h3 style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 4px;">💬 Comandos Activos (Prefijo: -)</h3>
            <div class="commands-list">
                <span class="command-tag">-menu</span>
                <span class="command-tag">-yui [pregunta]</span>
                <span class="command-tag">-s / -sticker</span>
                <span class="command-tag">-img / -imagen</span>
                <span class="command-tag">-gif</span>
                <span class="command-tag">-reveal</span>
                <span class="command-tag">-meme [arriba]|[abajo]</span>
                <span class="command-tag">-ytmp3 [link/canción]</span>
                <span class="command-tag">-ytmp4 [link]</span>
                <span class="command-tag">-tiktok [link]</span>
                <span class="command-tag">-ardilla / -grave / -robot</span>
            </div>
        </div>

        <!-- Tip para UptimeRobot / Render Free -->
        <div class="keepalive-box">
            💡 <strong>Consejo para Render Free Tier:</strong> Para evitar que el contenedor se suspenda por inactividad tras 15 minutos, puedes registrar la URL <code>${req.protocol}://${req.get('host')}/health</code> en un servicio gratuito de monitoreo como <strong>UptimeRobot</strong> o <strong>cron-job.org</strong> con pings cada 10 minutos.
        </div>

        <footer>
            Yui Hirasawa Bot • Alojado en Render • Baileys + Gemini AI
        </footer>
    </div>

    <script>
        function formatearUptime(segundos) {
            const h = Math.floor(segundos / 3600);
            const m = Math.floor((segundos % 3600) / 60);
            const s = segundos % 60;
            if (h > 0) return h + 'h ' + m + 'm';
            if (m > 0) return m + 'm ' + s + 's';
            return s + 's';
        }

        async function actualizarEstado() {
            try {
                const res = await fetch('/api/estado');
                if (!res.ok) return;
                const data = await res.json();

                const badge = document.getElementById('statusBadge');
                const text = document.getElementById('statusText');
                const qrCard = document.getElementById('qrCard');
                const qrImg = document.getElementById('qrImage');
                const connCard = document.getElementById('connectedCard');
                const statNumero = document.getElementById('statNumero');
                const statUptime = document.getElementById('statUptime');
                const statMemoria = document.getElementById('statMemoria');

                statUptime.textContent = formatearUptime(data.uptimeSegundos);
                statMemoria.textContent = data.memoriaMB + ' MB';

                if (data.usuario && data.usuario.id) {
                    const cleanNum = data.usuario.id.split(':')[0];
                    statNumero.textContent = '+' + cleanNum;
                } else {
                    statNumero.textContent = '--';
                }

                // Ajustar visuales según estado
                badge.className = 'badge-status badge-' + data.estado;

                if (data.estado === 'conectado') {
                    text.textContent = 'En línea y conectado';
                    qrCard.style.display = 'none';
                    connCard.style.display = 'block';
                } else if (data.estado === 'esperando_qr') {
                    text.textContent = 'Esperando escaneo QR';
                    connCard.style.display = 'none';
                    if (data.qr) {
                        qrImg.src = data.qr;
                        qrCard.style.display = 'flex';
                    }
                } else if (data.estado === 'desconectado') {
                    text.textContent = 'Reconectando...';
                    qrCard.style.display = 'none';
                    connCard.style.display = 'none';
                } else {
                    text.textContent = 'Iniciando bot...';
                    qrCard.style.display = 'none';
                    connCard.style.display = 'none';
                }
            } catch (err) {
                console.error('Error al actualizar estado:', err);
            }
        }

        // Consultar cada 2.5 segundos
        setInterval(actualizarEstado, 2500);
        actualizarEstado();
    </script>
</body>
</html>`;
    res.send(html);
});

/**
 * Inicia el servidor web en el puerto asignado por Render (process.env.PORT || 3000)
 * @param {number|string} puerto 
 */
export function iniciarServidorWeb(puerto = process.env.PORT || 3000) {
    if (servidorIniciado) return;

    app.listen(puerto, '0.0.0.0', () => {
        servidorIniciado = true;
        console.log(`🌐 [Servidor Web] Panel de control activo en el puerto ${puerto}`);
        console.log(`🔗 URL local/nube: http://0.0.0.0:${puerto}/`);
        console.log(`🩺 Health check disponible en: http://0.0.0.0:${puerto}/health`);
    });
}
