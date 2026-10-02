import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import yts from 'yt-search';
import { Downloader as tiktokDownloader } from '@tobyg74/tiktok-api-dl';
import Instagram from 'cakkatrok-instagram-downloader';
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
 * Descarga un archivo directamente a disco mediante streaming (previene agotar los 512MB de RAM en Render)
 */
async function descargarUrlADisco(urlDescarga, rutaDestino) {
    const res = await fetch(urlDescarga, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar stream`);
    const fileStream = fs.createWriteStream(rutaDestino);
    await pipeline(Readable.fromWeb(res.body), fileStream);
    if (!fs.existsSync(rutaDestino) || fs.statSync(rutaDestino).size < 1000) {
        throw new Error('Archivo descargado inválido o vacío');
    }
    return rutaDestino;
}

/**
 * Descarga directa de TikTok sin marca de agua vía múltiples APIs rápidas (Bajo consumo de RAM y sin bloqueos de IP)
 * @param {string} url 
 * @returns {Promise<{ rutaArchivo: string, titulo: string }>}
 */
async function descargarTikTokDirecto(url) {
    const rutaTemp = generarRutaTemporal('mp4');

    // Método 1: @tobyg74/tiktok-api-dl (v3, v1, v2)
    for (const ver of ['v3', 'v1', 'v2']) {
        try {
            const res = await tiktokDownloader(url, { version: ver });
            if (res && res.status === 'success' && res.result) {
                const videoUrl = res.result.videoHD || res.result.videoSD || res.result.videoWatermark || res.result.video?.playAddr || res.result.play;
                const titulo = res.result.desc || res.result.title || 'Video de TikTok';
                if (videoUrl) {
                    await descargarUrlADisco(videoUrl, rutaTemp);
                    return { rutaArchivo: rutaTemp, titulo };
                }
            }
        } catch (_) {}
    }

    // Método 2: API de respaldo tioo
    try {
        const resTioo = await fetch('https://backend1.tioo.eu.org/ttdl?url=' + encodeURIComponent(url), {
            headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
            signal: AbortSignal.timeout(12000)
        });
        if (resTioo.ok) {
            const dataTioo = await resTioo.json();
            const videoUrl = dataTioo.video?.noWatermark || dataTioo.video?.watermark || dataTioo.video;
            const titulo = dataTioo.title || 'Video de TikTok';
            if (videoUrl && typeof videoUrl === 'string') {
                await descargarUrlADisco(videoUrl, rutaTemp);
                return { rutaArchivo: rutaTemp, titulo };
            }
        }
    } catch (_) {}

    // Método 3: tikwm con cabeceras modernas
    try {
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.data && (data.data.play || data.data.wmplay)) {
                const videoUrl = data.data.play || data.data.wmplay;
                const titulo = data.data.title || 'Video de TikTok';
                if (videoUrl) {
                    await descargarUrlADisco(videoUrl, rutaTemp);
                    return { rutaArchivo: rutaTemp, titulo };
                }
            }
        }
    } catch (_) {}

    if (fs.existsSync(rutaTemp)) fs.unlinkSync(rutaTemp);
    throw new Error('No se pudo obtener el enlace de TikTok mediante las APIs directas.');
}

/**
 * Obtiene la ruta a un archivo de cookies si está configurado en entorno, Secret Files de Render o localmente.
 * Permite configurar COOKIES o YOUTUBE_COOKIES en Render para bypass total de restricciones de YouTube e Instagram.
 * @returns {string|null}
 */
export function obtenerRutaCookies() {
    // 1. Revisar variables de entorno (COOKIES, YOUTUBE_COOKIES, COOKIE, YT_COOKIES, etc.)
    const cookieEnv = process.env.COOKIES || 
                      process.env.YOUTUBE_COOKIES || 
                      process.env.COOKIE || 
                      process.env.YT_COOKIES || 
                      process.env.INSTAGRAM_COOKIES || 
                      process.env.COOKIES_TXT || 
                      process.env.NETSCAPE_COOKIES;

    if (cookieEnv && cookieEnv.trim()) {
        try {
            const contenido = cookieEnv.trim();
            const ruta = path.join(os.tmpdir(), 'yui_cookies.txt');
            // Detectar base64 o texto directo Netscape
            if (contenido.startsWith('IyB') || (!contenido.includes('\t') && contenido.length > 50)) {
                fs.writeFileSync(ruta, Buffer.from(contenido, 'base64').toString('utf-8'));
            } else {
                fs.writeFileSync(ruta, contenido);
            }
            if (fs.existsSync(ruta) && fs.statSync(ruta).size > 10) {
                console.log(`🍪 [Cookies] Cargadas desde variable de entorno hacia: ${ruta} (${fs.statSync(ruta).size} bytes)`);
                return ruta;
            }
        } catch (e) {
            console.warn('⚠️ Error al procesar variable de entorno de cookies:', e.message);
        }
    }

    // 2. Revisar archivos en disco conocidos
    const posiblesRutas = [
        '/etc/secrets/cookies.txt',
        '/etc/secrets/cookies',
        '/etc/secrets/youtube_cookies.txt',
        '/etc/secrets/YOUTUBE_COOKIES',
        path.join(process.cwd(), 'cookies.txt'),
        path.join(__dirname, '..', 'cookies.txt'),
        path.join(os.tmpdir(), 'cookies.txt'),
        path.join(os.tmpdir(), 'yui_cookies.txt'),
        path.join(os.tmpdir(), 'yui_yt_cookies.txt')
    ];

    for (const r of posiblesRutas) {
        if (fs.existsSync(r)) {
            try {
                if (fs.statSync(r).size > 10) {
                    console.log(`🍪 [Cookies] Archivo encontrado en: ${r} (${fs.statSync(r).size} bytes)`);
                    return r;
                }
            } catch (_) {}
        }
    }

    // 3. Revisar cualquier archivo dentro de /etc/secrets/ (Secret Files de Render)
    if (fs.existsSync('/etc/secrets')) {
        try {
            const archivos = fs.readdirSync('/etc/secrets');
            for (const arch of archivos) {
                const rutaCompleta = path.join('/etc/secrets', arch);
                if (fs.statSync(rutaCompleta).isFile() && fs.statSync(rutaCompleta).size > 10) {
                    console.log(`🍪 [Cookies] Secret file detectado en /etc/secrets/: ${rutaCompleta} (${fs.statSync(rutaCompleta).size} bytes)`);
                    return rutaCompleta;
                }
            }
        } catch (e) {
            console.warn('⚠️ Error al escanear /etc/secrets:', e.message);
        }
    }

    return null;
}

/**
 * Descarga y extrae audio en formato MP3 usando yt-dlp y FFmpeg con estrategias de fallback
 * @param {string} url 
 * @returns {Promise<{ rutaArchivo: string, titulo: string }>}
 */
async function descargarAudioYtDlp(url) {
    const binYtdlp = await obtenerRutaYtDlp();
    const binFfmpeg = await obtenerRutaFfmpeg();

    const plantillaSalida = path.join(os.tmpdir(), `yui_yt_audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const rutaMp3 = `${plantillaSalida}.mp3`;

    const rutaCookies = obtenerRutaCookies();
    const esYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    // Definir estrategias de descarga
    const estrategias = [];

    // Estrategia 1: Con cookies (si están configuradas) y componentes remotos EJS
    if (rutaCookies) {
        estrategias.push({
            nombre: 'con-cookies',
            args: [
                '--no-playlist',
                '--cookies', rutaCookies,
                '--remote-components', 'ejs:github',
                '--js-runtimes', 'node'
            ]
        });
    }

    // Estrategia 2: Cliente Android (sin cookies) para YouTube
    if (esYouTube) {
        estrategias.push({
            nombre: 'android-client',
            args: [
                '--no-playlist',
                '--extractor-args', 'youtube:player_client=android',
                '--remote-components', 'ejs:github',
                '--js-runtimes', 'node'
            ]
        });
    }

    // Estrategia 3: Estándar por defecto
    estrategias.push({
        nombre: 'default',
        args: [
            '--no-playlist',
            '--remote-components', 'ejs:github',
            '--js-runtimes', 'node'
        ]
    });

    let ultimoError = null;

    for (const est of estrategias) {
        try {
            console.log(`🎵 Intentando descargar audio con estrategia: ${est.nombre}`);
            const argsComunes = [...est.args];
            if (binFfmpeg && binFfmpeg !== 'ffmpeg' && fs.existsSync(binFfmpeg)) {
                argsComunes.push('--ffmpeg-location', path.dirname(binFfmpeg));
            }

            // Extraer título primero de forma rápida
            let titulo = 'Audio';
            try {
                const { stdout } = await execFileAsync(binYtdlp, [
                    ...argsComunes,
                    '--print', '%(title)s',
                    url
                ]);
                titulo = stdout.trim() || 'Audio';
            } catch (_) {}

            await execFileAsync(binYtdlp, [
                ...argsComunes,
                '-f', 'ba/b',
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--max-filesize', '40M',
                '-o', `${plantillaSalida}.%(ext)s`,
                url
            ]);

            if (fs.existsSync(rutaMp3)) {
                console.log(`✅ Audio descargado exitosamente con estrategia: ${est.nombre}`);
                return { rutaArchivo: rutaMp3, titulo };
            }
        } catch (err) {
            console.warn(`⚠️ Estrategia ${est.nombre} falló al descargar audio:`, err.message);
            ultimoError = err;
        }
    }

    throw ultimoError || new Error('No se generó el archivo de audio MP3.');
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

    const rutaCookies = obtenerRutaCookies();
    const esYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    // Definir estrategias de descarga
    const estrategias = [];

    // Estrategia 1: Con cookies (si están configuradas)
    if (rutaCookies) {
        estrategias.push({
            nombre: 'con-cookies',
            args: [
                '--no-playlist',
                '--cookies', rutaCookies,
                '--remote-components', 'ejs:github',
                '--js-runtimes', 'node'
            ]
        });
    }

    // Estrategia 2: Cliente Android (sin cookies) para YouTube
    if (esYouTube) {
        estrategias.push({
            nombre: 'android-client',
            args: [
                '--no-playlist',
                '--extractor-args', 'youtube:player_client=android',
                '--remote-components', 'ejs:github',
                '--js-runtimes', 'node'
            ]
        });
    }

    // Estrategia 3: Estándar por defecto
    estrategias.push({
        nombre: 'default',
        args: [
            '--no-playlist',
            '--remote-components', 'ejs:github',
            '--js-runtimes', 'node'
        ]
    });

    let ultimoError = null;

    for (const est of estrategias) {
        try {
            console.log(`🎬 Intentando descargar video con estrategia: ${est.nombre}`);
            const argsComunes = [...est.args];
            if (binFfmpeg && binFfmpeg !== 'ffmpeg' && fs.existsSync(binFfmpeg)) {
                argsComunes.push('--ffmpeg-location', path.dirname(binFfmpeg));
            }

            let titulo = 'Video';
            try {
                const { stdout } = await execFileAsync(binYtdlp, [
                    ...argsComunes,
                    '--print', '%(title)s',
                    url
                ]);
                titulo = stdout.trim() || 'Video';
            } catch (_) {}

            await execFileAsync(binYtdlp, [
                ...argsComunes,
                '-f', 'bv*[height<=720]+ba/b[height<=720]/best',
                '--merge-output-format', 'mp4',
                '--max-filesize', '40M',
                '-o', `${plantillaSalida}.%(ext)s`,
                url
            ]);

            // Buscar cualquier archivo generado con la plantilla de salida
            const dirTmp = os.tmpdir();
            const basePlantilla = path.basename(plantillaSalida);
            const archivos = fs.readdirSync(dirTmp).filter(f => f.startsWith(basePlantilla));

            if (archivos.length > 0) {
                const archivoEncontrado = path.join(dirTmp, archivos[0]);
                if (archivoEncontrado.endsWith('.mp4')) {
                    console.log(`✅ Video descargado exitosamente con estrategia: ${est.nombre}`);
                    return { rutaArchivo: archivoEncontrado, titulo };
                }

                // Si terminó en otro contenedor (ej. mkv o webm), convertir a mp4 rápidamente sin recodificar
                try {
                    await execFileAsync(binFfmpeg, [
                        '-y',
                        '-i', archivoEncontrado,
                        '-c', 'copy',
                        rutaMp4
                    ]);
                    if (fs.existsSync(archivoEncontrado) && archivoEncontrado !== rutaMp4) {
                        fs.unlinkSync(archivoEncontrado);
                    }
                    if (fs.existsSync(rutaMp4)) {
                        console.log(`✅ Video remuxed a MP4 exitosamente con estrategia: ${est.nombre}`);
                        return { rutaArchivo: rutaMp4, titulo };
                    }
                } catch (_) {}
                return { rutaArchivo: archivoEncontrado, titulo };
            }
        } catch (err) {
            console.warn(`⚠️ Estrategia ${est.nombre} falló al descargar video:`, err.message);
            ultimoError = err;
        }
    }

    throw ultimoError || new Error('No se generó el archivo de video MP4.');
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

        let rutaVideoFinal = null;
        let tituloVideo = 'TikTok Video';

        try {
            const resDirecta = await descargarTikTokDirecto(enlace);
            rutaVideoFinal = resDirecta.rutaArchivo;
            tituloVideo = resDirecta.titulo;
        } catch (errDirecta) {
            console.warn('⚠️ Falló API directa de TikTok, intentando con yt-dlp:', errDirecta.message);
            const resYtdlp = await descargarVideoYtDlp(enlace);
            rutaVideoFinal = resYtdlp.rutaArchivo;
            tituloVideo = resYtdlp.titulo;
        }

        const bufferVideo = fs.readFileSync(rutaVideoFinal);
        if (fs.existsSync(rutaVideoFinal)) fs.unlinkSync(rutaVideoFinal);

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
        console.error('Error al descargar YouTube MP3:', error.stderr || error.stdout || error.message || error);
        const errStr = (error.stderr || error.stdout || error.message || '').toLowerCase();
        let msgError = `(╥﹏╥) ¡Uwaa~! Ocurrió un error al intentar descargar el audio. Asegúrate de que el video no tenga restricción de edad ni sea excesivamente largo. 🌸`;
        if (errStr.includes('429') || errStr.includes('bot') || errStr.includes('sign in')) {
            msgError = `(╥﹏╥) ¡Uwaa~! YouTube requiere verificación en el servidor de Render (Error 429 / Bot).\n\n` +
                       `💡 *Solución:* Agrega tu variable *COOKIES* en el panel de Render (Environment) para descargar cualquier canción o video sin restricciones. 🌸🎸`;
        }
        await sock.sendMessage(from, { text: msgError }, { quoted: m });
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
        console.error('❌ Error al descargar YouTube MP4:', error.stderr || error.stdout || error.message || error);
        const errStr = (error.stderr || error.stdout || error.message || '').toLowerCase();
        let msgError = `(╥﹏╥) ¡Uwaa~! No pude descargar el video. Verifica que no sea demasiado pesado o largo para WhatsApp. 🌸`;
        if (errStr.includes('429') || errStr.includes('bot') || errStr.includes('sign in')) {
            msgError = `(╥﹏╥) ¡Uwaa~! YouTube requiere verificación en el servidor de Render (Error 429 / Bot).\n\n` +
                       `💡 *Solución:* Agrega tu variable *COOKIES* en el panel de Render (Environment) para descargar cualquier video sin restricciones. 🌸🎬`;
        }
        await sock.sendMessage(from, { text: msgError }, { quoted: m });
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

        let bufferVideo = null;
        let tituloVideo = 'Instagram Video';
        let esFoto = false;

        // 1. Intentar primero con yt-dlp (si hay cookies o acceso público directo)
        try {
            const { rutaArchivo, titulo } = await descargarVideoYtDlp(enlace);
            bufferVideo = fs.readFileSync(rutaArchivo);
            tituloVideo = titulo;
            if (fs.existsSync(rutaArchivo)) fs.unlinkSync(rutaArchivo);
        } catch (errYtdlp) {
            console.warn('⚠️ yt-dlp falló para Instagram, probando scraper de respaldo:', errYtdlp.message);

            // 2. Intentar con cakkatrok-instagram-downloader
            try {
                const resIg = await Instagram(enlace);
                if (resIg && resIg.media && resIg.media.length > 0) {
                    const videoItem = resIg.media.find(item => item.type === 'video') || resIg.media[0];
                    if (videoItem && videoItem.url) {
                        const dlRes = await fetch(videoItem.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            signal: AbortSignal.timeout(15000)
                        });
                        if (dlRes.ok) {
                            bufferVideo = Buffer.from(await dlRes.arrayBuffer());
                            tituloVideo = videoItem.filename || 'Instagram Media';
                            esFoto = videoItem.type === 'photo';
                        }
                    }
                }
            } catch (errCak) {
                console.warn('⚠️ Falló scraper de Instagram:', errCak.message);
            }

            if (!bufferVideo) {
                throw errYtdlp;
            }
        }

        if (esFoto) {
            await sock.sendMessage(from, {
                image: bufferVideo,
                caption: `📸 *Foto de Instagram Descargada* (≧∇≦)/ ✨\n\n_¡Cortesía de Yui Bot! 🍰_`
            }, { quoted: m });
        } else {
            await sock.sendMessage(from, {
                video: bufferVideo,
                caption: `📸 *Instagram Reel/Video Descargado* (≧∇≦)/ ✨\n\n_¡Cortesía de Yui Bot! 🍰_`
            }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('❌ Error al descargar de Instagram:', error.stderr || error.stdout || error.message || error);

        const errStr = (error.stderr || error.stdout || error.message || '').toLowerCase();
        let mensajeError = `(╥﹏╥) ¡Uwaa~! No pude descargar ese video de Instagram. Asegúrate de que sea un post o reel público. 🌸`;

        if (errStr.includes('cookies') || errStr.includes('login') || errStr.includes('not granting access') || errStr.includes('empty media')) {
            mensajeError = `(╥﹏╥) ¡Uwaa~! Instagram bloqueó el acceso desde el servidor de Render.\n\n` +
                           `💡 *Para solucionarlo:* Agrega tus cookies en el panel de Render (Environment -> variable *COOKIES*) para permitir descargas directas de Instagram y YouTube sin bloqueos. 🌸`;
        }

        await sock.sendMessage(from, { text: mensajeError }, { quoted: m });
    }
}

/**
 * Busca imágenes en Pinterest a través de múltiples APIs de respaldo
 * @param {string} query 
 * @returns {Promise<Array<string>>}
 */
export async function buscarPinterest(query) {
    // 1. Intentar con api.dorratz.com
    try {
        const url = 'https://api.dorratz.com/v2/pinterest?q=' + encodeURIComponent(query);
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            const items = data.data?.results || [];
            const urls = items.map(i => i.image_large_url || i.image_medium_url).filter(Boolean);
            if (urls.length > 0) return urls;
        }
    } catch (err) {
        console.warn('⚠️ Error en proveedor 1 de Pinterest:', err.message);
    }

    // 2. Intentar con api.siputzx.my.id
    try {
        const url = 'https://api.siputzx.my.id/api/s/pinterest?query=' + encodeURIComponent(query);
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            const items = data.data || [];
            const urls = items.map(i => i.image_url).filter(Boolean);
            if (urls.length > 0) return urls;
        }
    } catch (err) {
        console.warn('⚠️ Error en proveedor 2 de Pinterest:', err.message);
    }

    return [];
}

/**
 * Maneja el comando para buscar y enviar imágenes de Pinterest: -pin o -pinterest
 * @param {object} sock - Instancia de Baileys
 * @param {object} msgInfo - Información del mensaje
 * @param {Array<string>} args - Argumentos de búsqueda
 */
export async function manejarPinterest(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const query = args.join(' ').trim();

    if (!query) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! ¿Qué imagen quieres buscar en Pinterest?\n` +
                  `👉 *Ejemplo:* *-pin Yui Hirasawa anime*\n` +
                  `👉 *Ejemplo:* *-pin fondos aesthetic* 📌✨`
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '🔍', key: m.key } });

        const resultados = await buscarPinterest(query);

        if (!resultados || resultados.length === 0) {
            return await sock.sendMessage(from, {
                text: `(╥﹏╥) ¡Uwaa~! No pude encontrar imágenes para "*${query}*" en Pinterest. Intenta con otras palabras. 🌸`
            }, { quoted: m });
        }

        // Seleccionar una imagen aleatoria entre las primeras encontradas para variar
        const seleccion = resultados[Math.floor(Math.random() * Math.min(resultados.length, 10))];

        await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const resImg = await fetch(seleccion, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
        });

        if (!resImg.ok) throw new Error(`HTTP ${resImg.status} al descargar imagen de Pinterest`);

        const bufferImg = Buffer.from(await resImg.arrayBuffer());

        await sock.sendMessage(from, {
            image: bufferImg,
            caption: `📌 *Pinterest:* _${query}_\n` +
                     `🍰 *¡Aquí tienes lo que encontré!* (≧∇≦)/ ✨\n\n` +
                     `_¡Buscado con Yui Bot! 🌸_`
        }, { quoted: m });

        await sock.sendMessage(from, { react: { text: '✨', key: m.key } });
    } catch (error) {
        console.error('❌ Error en comando Pinterest:', error);
        await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al buscar en Pinterest. Inténtalo de nuevo en unos momentos. 🌸`
        }, { quoted: m });
    }
}
