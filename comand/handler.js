import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { manejarYui } from './yui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { manejarAdmin } from './admin.js';
import {
    manejarCrearSticker,
    manejarStickerAImagen,
    manejarStickerAGif,
    manejarReveal,
    manejarFiltroAudio,
    manejarMeme,
    manejarBrat
} from './multimedia.js';
import {
    manejarTikTok,
    manejarYouTubeMP3,
    manejarYouTubeMP4,
    manejarInstagram,
    manejarPinterest
} from './descargas.js';
import {
    registrarInteraccionGrupo,
    obtenerMetricasGrupo
} from './memoria.js';
import {
    manejarBalance,
    manejarDaily,
    manejarWork,
    manejarCrime,
    manejarSlut,
    manejarSteal,
    manejarDeposit,
    manejarWithdraw,
    manejarPay,
    manejarCoinflip,
    manejarRoulette,
    manejarBaltop,
    manejarEconomyInfo
} from './economia.js';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import {
    manejarRoll,
    manejarClaim,
    manejarHarem,
    manejarCharInfo,
    manejarCharImage,
    manejarCharVideo,
    manejarGiveChar,
    manejarGiveAllHarem,
    manejarDeleteWaifu,
    manejarSell,
    manejarBuyChar,
    manejarHaremShop,
    manejarRemoveSale,
    manejarWaifusTop,
    manejarVote,
    manejarSetClaimMsg,
    manejarDelClaimMsg
} from './gacha.js';

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
           ` 📱 *${PREFIJO}tiktok [link]* : Descarga videos de TikTok sin marca de agua.\n` +
           ` 📸 *${PREFIJO}ig [link]* : Descarga reels o videos de Instagram.\n` +
           ` 📌 *${PREFIJO}pin [búsqueda]* : Busca fotos anime o aesthetic en Pinterest.\n\n` +
           `🎨 *───「 STICKERS Y MULTIMEDIA 」───* 🎨\n` +
           ` 🖼️ *${PREFIJO}s* o *${PREFIJO}sticker* : Convierte una foto o video/gif en sticker.\n` +
           ` 🤍 *${PREFIJO}brat [texto]* : Crea stickers estilo álbum brat (fondo blanco, texto borroso).\n` +
           ` 📷 *${PREFIJO}img* o *${PREFIJO}imagen* : Convierte un sticker citado en foto normal.\n` +
           ` 🎞️ *${PREFIJO}gif* : Convierte un sticker animado o video a GIF.\n` +
           ` 🔓 *${PREFIJO}reveal* : Descubre fotos o videos de "ver una sola vez".\n\n` +
           `🎛️ *───「 EFECTOS DE AUDIO (CITA UN AUDIO) 」───* 🎛️\n` +
           ` 🐿️ *${PREFIJO}ardilla* : Voz aguda y rápida de ardillita.\n` +
           ` 🗿 *${PREFIJO}grave* : Voz gruesa y profunda.\n` +
           ` 🤖 *${PREFIJO}robot* : Efecto de modulación robótica.\n` +
           ` 🔊 *${PREFIJO}eco* : Efecto de cámara de eco.\n` +
           ` ⏪ *${PREFIJO}reversa* : Audio reproducido al revés.\n` +
           ` ⏩ *${PREFIJO}rapido* : Audio a velocidad 1.5x.\n` +
           ` 🐢 *${PREFIJO}lento* : Audio a velocidad lenta (slowed).\n\n` +
           `🤣 *───「 GENERADOR DE MEMES 」───* 🤣\n` +
           ` 🎭 *${PREFIJO}meme [arriba] | [abajo]* : Añade texto a una foto citada.\n\n` +
           `🌸 *───「 ACCIONES Y CARIÑO 」───* 🌸\n` +
           ` 🤗 *${PREFIJO}hug* o *${PREFIJO}abrazo [@tag]* : Da o recibe un abrazo dulce y calientito.\n` +
           ` 🐾 *${PREFIJO}pat* o *${PREFIJO}caricia [@tag]* : Mimos y caricias tiernas en la cabeza (*pat pat*).\n\n` +
           `💰 *───「 ECONOMÍA Y BANCO 」───* 💰\n` +
           ` 🪙 *${PREFIJO}bal* o *${PREFIJO}balance* : Ver tu dinero en mano y en banco.\n` +
           ` 🎁 *${PREFIJO}daily* : Reclamar tu recompensa diaria con racha.\n` +
           ` 💼 *${PREFIJO}work* o *${PREFIJO}w* : Trabajar para ganar coins honradamente.\n` +
           ` 🥷 *${PREFIJO}crime* : Cometer crímenes de riesgo (¡cuidado con la policía!).\n` +
           ` 💋 *${PREFIJO}slut* : Salir a conseguir propinas en la noche.\n` +
           ` 🕵️ *${PREFIJO}robar [@tag]* : Intentar robar la wallet de un amigo.\n` +
           ` 🏦 *${PREFIJO}dep [cantidad|all]* : Depositar dinero en el banco para protegerlo.\n` +
           ` 🏧 *${PREFIJO}with [cantidad|all]* : Retirar dinero de tu cuenta bancaria.\n` +
           ` 💸 *${PREFIJO}pay [@tag] [cantidad]* : Transferir dinero a otro usuario.\n` +
           ` 🪙 *${PREFIJO}cf [cantidad] [cara/cruz]* : Doble o nada con cara o cruz.\n` +
           ` 🎰 *${PREFIJO}rt [rojo/negro] [cantidad]* : Apostar en la ruleta del casino.\n` +
           ` 🏆 *${PREFIJO}baltop* : Ver el ranking de usuarios más ricos.\n` +
           ` 📊 *${PREFIJO}einfo* : Tus estadísticas completas de economía.\n\n` +
           `🎴 *───「 GACHA Y HAREM DE WAIFUS 」───* 🎴\n` +
           ` 🎲 *${PREFIJO}roll* o *${PREFIJO}rw* : Girar la ruleta para sacar una waifu aleatoria.\n` +
           ` 💍 *${PREFIJO}claim* o *${PREFIJO}c* : Reclamar la waifu que acaba de salir en la ruleta.\n` +
           ` 🌸 *${PREFIJO}harem* o *${PREFIJO}waifus* : Ver tu colección de waifus reclamadas.\n` +
           ` ℹ️ *${PREFIJO}winfo [nombre]* : Información y valor de cualquier personaje.\n` +
           ` 🖼️ *${PREFIJO}cimage [nombre]* : Buscar fotos infinitas de cualquier waifu (o aleatoria de nekos.best).\n` +
           ` 🎬 *${PREFIJO}cvideo [nombre]* : Video/GIF animado de una waifu o anime.\n` +
           ` 🎁 *${PREFIJO}regalar [@tag] [nombre]* : Regalar un personaje de tu harem a un amigo.\n` +
           ` 🏷️ *${PREFIJO}vender [precio] [nombre]* : Poner un personaje a la venta en la tienda.\n` +
           ` 🛒 *${PREFIJO}tienda* o *${PREFIJO}wshop* : Ver personajes en venta por otros usuarios.\n` +
           ` 🛍️ *${PREFIJO}comprar [nombre]* : Comprar un personaje en venta.\n` +
           ` ↩️ *${PREFIJO}removerventa [nombre]* : Retirar tu waifu del mercado.\n` +
           ` 🕊️ *${PREFIJO}delwaifu [nombre]* : Liberar un personaje a cambio del 50% de su valor.\n` +
           ` 👑 *${PREFIJO}wtop* o *${PREFIJO}topwaifus [pág]* : Top mundial oficial de waifus (*-wtop harem* para coleccionistas).\n` +
           ` 💖 *${PREFIJO}votar [nombre]* : Votar por una waifu (+coins y +popularidad).\n` +
           ` 💬 *${PREFIJO}setclaim [texto]* : Personalizar tu frase de victoria al reclamar.\n\n` +
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
        const botJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
        const rawSender = m.key.fromMe
            ? botJid
            : (esGrupo ? (m.key.participant || m.participant) : from);
        const sender = rawSender ? jidNormalizedUser(rawSender) : null;
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

        // Menú principal con imagen banner de Yui
        if (comando === 'menu' || comando === 'help' || comando === 'ayuda') {
            const rutaBanner = path.join(__dirname, '..', 'assets', 'banner_yui.jpg');
            if (fs.existsSync(rutaBanner)) {
                const bufferBanner = fs.readFileSync(rutaBanner);
                await sock.sendMessage(from, {
                    image: bufferBanner,
                    caption: generarMenu(pushName)
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: generarMenu(pushName) }, { quoted: m });
            }
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

        if (comando === 'pin' || comando === 'pinterest') {
            await manejarPinterest(sock, msgInfo, args);
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

        if (comando === 'brat') {
            await manejarBrat(sock, msgInfo, args);
            continue;
        }

        // --- SECCIÓN EFECTOS DE AUDIO ---
        if (['ardilla', 'grave', 'robot', 'eco', 'reversa', 'rapido', 'lento'].includes(comando)) {
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

        // --- SECCIÓN ECONOMÍA ---
        if (['bal', 'balance', 'coins'].includes(comando)) {
            await manejarBalance(sock, msgInfo, args);
            continue;
        }
        if (['daily', 'diario'].includes(comando)) {
            await manejarDaily(sock, msgInfo);
            continue;
        }
        if (['work', 'w', 'trabajar'].includes(comando)) {
            await manejarWork(sock, msgInfo);
            continue;
        }
        if (['crime', 'crimen'].includes(comando)) {
            await manejarCrime(sock, msgInfo);
            continue;
        }
        if (['slut'].includes(comando)) {
            await manejarSlut(sock, msgInfo);
            continue;
        }
        if (['steal', 'robar', 'rob'].includes(comando)) {
            await manejarSteal(sock, msgInfo, args);
            continue;
        }
        if (['dep', 'deposit', 'depositar', 'd'].includes(comando)) {
            await manejarDeposit(sock, msgInfo, args);
            continue;
        }
        if (['with', 'withdraw', 'retirar'].includes(comando)) {
            await manejarWithdraw(sock, msgInfo, args);
            continue;
        }
        if (['pay', 'givecoins', 'coinsgive'].includes(comando)) {
            await manejarPay(sock, msgInfo, args);
            continue;
        }
        if (['coinflip', 'flip', 'cf'].includes(comando)) {
            await manejarCoinflip(sock, msgInfo, args);
            continue;
        }
        if (['roulette', 'rt', 'ruleta'].includes(comando)) {
            await manejarRoulette(sock, msgInfo, args);
            continue;
        }
        if (['baltop', 'economyboard', 'eboard'].includes(comando)) {
            await manejarBaltop(sock, msgInfo, args);
            continue;
        }
        if (['economyinfo', 'einfo'].includes(comando)) {
            await manejarEconomyInfo(sock, msgInfo);
            continue;
        }

        // --- SECCIÓN GACHA Y HAREM ---
        if (['roll', 'rw', 'rollwaifu', 'waifu'].includes(comando)) {
            await manejarRoll(sock, msgInfo);
            continue;
        }
        if (['claim', 'c', 'reclamar'].includes(comando)) {
            await manejarClaim(sock, msgInfo, args);
            continue;
        }
        if (['harem', 'waifus', 'claims', 'miswaifus'].includes(comando)) {
            await manejarHarem(sock, msgInfo, args);
            continue;
        }
        if (['charinfo', 'winfo', 'waifuinfo'].includes(comando)) {
            await manejarCharInfo(sock, msgInfo, args);
            continue;
        }
        if (['charimage', 'waifuimage', 'cimage', 'wimage'].includes(comando)) {
            await manejarCharImage(sock, msgInfo, args);
            continue;
        }
        if (['charvideo', 'waifuvideo', 'cvideo', 'wvideo'].includes(comando)) {
            await manejarCharVideo(sock, msgInfo, args);
            continue;
        }
        if (['givechar', 'givewaifu', 'regalar'].includes(comando)) {
            await manejarGiveChar(sock, msgInfo, args);
            continue;
        }
        if (['giveallharem'].includes(comando)) {
            await manejarGiveAllHarem(sock, msgInfo, args);
            continue;
        }
        if (['deletewaifu', 'delwaifu', 'delchar'].includes(comando)) {
            await manejarDeleteWaifu(sock, msgInfo, args);
            continue;
        }
        if (['sell', 'vender'].includes(comando)) {
            await manejarSell(sock, msgInfo, args);
            continue;
        }
        if (['buycharacter', 'buychar', 'buyc', 'comprar'].includes(comando)) {
            await manejarBuyChar(sock, msgInfo, args);
            continue;
        }
        if (['haremshop', 'tiendawaifus', 'wshop', 'tienda'].includes(comando)) {
            await manejarHaremShop(sock, msgInfo, args);
            continue;
        }
        if (['removesale', 'removerventa'].includes(comando)) {
            await manejarRemoveSale(sock, msgInfo, args);
            continue;
        }
        if (['topwaifus', 'waifusboard', 'wtop', 'topglobal', 'chartop', 'waifustop'].includes(comando)) {
            await manejarWaifusTop(sock, msgInfo, args);
            continue;
        }
        if (['vote', 'votar'].includes(comando)) {
            await manejarVote(sock, msgInfo, args);
            continue;
        }
        if (['setclaimmsg', 'setclaim'].includes(comando)) {
            await manejarSetClaimMsg(sock, msgInfo, args);
            continue;
        }
        if (['delclaimmsg'].includes(comando)) {
            await manejarDelClaimMsg(sock, msgInfo);
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
