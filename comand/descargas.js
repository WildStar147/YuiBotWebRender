import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import yts from 'yt-search';
import { obtenerRutaFfmpeg, obtenerRutaYtDlp } from './binarios.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Descarga directa de TikTok sin marca de agua vía API rápida (Bajo consumo de RAM y sin bloqueos de IP)
 * @param {string} url 
 * @returns {Promise<{ buffer: Buffer, titulo: string }>}
 */
async function descargarTikTokDirecto(url) {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!res.ok) {
        throw new Error(`API de TikTok respondió con código ${res.status}`);
    }

    const data = await res.json();
    if (data && data.data && (data.data.play || data.data.wmplay)) {
        const videoUrl = data.data.play || data.data.wmplay;
        const titulo = data.data.title || 'Video de TikTok';
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error('Error al descargar el stream del video de TikTok');
        const arrayBuf = await videoRes.arrayBuffer();
        return { buffer: Buffer.from(arrayBuf), titulo };
    }

    throw new Error('No se encontró enlace de video en la respuesta de TikTok');
}

/**
 * Descarga y extrae audio en formato MP3 usando yt-dlp y FFmpeg
 * @param {string} url 
 * @returns {Promise<{ rutaArchivo: string, titulo: string }>}
 */
async function descargarAudioYtDlp(url) {
    const binYtdlp = await obtenerRutaYtDlp();
    const binFfmpeg = await obtenerRutaFfmpeg();

    const plantillaSalida = path.join(os.tmpdir(), `yui_yt_audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const rutaMp3 = `${plantillaSalida}.mp3`;

    // Extraer título primero de forma rápida
    let titulo = 'Audio';
    try {
        const { stdout } = await execFileAsync(binYtdlp, [
            '--no-playlist',
            '--print', '%(title)s',
            url
        ]);
        titulo = stdout.trim() || 'Audio';
    } catch (_) {}

    await execFileAsync(binYtdlp, [
        '--no-playlist',
        '--ffmpeg-location', binFfmpeg,
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '-f', 'ba/b',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--max-filesize', '50M',
        '-o', `${plantillaSalida}.%(ext)s`,
        url
    ]);

    if (!fs.existsSync(rutaMp3)) {
        throw new Error('No se generó el archivo de audio MP3.');
    }

    return { rutaArchivo: rutaMp3, titulo };
}

/**
 * Descarga video en formato MP4 (YouTube, Instagram, Facebook, etc.) optimizado para WhatsApp (máx 720p)
 * @param {string} url 
 * @returns {Promise<{ rutaArchivo: string, titulo: string }>}
 */
async function descargarVideoYtDlp(url) {
    const binYtdlp = await obtenerRutaYtDlp();
    const binFfmpeg = await obtenerRutaFfmpeg();

    const plantillaSalida = path.join(os.tmpdir(), `yui_dl_video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const rutaMp4 = `${plantillaSalida}.mp4`;

    let titulo = 'Video';
    try {
        const { stdout } = await execFileAsync(binYtdlp, [
            '--no-playlist',
            '--print', '%(title)s',
            url
        ]);
        titulo = stdout.trim() || 'Video';
    } catch (_) {}

    await execFileAsync(binYtdlp, [
        '--no-playlist',
        '--ffmpeg-location', binFfmpeg,
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '-f', 'bv*[height<=720]+ba/b[height<=720]/b',
        '--recode-video', 'mp4',
        '--max-filesize', '60M',
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

        // Intentar primero con la API directa sin marca de agua (ultra rápida y ligera para 512MB RAM)
        let bufferVideo = null;
        let tituloVideo = 'TikTok Video';

        try {
            const resDirecta = await descargarTikTokDirecto(enlace);
            bufferVideo = resDirecta.buffer;
            tituloVideo = resDirecta.titulo;
        } catch (errDirecta) {
            console.warn('⚠️ Falló API directa de TikTok, intentando con yt-dlp:', errDirecta.message);
            const { rutaArchivo, titulo } = await descargarVideoYtDlp(enlace);
            bufferVideo = fs.readFileSync(rutaArchivo);
            tituloVideo = titulo;
            if (fs.existsSync(rutaArchivo)) fs.unlinkSync(rutaArchivo);
        }

        await sock.sendMessage(from, {
            video: bufferVideo,
            caption: `🎬 *TikTok Descargado* (≧∇≦)/ ✨\n` +
                     `📌 *Título:* ${tituloVideo}\n\n` +
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
        if (fs.existsSync(rutaArchivo)) fs.unlinkSync(rutaArchivo);

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
        if (fs.existsSync(rutaArchivo)) fs.unlinkSync(rutaArchivo);

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
        if (fs.existsSync(rutaArchivo)) fs.unlinkSync(rutaArchivo);

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
