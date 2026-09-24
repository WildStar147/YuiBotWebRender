import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import yts from 'yt-search';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta al binario de yt-dlp (busca en ./bin/yt-dlp o en el PATH del sistema)
const RUTA_BIN_LOCAL = path.join(__dirname, '..', 'bin', 'yt-dlp');
const RUTA_YTDLP = fs.existsSync(RUTA_BIN_LOCAL) ? RUTA_BIN_LOCAL : 'yt-dlp';

/**
 * Genera una ruta de archivo temporal segura
 * @param {string} extension 
 * @returns {string}
 */
function generarRutaTemporal(extension) {
    const random = Math.random().toString(36).substring(2, 9);
    return path.join(os.tmpdir(), `yui_dl_${Date.now()}_${random}.${extension}`);
}

/**
 * Descarga y extrae audio en formato MP3 desde YouTube o cualquier plataforma compatible
 * @param {string} url 
 * @returns {Promise<{ rutaArchivo: string, titulo: string, duracion: string, autor: string }>}
 */
async function descargarAudioYtDlp(url) {
    const plantillaSalida = path.join(os.tmpdir(), `yui_yt_audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const rutaMp3 = `${plantillaSalida}.mp3`;

    // Extraer título primero
    let titulo = 'Audio';
    try {
        const { stdout } = await execFileAsync(RUTA_YTDLP, ['--js-runtimes', 'node', '--print', '%(title)s', url]);
        titulo = stdout.trim() || 'Audio';
    } catch (_) {}

    await execFileAsync(RUTA_YTDLP, [
        '--js-runtimes', 'node',
        '-f', 'ba/b',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '-o', `${plantillaSalida}.%(ext)s`,
        url
    ]);

    if (!fs.existsSync(rutaMp3)) {
        throw new Error('No se generó el archivo de audio MP3.');
    }

    return { rutaArchivo: rutaMp3, titulo };
}

/**
 * Descarga video en formato MP4 (TikTok, YouTube, Instagram)
 * @param {string} url 
 * @returns {Promise<{ rutaArchivo: string, titulo: string }>}
 */
async function descargarVideoYtDlp(url) {
    const plantillaSalida = path.join(os.tmpdir(), `yui_dl_video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const rutaMp4 = `${plantillaSalida}.mp4`;

    let titulo = 'Video';
    try {
        const { stdout } = await execFileAsync(RUTA_YTDLP, ['--js-runtimes', 'node', '--print', '%(title)s', url]);
        titulo = stdout.trim() || 'Video';
    } catch (_) {}

    await execFileAsync(RUTA_YTDLP, [
        '--js-runtimes', 'node',
        '-f', 'b/bv*+ba',
        '--recode-video', 'mp4',
        '-o', `${plantillaSalida}.%(ext)s`,
        url
    ]);

    if (!fs.existsSync(rutaMp4)) {
        throw new Error('No se generó el archivo de video MP4.');
    }

    return { rutaArchivo: rutaMp4, titulo };
}

/**
 * Maneja el comando para descargar videos de TikTok: -tiktok o -tt
 */
export async function manejarTikTok(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const enlace = (args[0] || '').trim();

    if (!enlace || (!enlace.includes('tiktok.com') && !enlace.includes('douyin.com'))) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para descargar un video de TikTok debes proporcionar el enlace.\n` +
                  `👉 *Ejemplo:* *-tiktok https://vm.tiktok.com/xxxxxx* 🍰✨`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const { rutaArchivo, titulo } = await descargarVideoYtDlp(enlace);
        const bufferVideo = fs.readFileSync(rutaArchivo);
        fs.unlinkSync(rutaArchivo);

        await sock.sendMessage(from, {
            video: bufferVideo,
            caption: `🎬 *TikTok Descargado* (≧∇≦)/ ✨\n` +
                     `📌 *Título:* ${titulo}\n\n` +
                     `_¡Descargado con Yui Bot! 🍰🎸_`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al descargar TikTok:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! No pude descargar ese video de TikTok. Verifica que el enlace sea válido y público. 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja la descarga de audio de YouTube o búsqueda musical: -ytmp3 o -play
 */
export async function manejarYouTubeMP3(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const query = args.join(' ').trim();

    if (!query) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! ¿Qué canción quieres escuchar?\n` +
                  `👉 *Ejemplo por enlace:* *-ytmp3 https://youtube.com/watch?v=...*\n` +
                  `👉 *Ejemplo por nombre:* *-ytmp3 Fuwa Fuwa Time K-ON* 🎸✨`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '🔍', key: m.key } });

        let urlDescarga = query;
        let infoCancion = { title: 'Audio de YouTube', timestamp: 'Desconocida', author: { name: 'YouTube' } };

        // Si no es un enlace directo de YouTube, buscamos en YouTube
        if (!query.startsWith('http://') && !query.startsWith('https://')) {
            const resBusqueda = await yts(query);
            const video = resBusqueda?.videos?.[0];
            if (!video) {
                return await sock.sendMessage(from, {
                    text: `(•́ω•̀)? No encontré ninguna canción con el nombre: *${query}*. ¡Intenta con otras palabras! 🌸`
                }, { quoted: m });
            }
            urlDescarga = video.url;
            infoCancion = video;
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const { rutaArchivo, titulo } = await descargarAudioYtDlp(urlDescarga);
        const bufferMp3 = fs.readFileSync(rutaArchivo);
        fs.unlinkSync(rutaArchivo);

        // Enviar audio
        await sock.sendMessage(from, {
            audio: bufferMp3,
            mimetype: 'audio/mp4',
            fileName: `${titulo}.mp3`
        }, { quoted: m });

        await sock.sendMessage(from, {
            text: `🎵 *${infoCancion.title || titulo}*\n` +
                  `⏱️ *Duración:* ${infoCancion.timestamp || 'N/A'}\n` +
                  `👤 *Canal:* ${infoCancion.author?.name || 'YouTube'}\n\n` +
                  `_¡A disfrutar la música con Giita y Mugi-chan! 🎸🍰✨_`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al descargar YouTube MP3:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al intentar descargar el audio. Asegúrate de que el video no tenga restricción de edad ni sea excesivamente largo. 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja la descarga de video de YouTube: -ytmp4 o -video
 */
export async function manejarYouTubeMP4(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const query = args.join(' ').trim();

    if (!query) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! ¿Qué video quieres descargar?\n` +
                  `👉 *Ejemplo por enlace:* *-ytmp4 https://youtube.com/watch?v=...*\n` +
                  `👉 *Ejemplo por nombre:* *-ytmp4 trailer k-on* 🎬✨`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '🔍', key: m.key } });

        let urlDescarga = query;
        let infoVideo = { title: 'Video de YouTube', timestamp: 'Desconocida' };

        if (!query.startsWith('http://') && !query.startsWith('https://')) {
            const resBusqueda = await yts(query);
            const video = resBusqueda?.videos?.[0];
            if (!video) {
                return await sock.sendMessage(from, {
                    text: `(•́ω•̀)? No encontré ningún video para: *${query}*. 🌸`
                }, { quoted: m });
            }
            urlDescarga = video.url;
            infoVideo = video;
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const { rutaArchivo, titulo } = await descargarVideoYtDlp(urlDescarga);
        const bufferVideo = fs.readFileSync(rutaArchivo);
        fs.unlinkSync(rutaArchivo);

        await sock.sendMessage(from, {
            video: bufferVideo,
            caption: `🎬 *${infoVideo.title || titulo}*\n` +
                     `⏱️ *Duración:* ${infoVideo.timestamp || 'N/A'}\n\n` +
                     `_¡Descargado con Yui Bot! 🍰✨_`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al descargar YouTube MP4:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! No pude descargar el video. Verifica que no sea demasiado pesado o largo para WhatsApp. 🌸`
        }, { quoted: m });
    }
}

/**
 * Maneja la descarga de videos de Instagram: -ig o -instagram
 */
export async function manejarInstagram(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const enlace = (args[0] || '').trim();

    if (!enlace || !enlace.includes('instagram.com')) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! Para descargar de Instagram proporciona el enlace.\n` +
                  `👉 *Ejemplo:* *-ig https://www.instagram.com/reel/xxxxxx/* 🍰✨`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const { rutaArchivo, titulo } = await descargarVideoYtDlp(enlace);
        const bufferVideo = fs.readFileSync(rutaArchivo);
        fs.unlinkSync(rutaArchivo);

        await sock.sendMessage(from, {
            video: bufferVideo,
            caption: `📸 *Instagram Reel/Video Descargado* (≧∇≦)/ ✨\n\n` +
                     `_¡Cortesía de Yui Bot! 🍰_`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('Error al descargar de Instagram:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! No pude descargar ese video de Instagram. Asegúrate de que sea un post o reel público. 🌸`
        }, { quoted: m });
    }
}
