import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CARPETA_BIN = path.join(__dirname, '..', 'bin');
const RUTA_YTDLP_LOCAL = path.join(CARPETA_BIN, 'yt-dlp');

let rutaFfmpegFinal = null;
let rutaYtDlpFinal = null;

/**
 * Obtiene la ruta al binario ejecutable de FFmpeg.
 * Si el sistema no lo tiene instalado, usa el binario estático multiplataforma de @ffmpeg-installer.
 */
export async function obtenerRutaFfmpeg() {
    if (rutaFfmpegFinal) return rutaFfmpegFinal;

    // 1. Probar si el sistema ya tiene ffmpeg disponible globalmente
    try {
        await execFileAsync('ffmpeg', ['-version']);
        rutaFfmpegFinal = 'ffmpeg';
        return 'ffmpeg';
    } catch (_) {}

    // 2. Usar el binario incluido de @ffmpeg-installer
    if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
        try {
            fs.chmodSync(ffmpegInstaller.path, 0o755);
            rutaFfmpegFinal = ffmpegInstaller.path;

            // Inyectar en PATH para que yt-dlp y otros procesos lo detecten automáticamente
            const dirFfmpeg = path.dirname(ffmpegInstaller.path);
            if (!process.env.PATH.includes(dirFfmpeg)) {
                process.env.PATH = `${dirFfmpeg}:${process.env.PATH}`;
            }

            return rutaFfmpegFinal;
        } catch (errChmod) {
            console.warn('⚠️ No se pudo aplicar chmod a ffmpeg-installer:', errChmod.message);
        }
    }

    return 'ffmpeg';
}

/**
 * Obtiene o descarga automáticamente el binario ejecutable de yt-dlp para Linux/Mac/Windows.
 */
export async function obtenerRutaYtDlp() {
    if (rutaYtDlpFinal && fs.existsSync(rutaYtDlpFinal)) return rutaYtDlpFinal;

    // 1. Probar si yt-dlp ya está en el PATH del sistema
    try {
        await execFileAsync('yt-dlp', ['--version']);
        rutaYtDlpFinal = 'yt-dlp';
        return 'yt-dlp';
    } catch (_) {}

    // 2. Verificar si ya existe en ./bin/yt-dlp
    if (!fs.existsSync(CARPETA_BIN)) {
        fs.mkdirSync(CARPETA_BIN, { recursive: true });
    }

    if (fs.existsSync(RUTA_YTDLP_LOCAL)) {
        try {
            fs.chmodSync(RUTA_YTDLP_LOCAL, 0o755);
            rutaYtDlpFinal = RUTA_YTDLP_LOCAL;
            return rutaYtDlpFinal;
        } catch (_) {}
    }

    // 3. Descargar automáticamente el binario standalone más reciente de yt-dlp
    console.log('⬇️ [Binarios] Descargando binario de yt-dlp para el servidor...');
    try {
        const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
        const respuesta = await fetch(url, { redirect: 'follow' });
        if (!respuesta.ok) {
            throw new Error(`Código HTTP ${respuesta.status} al descargar yt-dlp`);
        }
        const buffer = Buffer.from(await respuesta.arrayBuffer());
        fs.writeFileSync(RUTA_YTDLP_LOCAL, buffer);
        fs.chmodSync(RUTA_YTDLP_LOCAL, 0o755);
        console.log('✅ [Binarios] yt-dlp descargado y configurado exitosamente.');
        rutaYtDlpFinal = RUTA_YTDLP_LOCAL;
        return RUTA_YTDLP_LOCAL;
    } catch (errDescarga) {
        console.error('❌ Error al descargar yt-dlp automáticamente:', errDescarga.message);
        return 'yt-dlp'; // fallback
    }
}

/**
 * Inicializa y valida FFmpeg y yt-dlp al arrancar el bot
 */
export async function inicializarBinarios() {
    try {
        const ffmpeg = await obtenerRutaFfmpeg();
        console.log(`🎬 [Binarios] FFmpeg listo (${ffmpeg})`);
    } catch (errFfmpeg) {
        console.warn('⚠️ [Binarios] Advertencia FFmpeg:', errFfmpeg.message);
    }

    try {
        const ytdlp = await obtenerRutaYtDlp();
        console.log(`🎵 [Binarios] yt-dlp listo (${ytdlp})`);
    } catch (errYtdlp) {
        console.warn('⚠️ [Binarios] Advertencia yt-dlp:', errYtdlp.message);
    }
}
