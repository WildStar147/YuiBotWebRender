import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUTA_WAIFUS_JSON = path.join(__dirname, 'datos', 'waifus.json');

let catalogo = [];

// Cargar catálogo inicial
try {
    if (fs.existsSync(RUTA_WAIFUS_JSON)) {
        const raw = fs.readFileSync(RUTA_WAIFUS_JSON, 'utf-8');
        catalogo = JSON.parse(raw);
    }
} catch (e) {
    console.error('Error cargando catalogo de waifus:', e);
}

/**
 * Obtiene una waifu aleatoria ponderada por rareza
 */
export function obtenerWaifuAleatoria() {
    if (!catalogo || catalogo.length === 0) return null;

    // Sistema de probabilidades según rareza:
    // Mítica: 3%, Legendaria: 8%, Épica: 20%, Rara: 34%, Común: 35%
    const rand = Math.random() * 100;
    let targetRarity = '';

    if (rand < 3) {
        targetRarity = 'Mítica 👑';
    } else if (rand < 11) {
        targetRarity = 'Legendaria 💎';
    } else if (rand < 31) {
        targetRarity = 'Épica 🥇';
    } else if (rand < 65) {
        targetRarity = 'Rara 🥈';
    } else {
        targetRarity = 'Común 🥉';
    }

    const filtrados = catalogo.filter(c => c.rareza === targetRarity);
    const pool = filtrados.length > 0 ? filtrados : catalogo;

    const seleccionada = pool[Math.floor(Math.random() * pool.length)];

    return {
        ...seleccionada,
        valor: seleccionada.valorBase || 200
    };
}

/**
 * Busca un personaje por su nombre (búsqueda flexible)
 */
export function buscarWaifuPorNombre(nombre) {
    if (!nombre || !catalogo) return null;
    const clean = nombre.trim().toLowerCase();

    // 1. Coincidencia exacta
    let encontrada = catalogo.find(w => w.nombre.toLowerCase() === clean);
    if (encontrada) return { ...encontrada, valor: encontrada.valorBase || 200 };

    // 2. Coincidencia por subcadena
    encontrada = catalogo.find(w => w.nombre.toLowerCase().includes(clean));
    if (encontrada) return { ...encontrada, valor: encontrada.valorBase || 200 };

    return null;
}

/**
 * Retorna todo el catálogo
 */
export function obtenerCatalogoCompleto() {
    return catalogo;
}

/**
 * Retorna la lista de animes presentes en el catálogo
 */
export function obtenerListaSeries() {
    const seriesSet = new Set(catalogo.map(c => c.anime).filter(Boolean));
    return Array.from(seriesSet).sort();
}
