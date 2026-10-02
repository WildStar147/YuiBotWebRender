import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { obtenerRutaFfmpeg } from './binarios.js';

const execFileAsync = promisify(execFile);

// Resolver dinámicamente la fuente disponible para memes
function obtenerRutaFuenteMeme() {
    const candidatas = [
        process.env.MEME_FONT_PATH,
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/noto/NotoSans-Bold.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
        '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/DejaVuSans-Bold.ttf'
    ];
    for (const c of candidatas) {
        if (c && fs.existsSync(c)) return c;
    }
    return '';
}

/**
 * Descarga el contenido multimedia desde Baileys a un Buffer
 * @param {object} mediaMessage - Objeto del mensaje multimedia (imageMessage, videoMessage, audioMessage, etc.)
 * @param {'image' | 'video' | 'sticker' | 'audio'} tipo - Tipo de archivo multimedia
 * @returns {Promise<Buffer>}
 */
async function descargarMedia(mediaMessage, tipo) {
    const stream = await downloadContentFromMessage(mediaMessage, tipo);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

/**
 * Genera nombres de archivos temporales únicos y seguros
 * @param {string} extension 
 * @returns {string}
 */
function generarRutaTemporal(extension) {
    const random = Math.random().toString(36).substring(2, 9);
    return path.join(os.tmpdir(), `yui_media_${Date.now()}_${random}.${extension}`);
}

/**
 * Escapa caracteres para el filtro drawtext de FFmpeg
 * @param {string} texto 
 * @returns {string}
 */
function escaparDrawtext(texto) {
    if (!texto) return '';
    return texto
        .replace(/\\/g, '\\\\\\\\')
        .replace(/'/g, "\\'")
        .replace(/:/g, '\\:')
        .trim();
}

/**
 * Convierte un buffer de imagen a sticker WebP (512x512 con pad transparente)
 */
async function convertirImagenASticker(bufferImagen) {
    const rutaEntrada = generarRutaTemporal('jpg');
    const rutaSalida = generarRutaTemporal('webp');

    try {
        fs.writeFileSync(rutaEntrada, bufferImagen);

        const binFfmpeg = await obtenerRutaFfmpeg();
        const filtro = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000';
        await execFileAsync(binFfmpeg, [
            '-y',
            '-i', rutaEntrada,
            '-vf', filtro,
            rutaSalida
        ]);

        return fs.readFileSync(rutaSalida);
    } finally {
        if (fs.existsSync(rutaEntrada)) fs.unlinkSync(rutaEntrada);
        if (fs.existsSync(rutaSalida)) fs.unlinkSync(rutaSalida);
    }
}

/**
 * Convierte un buffer de video o gif a sticker animado WebP
 */
async function convertirVideoASticker(bufferVideo) {
    const rutaEntrada = generarRutaTemporal('mp4');
    const rutaSalida = generarRutaTemporal('webp');

    try {
        fs.writeFileSync(rutaEntrada, bufferVideo);

        const binFfmpeg = await obtenerRutaFfmpeg();
        const filtro = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=12';
        await execFileAsync(binFfmpeg, [
            '-y',
            '-i', rutaEntrada,
            '-ss', '00:00:00',
            '-t', '00:00:07',
            '-vf', filtro,
            '-loop', '0',
            '-an',
            rutaSalida
        ]);

        return fs.readFileSync(rutaSalida);
    } finally {
        if (fs.existsSync(rutaEntrada)) fs.unlinkSync(rutaEntrada);
        if (fs.existsSync(rutaSalida)) fs.unlinkSync(rutaSalida);
    }
}

/**
 * Convierte un sticker WebP a imagen PNG estándar
 */
async function convertirStickerAImagen(bufferSticker) {
    try {
        return await sharp(bufferSticker).png().toBuffer();
    } catch (_) {
        const rutaEntrada = generarRutaTemporal('webp');
        const rutaSalida = generarRutaTemporal('png');

        try {
            fs.writeFileSync(rutaEntrada, bufferSticker);

            const binFfmpeg = await obtenerRutaFfmpeg();
            await execFileAsync(binFfmpeg, [
                '-y',
                '-i', rutaEntrada,
                rutaSalida
            ]);

            return fs.readFileSync(rutaSalida);
        } finally {
            if (fs.existsSync(rutaEntrada)) fs.unlinkSync(rutaEntrada);
            if (fs.existsSync(rutaSalida)) fs.unlinkSync(rutaSalida);
        }
    }
}

/**
 * Convierte un sticker WebP animado o video a GIF animado de WhatsApp
 */
async function convertirStickerAGif(bufferWebp) {
    const rutaSalida = generarRutaTemporal('mp4');
    let rutaEntrada = null;
    let rutaGifIntermedio = null;

    try {
        const binFfmpeg = await obtenerRutaFfmpeg();

        // 1. Intentar decodificar el WebP animado con sharp (soporta chunks ANIM y ANMF nativamente)
        try {
            const gifBuffer = await sharp(bufferWebp, { animated: true }).gif().toBuffer();
            rutaGifIntermedio = generarRutaTemporal('gif');
            fs.writeFileSync(rutaGifIntermedio, gifBuffer);
            rutaEntrada = rutaGifIntermedio;
        } catch (errSharp) {
            console.warn('⚠️ sharp no pudo procesar animación directa, usando archivo directo:', errSharp.message);
            rutaEntrada = generarRutaTemporal('webp');
            fs.writeFileSync(rutaEntrada, bufferWebp);
        }

        // 2. Convertir a MP4 compatible con reproducción de GIF en WhatsApp
        await execFileAsync(binFfmpeg, [
            '-y',
            '-i', rutaEntrada,
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            rutaSalida
        ]);

        return fs.readFileSync(rutaSalida);
    } finally {
        if (rutaEntrada && fs.existsSync(rutaEntrada)) fs.unlinkSync(rutaEntrada);
        if (rutaGifIntermedio && fs.existsSync(rutaGifIntermedio)) fs.unlinkSync(rutaGifIntermedio);
        if (fs.existsSync(rutaSalida)) fs.unlinkSync(rutaSalida);
    }
}

/**
 * Aplica un filtro de audio con FFmpeg
 */
async function aplicarFiltroAudio(bufferAudio, filtroFfmpeg) {
    const rutaEntrada = generarRutaTemporal('bin');
    const rutaSalida = generarRutaTemporal('ogg');

    try {
        fs.writeFileSync(rutaEntrada, bufferAudio);

        const binFfmpeg = await obtenerRutaFfmpeg();
        await execFileAsync(binFfmpeg, [
            '-y',
            '-i', rutaEntrada,
            '-af', filtroFfmpeg,
            '-c:a', 'libopus',
            '-b:a', '64k',
            '-vbr', 'on',
            '-vn',
            rutaSalida
        ]);

        return fs.readFileSync(rutaSalida);
    } finally {
        if (fs.existsSync(rutaEntrada)) fs.unlinkSync(rutaEntrada);
        if (fs.existsSync(rutaSalida)) fs.unlinkSync(rutaSalida);
    }
}

/**
 * Superpone texto superior e inferior estilo meme sobre una imagen
 * Se ajusta dinámicamente a la resolución de la foto y divide el texto en renglones
 * para evitar que las letras salgan muy pequeñas o se corten fuera de la imagen.
 */
async function generarMemeConTexto(bufferImagen, textoArriba, textoAbajo) {
    const rutaEntrada = generarRutaTemporal('jpg');
    const rutaSalida = generarRutaTemporal('jpg');
    const rutaTxtArriba = generarRutaTemporal('txt');
    const rutaTxtAbajo = generarRutaTemporal('txt');

    try {
        // 1. Obtener dimensiones de la imagen y normalizar si es gigante (previene OOM en Render)
        let bufferProcesado = bufferImagen;
        const meta = await sharp(bufferImagen).metadata();
        const anchoOriginal = meta.width || 800;
        const altoOriginal = meta.height || 600;

        if (anchoOriginal > 1200 || altoOriginal > 1200) {
            bufferProcesado = await sharp(bufferImagen)
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer();
        }

        fs.writeFileSync(rutaEntrada, bufferProcesado);

        const metaFinal = await sharp(bufferProcesado).metadata();
        const w = metaFinal.width || 800;
        const h = metaFinal.height || 600;

        // Función para envolver texto automáticamente en renglones
        const envolverTexto = (texto, maxChars = 22) => {
            if (!texto) return [];
            const palabras = texto.trim().split(/\s+/);
            const lineas = [];
            let lineaActual = '';
            for (const p of palabras) {
                if ((lineaActual + ' ' + p).trim().length <= maxChars) {
                    lineaActual = (lineaActual + ' ' + p).trim();
                } else {
                    if (lineaActual) lineas.push(lineaActual);
                    lineaActual = p;
                }
            }
            if (lineaActual) lineas.push(lineaActual);
            return lineas;
        };

        const rutaFuente = obtenerRutaFuenteMeme();
        const fontParam = rutaFuente ? `fontfile='${rutaFuente}':` : '';
        const filtros = [];

        // Tamaño de fuente base proporcional al ancho de la imagen
        const baseFontSize = Math.max(26, Math.min(75, Math.round(w / 18)));
        const maxCaracteres = Math.max(16, Math.round(w / 40));

        if (textoArriba) {
            const lineasArriba = envolverTexto(textoArriba.toUpperCase(), maxCaracteres);
            fs.writeFileSync(rutaTxtArriba, lineasArriba.join('\n'), 'utf-8');

            const factorReduccion = lineasArriba.length > 2 ? 0.75 : 1;
            const fontArriba = Math.max(20, Math.round(baseFontSize * factorReduccion));
            const borderArriba = Math.max(3, Math.round(fontArriba / 9));
            const posY = Math.max(15, Math.round(h * 0.03));

            filtros.push(
                `drawtext=${fontParam}textfile='${rutaTxtArriba}':fontcolor=white:bordercolor=black:borderw=${borderArriba}:fontsize=${fontArriba}:x=(w-text_w)/2:y=${posY}:line_spacing=6`
            );
        }

        if (textoAbajo) {
            const lineasAbajo = envolverTexto(textoAbajo.toUpperCase(), maxCaracteres);
            fs.writeFileSync(rutaTxtAbajo, lineasAbajo.join('\n'), 'utf-8');

            const factorReduccion = lineasAbajo.length > 2 ? 0.75 : 1;
            const fontAbajo = Math.max(20, Math.round(baseFontSize * factorReduccion));
            const borderAbajo = Math.max(3, Math.round(fontAbajo / 9));
            const marginInferior = Math.max(15, Math.round(h * 0.03));

            filtros.push(
                `drawtext=${fontParam}textfile='${rutaTxtAbajo}':fontcolor=white:bordercolor=black:borderw=${borderAbajo}:fontsize=${fontAbajo}:x=(w-text_w)/2:y=h-text_h-${marginInferior}:line_spacing=6`
            );
        }

        const binFfmpeg = await obtenerRutaFfmpeg();
        await execFileAsync(binFfmpeg, [
            '-y',
            '-i', rutaEntrada,
            '-vf', filtros.join(','),
            rutaSalida
        ]);

        return fs.readFileSync(rutaSalida);
    } finally {
        if (fs.existsSync(rutaEntrada)) fs.unlinkSync(rutaEntrada);
        if (fs.existsSync(rutaSalida)) fs.unlinkSync(rutaSalida);
        if (fs.existsSync(rutaTxtArriba)) fs.unlinkSync(rutaTxtArriba);
        if (fs.existsSync(rutaTxtAbajo)) fs.unlinkSync(rutaTxtAbajo);
    }
}

/**
 * Extrae el objeto multimedia de un mensaje citado o directo
 */
function extraerMediaYTipo(msg) {
    const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted || msg;

    const unwrapped = target?.viewOnceMessage?.message ||
                      target?.viewOnceMessageV2?.message ||
                      target?.viewOnceMessageV2Extension?.message ||
                      target;

    if (unwrapped?.imageMessage) {
        return { media: unwrapped.imageMessage, tipo: 'image', caption: unwrapped.imageMessage.caption };
    }
    if (unwrapped?.videoMessage) {
        return { media: unwrapped.videoMessage, tipo: 'video', caption: unwrapped.videoMessage.caption };
    }
    if (unwrapped?.stickerMessage) {
        return { media: unwrapped.stickerMessage, tipo: 'sticker' };
    }
    if (unwrapped?.audioMessage) {
        return { media: unwrapped.audioMessage, tipo: 'audio' };
    }

    return null;
}

/**
 * Maneja los comandos de creación de stickers: -s o -sticker
 */
export async function manejarCrearSticker(sock, msgInfo) {
    const { m, from } = msgInfo;
    const info = extraerMediaYTipo(m.message);

    if (!info || (info.tipo !== 'image' && info.tipo !== 'video')) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para crear un sticker:\n` +
                  `• Envía una *foto* o *video/gif* con el texto *-s* o *-sticker*\n` +
                  `• O responde/cita una foto o video con el comando *-s* 🍰✨`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const buffer = await descargarMedia(info.media, info.tipo);
        let bufferSticker;

        if (info.tipo === 'image') {
            bufferSticker = await convertirImagenASticker(buffer);
        } else {
            bufferSticker = await convertirVideoASticker(buffer);
        }

        await sock.sendMessage(from, { sticker: bufferSticker }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al crear sticker:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al intentar crear el sticker. Asegúrate de que el video o gif no sea demasiado largo. 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja los comandos de conversión de sticker a imagen: -img o -imagen
 */
export async function manejarStickerAImagen(sock, msgInfo) {
    const { m, from } = msgInfo;
    const info = extraerMediaYTipo(m.message);

    if (!info || info.tipo !== 'sticker') {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Ehehe~! Para convertir un sticker a imagen, debes responder/citar a un *sticker* con el comando *-img* o *-imagen*. 🍰🖼️`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const bufferSticker = await descargarMedia(info.media, 'sticker');
        const bufferPng = await convertirStickerAImagen(bufferSticker);

        await sock.sendMessage(from, {
            image: bufferPng,
            caption: `🖼️ *¡Aquí tienes tu imagen convertida!* (≧∇≦)/ 🍰✨`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al convertir sticker a imagen:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! No pude convertir ese sticker en imagen... ¡Intenta con otro! 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja la conversión de sticker animado o video a GIF: -gif
 */
export async function manejarStickerAGif(sock, msgInfo) {
    const { m, from } = msgInfo;
    const info = extraerMediaYTipo(m.message);

    if (!info || (info.tipo !== 'sticker' && info.tipo !== 'video')) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para convertir un sticker o video a GIF:\n` +
                  `• Responde/cita a un *sticker animado* o *video* con el comando *-gif* 🎞️🍰`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const buffer = await descargarMedia(info.media, info.tipo);
        const bufferGif = await convertirStickerAGif(buffer);

        await sock.sendMessage(from, {
            video: bufferGif,
            gifPlayback: true,
            caption: `🎞️ *¡Aquí tienes tu GIF animado!* (≧∇≦)/ ✨`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al convertir a GIF:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! No pude convertir ese sticker a GIF... ¡Intenta con otro! 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja el comando para revelar mensajes de ver una sola vez: -reveal
 */
export async function manejarReveal(sock, msgInfo) {
    const { m, from } = msgInfo;
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para revelar un mensaje de "ver una sola vez", debes *citar/responder* a la foto o video con el comando *-reveal*. 🔓🍰`
        }, { quoted: m });
    }

    const viewOnce = quoted.viewOnceMessage?.message ||
                     quoted.viewOnceMessageV2?.message ||
                     quoted.viewOnceMessageV2Extension?.message ||
                     quoted;

    let mediaObj = null;
    let tipo = null;
    let captionOriginal = '';

    if (viewOnce.imageMessage) {
        mediaObj = viewOnce.imageMessage;
        tipo = 'image';
        captionOriginal = mediaObj.caption || '';
    } else if (viewOnce.videoMessage) {
        mediaObj = viewOnce.videoMessage;
        tipo = 'video';
        captionOriginal = mediaObj.caption || '';
    }

    if (!mediaObj) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? El mensaje citado no contiene una imagen o video de "ver una sola vez". ¡Asegúrate de citar el mensaje correcto! 🌸`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '🔓', key: m.key } });

        const buffer = await descargarMedia(mediaObj, tipo);
        const pieDeFoto = `🔓 *¡Mensaje de ver una sola vez revelado!* (≧∇≦)/ ✨\n` +
                          `${captionOriginal ? `📝 *Texto original:* ${captionOriginal}\n` : ''}` +
                          `_¡Cortesía de Yui Bot! 🍰🎸_`;

        if (tipo === 'image') {
            await sock.sendMessage(from, { image: buffer, caption: pieDeFoto }, { quoted: m });
        } else {
            await sock.sendMessage(from, { video: buffer, caption: pieDeFoto }, { quoted: m });
        }
    } catch (error) {
        console.error('Error al revelar mensaje view-once:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! No pude descargar el archivo de ver una sola vez. Puede que ya haya expirado en los servidores de WhatsApp. 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja los filtros divertidos de audio (ardilla, grave, robot, eco, reversa, rapido)
 */
export async function manejarFiltroAudio(sock, msgInfo, efecto) {
    const { m, from } = msgInfo;
    const info = extraerMediaYTipo(m.message);

    if (!info || info.tipo !== 'audio') {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para usar este filtro, debes responder/citar a un *audio* o *nota de voz* con *-${efecto}*. 🎙️✨`
        }, { quoted: m });
    }

    // Mapa de filtros FFmpeg
    const FILTROS = {
        ardilla: 'asetrate=44100*1.4,aresample=44100',
        grave: 'asetrate=44100*0.75,aresample=44100',
        robot: 'tremolo=f=30:d=0.8',
        eco: 'aecho=0.8:0.88:60:0.4',
        reversa: 'areverse',
        rapido: 'atempo=1.5',
        lento: 'atempo=0.75'
    };

    const filtroFfmpeg = FILTROS[efecto];
    if (!filtroFfmpeg) return;

    try {
        await sock.sendMessage(from, { react: { text: '🎛️', key: m.key } });

        const bufferOriginal = await descargarMedia(info.media, 'audio');
        const bufferModificado = await aplicarFiltroAudio(bufferOriginal, filtroFfmpeg);

        await sock.sendMessage(from, {
            audio: bufferModificado,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error(`Error al aplicar filtro de audio ${efecto}:`, error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al procesar el audio con el filtro *${efecto}*. 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja la creación de stickers estilo álbum "brat" (fondo blanco, texto negro borroso alineado a la izquierda): -brat [texto]
 */
export async function manejarBrat(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const texto = args.join(' ').trim();

    if (!texto) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para crear un sticker estilo *brat* escribe tu texto.\n` +
                  `👉 *Ejemplo:* *-brat yui hirasawa* 🤍✨\n` +
                  `👉 *Ejemplo:* *-brat tea and cakes* 🤍🍰`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        // Función para escapar caracteres reservados XML/SVG
        const escapeXml = (unsafe) => {
            return unsafe.replace(/[<>&'"]/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '\'': return '&apos;';
                    case '"': return '&quot;';
                }
            });
        };

        const W = 512;
        const H = 512;
        const marginX = 26; // margen fino a la izquierda
        const maxW = W - (marginX * 2); // 460px
        const marginY = 28;
        const maxH = H - (marginY * 2); // 456px

        const palabras = texto.trim().toLowerCase().split(/\s+/);
        let mejor = null;
        let mejorArea = 0;

        const maxLineasPosibles = Math.min(palabras.length, 8);

        for (let numL = 1; numL <= maxLineasPosibles; numL++) {
            const lineas = [];
            let cur = '';
            for (let i = 0; i < palabras.length; i++) {
                const w = palabras[i];
                const restantesPalabras = palabras.length - i;
                const restantesLineas = numL - lineas.length;

                if (lineas.length < numL - 1 && restantesPalabras <= restantesLineas) {
                    if (cur) lineas.push(cur);
                    cur = w;
                } else if (!cur) {
                    cur = w;
                } else if ((cur + ' ' + w).length <= Math.ceil(texto.length / numL) + 2) {
                    cur += ' ' + w;
                } else {
                    lineas.push(cur);
                    cur = w;
                }
            }
            if (cur) lineas.push(cur);

            const realNumL = lineas.length;
            const maxChars = Math.max(...lineas.map(l => l.length));

            const fontPorAncho = Math.floor(maxW / (maxChars * 0.54));
            const fontPorAlto = Math.floor(maxH / (realNumL * 1.05));
            const font = Math.min(fontPorAncho, fontPorAlto);

            const anchoOcupado = maxChars * 0.54 * font;
            const altoOcupado = realNumL * 1.05 * font;
            const area = anchoOcupado * altoOcupado;

            if (!mejor || area > mejorArea) {
                mejorArea = area;
                mejor = { lineas, font, numL: realNumL, maxChars };
            }
        }

        const { lineas, font, numL } = mejor;
        const fontSize = Math.max(28, Math.min(230, font));
        const lineHeight = Math.round(fontSize * 1.05);
        const totalH = (numL - 1) * lineHeight + fontSize;
        const startY = Math.round((H - totalH) / 2 + fontSize * 0.85);

        const tspans = lineas.map((l, i) =>
            `<tspan x="${marginX}" y="${Math.round(startY + (i * lineHeight))}">${escapeXml(l)}</tspan>`
        ).join('');

        const blurAmount = Math.max(2.0, Math.min(4.5, fontSize * 0.024)).toFixed(2);

        const svg = `
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="bratBlur" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="${blurAmount}" />
                </filter>
            </defs>
            <rect width="${W}" height="${H}" fill="#FFFFFF"/>
            <text x="${marginX}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}px" font-weight="400" fill="#000000" text-anchor="start" letter-spacing="-1.5px" filter="url(#bratBlur)">
                ${tspans}
            </text>
        </svg>
        `;

        const bufferSticker = await sharp(Buffer.from(svg))
            .webp({ quality: 90 })
            .toBuffer();

        await sock.sendMessage(from, { sticker: bufferSticker }, { quoted: m });
        await sock.sendMessage(from, { react: { text: '🤍', key: m.key } });
    } catch (error) {
        console.error('Error al generar sticker brat:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al crear el sticker brat. ¡Intenta de nuevo! 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja la creación de memes con texto: -meme [texto arriba] | [texto abajo]
 */
export async function manejarMeme(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const info = extraerMediaYTipo(m.message);

    if (!info || info.tipo !== 'image') {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para crear un meme:\n` +
                  `1. Envía o cita una *foto*.\n` +
                  `2. Escribe *-meme [texto arriba] | [texto abajo]*\n\n` +
                  `👉 *Ejemplo:* *-meme Cuando Yui ve pastel | Pero Mugi se lo comió* 🍰🤣`
        }, { quoted: m });
    }

    const textoCompleto = args.join(' ').trim();
    if (!textoCompleto) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Ehehe~! Debes escribir el texto de tu meme.\n` +
                  `👉 *Ejemplo:* *-meme Texto arriba | Texto abajo*`
        }, { quoted: m });
    }

    const partes = textoCompleto.split('|').map(s => s.trim());
    let textoArriba = '';
    let textoAbajo = '';

    if (partes.length >= 2) {
        textoArriba = partes[0];
        textoAbajo = partes.slice(1).join(' ');
    } else {
        textoAbajo = partes[0];
    }

    try {
        await sock.sendMessage(from, { react: { text: '🎨', key: m.key } });

        const bufferImagen = await descargarMedia(info.media, 'image');
        const bufferMeme = await generarMemeConTexto(bufferImagen, textoArriba, textoAbajo);

        await sock.sendMessage(from, {
            image: bufferMeme,
            caption: `🤣 *¡Meme creado!* (≧∇≦)/ 🍰✨\n_¡Hecho con Yui Bot!_`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al generar meme:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al crear el meme. ¡Inténtalo de nuevo! 🌸`
        }, { quoted: m });
    }
}
