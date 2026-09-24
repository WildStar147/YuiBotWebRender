import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas de persistencia (soporta SESSION_DIR si se monta un disco persistente)
const CARPETA_SESION = process.env.SESSION_DIR || path.join(__dirname, '..', 'sesion_auth');
const RUTA_MEMORIA = path.join(CARPETA_SESION, 'memoria_yui.json');
const RUTA_MEMORIA_GRUPOS = path.join(CARPETA_SESION, 'memoria_grupos.json');

// Límite máximo de mensajes guardados por usuario
const MAX_MENSAJES_HISTORIAL = 16;

/**
 * Estructuras en memoria
 */
let cacheMemoria = new Map();
let cacheGrupos = new Map(); // Map<grupoId, Object<usuarioId, { nombre: string, conteo: number, ultimaVez: number }>>

/**
 * Carga la memoria guardada en disco al iniciar
 */
function cargarMemoriaDesdeDisco() {
    try {
        if (fs.existsSync(RUTA_MEMORIA)) {
            const data = fs.readFileSync(RUTA_MEMORIA, 'utf-8');
            const parsed = JSON.parse(data);
            cacheMemoria = new Map(Object.entries(parsed));
        }
    } catch (err) {
        console.warn('⚠️ No se pudo cargar la memoria de usuarios:', err.message);
        cacheMemoria = new Map();
    }

    try {
        if (fs.existsSync(RUTA_MEMORIA_GRUPOS)) {
            const data = fs.readFileSync(RUTA_MEMORIA_GRUPOS, 'utf-8');
            const parsed = JSON.parse(data);
            cacheGrupos = new Map(Object.entries(parsed));
        }
    } catch (err) {
        console.warn('⚠️ No se pudo cargar la memoria de grupos:', err.message);
        cacheGrupos = new Map();
    }
}

/**
 * Guarda la memoria de usuarios en disco
 */
function guardarMemoriaEnDisco() {
    try {
        const obj = Object.fromEntries(cacheMemoria);
        const dir = path.dirname(RUTA_MEMORIA);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RUTA_MEMORIA, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
        console.error('❌ Error al persistir la memoria de Yui:', err.message);
    }
}

/**
 * Guarda la memoria de grupos en disco
 */
function guardarMemoriaGruposEnDisco() {
    try {
        const obj = Object.fromEntries(cacheGrupos);
        const dir = path.dirname(RUTA_MEMORIA_GRUPOS);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RUTA_MEMORIA_GRUPOS, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
        console.error('❌ Error al persistir la memoria de grupos:', err.message);
    }
}

// Cargar memoria al importar el módulo
cargarMemoriaDesdeDisco();

/**
 * Obtiene el historial de mensajes de un usuario o chat
 * @param {string} usuarioId 
 * @returns {Array<{role: string, content: string}>}
 */
export function obtenerHistorial(usuarioId) {
    if (!cacheMemoria.has(usuarioId)) {
        return [];
    }
    return cacheMemoria.get(usuarioId) || [];
}

/**
 * Agrega un mensaje al historial de un usuario
 * @param {string} usuarioId 
 * @param {'user' | 'assistant'} role 
 * @param {string} content 
 */
export function agregarMensaje(usuarioId, role, content) {
    if (!usuarioId || !content) return;

    let historial = cacheMemoria.get(usuarioId) || [];
    historial.push({
        role,
        content: content.trim(),
        timestamp: Date.now()
    });

    if (historial.length > MAX_MENSAJES_HISTORIAL) {
        historial = historial.slice(historial.length - MAX_MENSAJES_HISTORIAL);
    }

    cacheMemoria.set(usuarioId, historial);
    guardarMemoriaEnDisco();
}

/**
 * Borra la memoria de un usuario específico
 * @param {string} usuarioId 
 */
export function limpiarHistorial(usuarioId) {
    if (cacheMemoria.has(usuarioId)) {
        cacheMemoria.delete(usuarioId);
        guardarMemoriaEnDisco();
        return true;
    }
    return false;
}

/**
 * Registra que un usuario interactuó en un grupo de WhatsApp
 * @param {string} grupoId - JID del grupo (ej: xxxx@g.us)
 * @param {string} usuarioId - JID del participante
 * @param {string} pushName - Nombre visible en WhatsApp
 */
export function registrarInteraccionGrupo(grupoId, usuarioId, pushName) {
    if (!grupoId || !usuarioId) return;

    let usuariosGrupo = cacheGrupos.get(grupoId) || {};
    const registroPrevio = usuariosGrupo[usuarioId] || { conteo: 0, nombre: pushName || 'Usuario' };

    usuariosGrupo[usuarioId] = {
        nombre: pushName || registroPrevio.nombre || 'Usuario',
        conteo: (registroPrevio.conteo || 0) + 1,
        ultimaVez: Date.now()
    };

    cacheGrupos.set(grupoId, usuariosGrupo);
    guardarMemoriaGruposEnDisco();
}

/**
 * Obtiene métricas reales de interacción de Yui en un grupo
 * @param {string} grupoId 
 * @returns {{ totalInteractuados: number, nombresInteractuados: string[] }}
 */
export function obtenerMetricasGrupo(grupoId) {
    if (!cacheGrupos.has(grupoId)) {
        return { totalInteractuados: 0, nombresInteractuados: [] };
    }

    const usuarios = cacheGrupos.get(grupoId) || {};
    const keys = Object.keys(usuarios);
    const nombres = keys.map(k => usuarios[k].nombre).filter(Boolean);

    return {
        totalInteractuados: keys.length,
        nombresInteractuados: nombres
    };
}
