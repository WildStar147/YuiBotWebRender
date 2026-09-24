import { manejarYui } from './yui.js';
import { manejarAdmin } from './admin.js';
import {
    manejarCrearSticker,
    manejarStickerAImagen,
    manejarStickerAGif,
    manejarReveal,
    manejarFiltroAudio,
    manejarMeme
} from './multimedia.js';
import {
    manejarTikTok,
    manejarYouTubeMP3,
    manejarYouTubeMP4,
    manejarInstagram
} from './descargas.js';
import {
    registrarInteraccionGrupo,
    obtenerMetricasGrupo
} from './memoria.js';

// Prefijo configurado para los comandos del bot
export const PREFIJO = '-';

/**
 * Genera el texto del menú principal de Yui
 * @param {string} pushName 
 * @returns {string}
 */
function generarMenu(pushName) {
    return `╭━━━〔 🎸 *YUI BOT (K-ON! + IA)* 🍰 〕━━━╮\n` +
           `┃ ¡Konnichiwa, *${pushName || 'amig@'}*! (≧∇≦)/ \n` +
           `┃ Soy *Yui Hirasawa*, tu bot multifunción.\n` +
           `┃ Prefijo actual: [ *${PREFIJO}* ]\n` +
           `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
           `🤖 *───「 HABLA CON YUI (IA CON MEMORIA) 」───* 🤖\n` +
           ` 💬 *${PREFIJO}yui [mensaje]* : Platica lo que sea con Yui.\n` +
           `    _Ejemplo: ${PREFIJO}yui ¿Cuántas personas hay en el grupo y con cuántas has hablado?_\n` +
           `    _Ejemplo: ${PREFIJO}yui Ayúdame con mi tarea o cuéntame una historia_\n` +
           ` 🧹 *${PREFIJO}yui olvidar* : Reinicia la memoria de la conversación.\n\n` +
           `📥 *───「 DESCARGAS MULTIMEDIA 」───* 📥\n` +
           ` 🎵 *${PREFIJO}ytmp3 [canción/link]* : Descarga música de YouTube en MP3.\n` +
           ` 🎬 *${PREFIJO}ytmp4 [video/link]* : Descarga videos de YouTube en MP4.\n` +
           ` 📱 *${PREFIJO}tiktok [link]* : Descarga videos de TikTok sin marca de agua.\n` +
           ` 📸 *${PREFIJO}ig [link]* : Descarga reels o videos de Instagram.\n\n` +
           `🎨 *───「 STICKERS Y MULTIMEDIA 」───* 🎨\n` +
           ` 🖼️ *${PREFIJO}s* o *${PREFIJO}sticker* : Convierte una foto o video/gif en sticker.\n` +
           ` 📷 *${PREFIJO}img* o *${PREFIJO}imagen* : Convierte un sticker citado en foto normal.\n` +
           ` 🎞️ *${PREFIJO}gif* : Convierte un sticker animado o video a GIF.\n` +
           ` 🔓 *${PREFIJO}reveal* : Descubre fotos o videos de "ver una sola vez".\n\n` +
           `🎛️ *───「 EFECTOS DE AUDIO (CITA UN AUDIO) 」───* 🎛️\n` +
           ` 🐿️ *${PREFIJO}ardilla* : Voz aguda y rápida de ardillita.\n` +
           ` 🗿 *${PREFIJO}grave* : Voz gruesa y profunda.\n` +
           ` 🤖 *${PREFIJO}robot* : Efecto de modulación robótica.\n` +
           ` 🔊 *${PREFIJO}eco* : Efecto de cámara de eco.\n` +
           ` ⏪ *${PREFIJO}reversa* : Audio reproducido al revés.\n` +
           ` ⏩ *${PREFIJO}rapido* : Audio a velocidad 1.5x.\n\n` +
           `🤣 *───「 GENERADOR DE MEMES 」───* 🤣\n` +
           ` 🎭 *${PREFIJO}meme [arriba] | [abajo]* : Añade texto a una foto citada.\n\n` +
           `🌸 *───「 ACCIONES Y CARIÑO 」───* 🌸\n` +
           ` 🤗 *${PREFIJO}hug* : Recibe un abrazo calientito de Yui\n` +
           ` ✨ *${PREFIJO}pat* : Caricias y ánimos en la cabecita\n\n` +
           `⚙️ *───「 SISTEMA Y DIAGNÓSTICO 」───* ⚙️\n` +
           ` 🏓 *${PREFIJO}ping* : Medir velocidad de respuesta\n` +
           ` 📊 *${PREFIJO}info* : Estado del sistema y tiempo activo\n` +
           ` 📖 *${PREFIJO}menu* : Ver esta lista de comandos\n\n` +
           `_Funciona tanto en chats privados como en grupos._\n` +
           `_¡Vamos a divertirnos mucho juntos! Ehehe~ 🍓_`;
}

/**
 * Procesa la lista de mensajes entrantes desde Baileys
 * @param {object} sock - Instancia de Baileys
 * @param {object} chatUpdate - Actualización de mensajes (messages.upsert)
 */
export async function procesarMensajes(sock, chatUpdate) {
    if (!chatUpdate.messages) return;

    for (const m of chatUpdate.messages) {
        // Ignoramos mensajes sin contenido o estados/historias de WhatsApp
        if (!m.message || m.key.remoteJid === 'status@broadcast') continue;

        const from = m.key.remoteJid;
        const esGrupo = from.endsWith('@g.us');
        const sender = esGrupo ? m.key.participant : from;
        const pushName = m.pushName || 'Amig@';

        // Extraer texto del mensaje (conversación normal, mensaje extendido, fotos o videos)
        const msg = m.message;
        const texto = (
            msg.conversation ||
            msg.extendedTextMessage?.text ||
            msg.imageMessage?.caption ||
            msg.videoMessage?.caption ||
            ''
        ).trim();

        // Si no empieza con el prefijo "-", lo ignoramos
        if (!texto.startsWith(PREFIJO)) continue;

        // Registrar interacción grupal si ocurrió en un grupo
        if (esGrupo) {
            registrarInteraccionGrupo(from, sender, pushName);
        }

        // Separar el comando de los argumentos
        const sinPrefijo = texto.slice(PREFIJO.length).trim();
        const partes = sinPrefijo.split(/\s+/);
        const comando = (partes[0] || '').toLowerCase();
        const args = partes.slice(1);

        if (!comando) continue;

        const msgInfo = {
            m,
            from,
            sender,
            esGrupo,
            pushName,
            messageTimestamp: m.messageTimestamp
        };

        // Menú principal
        if (comando === 'menu' || comando === 'help' || comando === 'ayuda') {
            await sock.sendMessage(from, { text: generarMenu(pushName) });
            continue;
        }

        // --- SECCIÓN DESCARGAS ---
        if (comando === 'tiktok' || comando === 'tt') {
            await manejarTikTok(sock, msgInfo, args);
            continue;
        }

        if (comando === 'ytmp3' || comando === 'play') {
            await manejarYouTubeMP3(sock, msgInfo, args);
            continue;
        }

        if (comando === 'ytmp4' || comando === 'video') {
            await manejarYouTubeMP4(sock, msgInfo, args);
            continue;
        }

        if (comando === 'ig' || comando === 'instagram') {
            await manejarInstagram(sock, msgInfo, args);
            continue;
        }

        // --- SECCIÓN STICKERS Y MULTIMEDIA ---
        if (comando === 's' || comando === 'sticker') {
            await manejarCrearSticker(sock, msgInfo);
            continue;
        }

        if (comando === 'img' || comando === 'imagen') {
            await manejarStickerAImagen(sock, msgInfo);
            continue;
        }

        if (comando === 'gif') {
            await manejarStickerAGif(sock, msgInfo);
            continue;
        }

        if (comando === 'reveal' || comando === 'revelar') {
            await manejarReveal(sock, msgInfo);
            continue;
        }

        // --- SECCIÓN EFECTOS DE AUDIO ---
        if (['ardilla', 'grave', 'robot', 'eco', 'reversa', 'rapido'].includes(comando)) {
            await manejarFiltroAudio(sock, msgInfo, comando);
            continue;
        }

        // --- SECCIÓN GENERADOR DE MEMES ---
        if (comando === 'meme') {
            await manejarMeme(sock, msgInfo, args);
            continue;
        }

        // --- SECCIÓN YUI (IA Y AFECTO) ---
        if (['yui', 'hug', 'abrazo', 'pat', 'caricia'].includes(comando)) {
            let datosGrupo = null;
            if (esGrupo) {
                try {
                    const meta = await sock.groupMetadata(from);
                    const metricas = obtenerMetricasGrupo(from);
                    datosGrupo = {
                        id: from,
                        nombre: meta.subject,
                        totalParticipantes: meta.participants.length,
                        metricas
                    };
                } catch (err) {
                    console.warn('⚠️ No se pudo obtener información del grupo:', err.message);
                }
            }

            await manejarYui(sock, msgInfo, comando, args, datosGrupo);
            continue;
        }

        // --- SECCIÓN ADMINISTRACIÓN Y DIAGNÓSTICO ---
        if (['ping', 'info', 'estado'].includes(comando)) {
            await manejarAdmin(sock, msgInfo, comando, args);
            continue;
        }

        // Si es un comando desconocido pero usó el prefijo "-"
        await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaa~! No reconozco el comando *${PREFIJO}${comando}*.\nEscribe *${PREFIJO}menu* para ver la lista de comandos disponibles. 🍰✨`
        });
    }
}
