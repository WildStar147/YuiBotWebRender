import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { obtenerEstadoSesion } from './sesioon.js';
import { procesarMensajes } from './handler.js';
import { actualizarQR, actualizarConectado, actualizarDesconectado } from './servidorWeb.js';

/**
 * Módulo de conexión con WhatsApp Web mediante Baileys
 */

/**
 * Inicializa y mantiene la conexión del bot de WhatsApp
 */
export async function iniciarConexion() {
    try {
        // Obtenemos el estado de autenticación multi-archivo
        const { state, saveCreds } = await obtenerEstadoSesion();

        // Obtenemos la última versión disponible de WhatsApp Web
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📡 Versión de WhatsApp Web: v${version.join('.')} (Última: ${isLatest})`);

        // Creamos la instancia del socket de Baileys
        const sock = makeWASocket({
            version,
            auth: state,
            // Nivel de logs 'silent' para que no ensucie la visualización del QR en consola
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false, // Lo manejamos explícitamente abajo con qrcode-terminal
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: true,
            syncFullHistory: false
        });

        // Manejo de eventos de actualización de conexión (QR, abierta, cerrada)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Si hay un código QR disponible, lo actualizamos en la web y lo imprimimos en terminal
            if (qr) {
                await actualizarQR(qr);

                console.log('\n======================================================');
                console.log('📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP 📱');
                console.log('🌐 O abre el panel web para escanearlo desde el navegador');
                console.log('======================================================');
                console.log('1. Abre WhatsApp en tu teléfono.');
                console.log('2. Toca Menú (⋮) o Ajustes (⚙️) > Dispositivos vinculados.');
                console.log('3. Selecciona "Vincular un dispositivo".');
                console.log('4. Apunta la cámara de tu teléfono a este código:');
                console.log('------------------------------------------------------\n');
                
                qrcode.generate(qr, { small: true });

                console.log('\n------------------------------------------------------');
                console.log('⏳ Esperando que escanees el código...');
                console.log('======================================================\n');
            }

            // Manejo de desconexión
            if (connection === 'close') {
                const razonError = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const esCierreVoluntario = razonError === DisconnectReason.loggedOut;

                actualizarDesconectado(razonError || 'close');
                console.log(`\n⚠️ Conexión cerrada. Código de desconexión: ${razonError}`);

                if (!esCierreVoluntario) {
                    console.log('🔄 Reconectando automáticamente a WhatsApp en 3 segundos...');
                    setTimeout(() => {
                        iniciarConexion();
                    }, 3000);
                } else {
                    console.log('❌ Sesión cerrada desde el teléfono. Deberás volver a escanear el código QR.');
                }
            } else if (connection === 'open') {
                const numeroBot = sock.user?.id ? sock.user.id.split(':')[0] : 'Desconocido';
                const nombreBot = sock.user?.name || 'Yui Hirasawa';

                actualizarConectado({ id: sock.user?.id, name: nombreBot });

                console.log('\n======================================================');
                console.log('✨ ¡CONEXIÓN ESTABLECIDA EXITOSAMENTE CON WHATSAPP! ✨');
                console.log(`🎸 Bot: ${nombreBot}`);
                console.log(`📱 Número: +${numeroBot}`);
                console.log('💬 Prefijo activo: "-" (prueba con -menu)');
                console.log('🍰 ¡Yui Hirasawa está lista para recibir mensajes!');
                console.log('======================================================\n');
            }
        });

        // Guardar credenciales actualizadas cada vez que cambien
        sock.ev.on('creds.update', saveCreds);

        // Escuchar y procesar mensajes entrantes
        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                await procesarMensajes(sock, chatUpdate);
            } catch (errMensaje) {
                console.error('Error al procesar mensaje:', errMensaje);
            }
        });

        return sock;
    } catch (error) {
        console.error('❌ Error al iniciar la conexión con Baileys:', error);
        console.log('🔄 Reintentando iniciar conexión en 5 segundos...');
        setTimeout(() => iniciarConexion(), 5000);
    }
}
