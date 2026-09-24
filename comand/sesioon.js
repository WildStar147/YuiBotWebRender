import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta donde se guardarán las credenciales de la sesión de WhatsApp
// Permite usar discos persistentes de Render montados en otra ruta vía SESSION_DIR
const RUTA_SESION_DEFAULT = process.env.SESSION_DIR || path.join(__dirname, '..', 'sesion_auth');

/**
 * Inicializa y recupera el estado de autenticación multi-archivo de Baileys.
 * 
 * @param {string} rutaCarpeta - Ruta donde se guardarán los archivos de sesión
 * @returns {Promise<{state: object, saveCreds: Function}>}
 */
export async function obtenerEstadoSesion(rutaCarpeta = RUTA_SESION_DEFAULT) {
    if (!fs.existsSync(rutaCarpeta)) {
        fs.mkdirSync(rutaCarpeta, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(rutaCarpeta);
    return { state, saveCreds };
}

