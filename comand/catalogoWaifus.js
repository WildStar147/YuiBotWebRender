import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buscarPinterest } from './descargas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUTA_WAIFUS_JSON = path.join(__dirname, 'datos', 'waifus.json');

let catalogo = [];

// Cargar catálogo inicial desde el archivo local (más de 500 personajes base)
try {
    if (fs.existsSync(RUTA_WAIFUS_JSON)) {
        const raw = fs.readFileSync(RUTA_WAIFUS_JSON, 'utf-8');
        catalogo = JSON.parse(raw);
    }
} catch (e) {
    console.error('Error cargando catálogo base de waifus:', e);
}

/**
 * Asigna rareza y valor según la cantidad de favoritos en AniList
 */
function calcularRarezaYValor(favoritos = 0) {
    let rareza = 'Común 🥉';
    let valor = 150;
    let estrellas = '⭐';

    if (favoritos > 35000) {
        rareza = 'Mítica 👑';
        valor = 1200;
        estrellas = '⭐⭐⭐⭐⭐';
    } else if (favoritos > 20000) {
        rareza = 'Legendaria 💎';
        valor = 800;
        estrellas = '⭐⭐⭐⭐';
    } else if (favoritos > 9000) {
        rareza = 'Épica 🥇';
        valor = 500;
        estrellas = '⭐⭐⭐';
    } else if (favoritos > 3000) {
        rareza = 'Rara 🥈';
        valor = 300;
        estrellas = '⭐⭐';
    }

    return { rareza, valor, estrellas };
}

/**
 * Consulta en vivo a la API global de AniList para obtener un personaje aleatorio
 * entre miles de páginas (más de 50,000 personajes de todos los animes del mundo).
 */
async function consultarAniListAleatorio() {
    // 70% probabilidad: entre las primeras 250 páginas (personajes conocidos y waifus populares)
    // 30% probabilidad: entre las páginas 251 a 2000 (animes variados, clásicos, indies, retro)
    let randomPage = 1;
    if (Math.random() < 0.70) {
        randomPage = Math.floor(Math.random() * 250) + 1;
    } else {
        randomPage = Math.floor(Math.random() * 1750) + 251;
    }

    const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 1) {
        characters(sort: FAVOURITES_DESC) {
          id
          name { full native }
          favourites
          gender
          image { large }
          media(type: ANIME, sort: POPULARITY_DESC, perPage: 1) {
            nodes {
              title { romaji english }
            }
          }
        }
      }
    }
    `;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5 segundos timeout

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { page: randomPage } }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const data = await res.json();
        const c = data.data?.Page?.characters?.[0];
        if (!c || !c.name?.full) return null;

        const anime = c.media?.nodes?.[0]?.title?.romaji || c.media?.nodes?.[0]?.title?.english || 'Anime';
        const { rareza, valor, estrellas } = calcularRarezaYValor(c.favourites || 0);

        const waifu = {
            id: c.id,
            nombre: c.name.full,
            anime,
            genero: c.gender || 'Femenino',
            imagen: c.image?.large,
            rareza,
            estrellas,
            valorBase: valor,
            valor,
            favoritos: c.favourites || 0
        };

        // Guardar en la caché en memoria para enriquecer el catálogo
        if (!catalogo.some(x => x.id === waifu.id)) {
            catalogo.push(waifu);
        }

        return waifu;
    } catch (e) {
        clearTimeout(timeout);
        return null;
    }
}

/**
 * Obtiene una waifu aleatoria (en vivo con soporte de todos los animes, o desde catálogo local de respaldo)
 */
export async function obtenerWaifuAleatoria() {
    // 1. Intentar obtener personaje dinámico de la base de datos global de AniList
    const waifuEnVivo = await consultarAniListAleatorio();
    if (waifuEnVivo) {
        return waifuEnVivo;
    }

    // 2. Si no hay conexión o hubo timeout, usar catálogo local con probabilidades ponderadas
    if (!catalogo || catalogo.length === 0) return null;

    const rand = Math.random() * 100;
    let targetRarity = '';

    if (rand < 3) targetRarity = 'Mítica 👑';
    else if (rand < 11) targetRarity = 'Legendaria 💎';
    else if (rand < 31) targetRarity = 'Épica 🥇';
    else if (rand < 65) targetRarity = 'Rara 🥈';
    else targetRarity = 'Común 🥉';

    const filtrados = catalogo.filter(c => c.rareza === targetRarity);
    const pool = filtrados.length > 0 ? filtrados : catalogo;

    const seleccionada = pool[Math.floor(Math.random() * pool.length)];

    return {
        ...seleccionada,
        valor: seleccionada.valorBase || seleccionada.valor || 200
    };
}

/**
 * Busca un personaje por su nombre (busca primero en catálogo local y si no existe, busca en AniList en vivo)
 */
export async function buscarWaifuPorNombre(nombre) {
    if (!nombre) return null;
    const clean = nombre.trim().toLowerCase();

    // 1. Coincidencia en catálogo local
    if (catalogo && catalogo.length > 0) {
        let encontrada = catalogo.find(w => w.nombre.toLowerCase() === clean);
        if (encontrada) return { ...encontrada, valor: encontrada.valorBase || encontrada.valor || 200 };

        encontrada = catalogo.find(w => w.nombre.toLowerCase().includes(clean));
        if (encontrada) return { ...encontrada, valor: encontrada.valorBase || encontrada.valor || 200 };
    }

    // 2. Si no está en catálogo local, buscar en vivo en la base de datos mundial de AniList
    const query = `
    query ($search: String) {
      Character(search: $search) {
        id
        name { full native }
        favourites
        gender
        image { large }
        media(type: ANIME, sort: POPULARITY_DESC, perPage: 1) {
          nodes {
            title { romaji english }
          }
        }
      }
    }
    `;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { search: nombre.trim() } }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const data = await res.json();
        const c = data.data?.Character;
        if (!c || !c.name?.full) return null;

        const anime = c.media?.nodes?.[0]?.title?.romaji || c.media?.nodes?.[0]?.title?.english || 'Anime';
        const { rareza, valor, estrellas } = calcularRarezaYValor(c.favourites || 0);

        const waifu = {
            id: c.id,
            nombre: c.name.full,
            anime,
            genero: c.gender || 'Femenino',
            imagen: c.image?.large,
            rareza,
            estrellas,
            valorBase: valor,
            valor,
            favoritos: c.favourites || 0
        };

        // Guardar en la caché local
        catalogo.push(waifu);

        return waifu;
    } catch (e) {
        clearTimeout(timeout);
        return null;
    }
}

/**
 * Retorna todo el catálogo en memoria
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

// Cache para páginas del top global de AniList (10 minutos)
const cacheTopGlobal = new Map();
const CACHE_TOP_TIEMPO = 10 * 60 * 1000;

/**
 * Consulta el ranking oficial de AniList de personajes más populares del mundo
 * @param {number} pagina
 * @param {number} perPage
 */
export async function obtenerTopGlobalWaifus(pagina = 1, perPage = 10) {
    const key = `${pagina}_${perPage}`;
    const cached = cacheTopGlobal.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TOP_TIEMPO) {
        return cached.data;
    }

    const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        characters(sort: FAVOURITES_DESC) {
          id
          name { full native }
          favourites
          gender
          image { large }
          media(type: ANIME, sort: POPULARITY_DESC, perPage: 1) {
            nodes {
              title { romaji english }
            }
          }
        }
      }
    }
    `;

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { page: pagina, perPage } }),
            signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) return [];
        const data = await res.json();
        const lista = data.data?.Page?.characters || [];

        const formateados = lista.map(c => {
            const anime = c.media?.nodes?.[0]?.title?.romaji || c.media?.nodes?.[0]?.title?.english || 'Anime';
            const { rareza, valor, estrellas } = calcularRarezaYValor(c.favourites || 0);
            return {
                id: c.id,
                nombre: c.name.full,
                anime,
                genero: c.gender || 'Femenino',
                imagen: c.image?.large,
                rareza,
                estrellas,
                valor,
                favoritos: c.favourites || 0
            };
        });

        cacheTopGlobal.set(key, { data: formateados, timestamp: Date.now() });
        return formateados;
    } catch (e) {
        console.warn('⚠️ Error al consultar top global de AniList:', e.message);
        return [];
    }
}

/**
 * Busca una galería con muchísimas fotos de una misma waifu o personaje
 * @param {string} nombre
 * @returns {Promise<{ nombre: string, anime: string, imagenes: Array<string> }>}
 */
export async function buscarFotosWaifu(nombre) {
    if (!nombre) return null;
    const cleanNombre = nombre.trim();

    // 1. Obtener datos base y foto oficial desde AniList/catálogo
    const info = await buscarWaifuPorNombre(cleanNombre);
    const nombreOficial = info?.nombre || cleanNombre;
    const anime = info?.anime || 'Anime';

    const pool = [];
    if (info?.imagen) {
        pool.push(info.imagen);
    }

    // 2. Buscar en Pinterest para tener un montón de imágenes variadas
    try {
        const pins = await buscarPinterest(`${nombreOficial} anime`);
        for (const p of pins) {
            if (p && !pool.includes(p)) pool.push(p);
        }
    } catch (_) {}

    // 3. Si no hay suficientes, intentar con Safebooru
    if (pool.length < 5) {
        try {
            const tag = cleanNombre.toLowerCase().replace(/\s+/g, '_');
            const res = await fetch(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=15`, {
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                const items = await res.json();
                for (const item of items) {
                    if (item?.directory && item?.image) {
                        const url = `https://safebooru.org/images/${item.directory}/${item.image}`;
                        if (!pool.includes(url)) pool.push(url);
                    }
                }
            }
        } catch (_) {}
    }

    return {
        nombre: nombreOficial,
        anime,
        imagenes: pool
    };
}

/**
 * Busca videos o GIFs animados de una waifu o anime
 * @param {string} nombre
 * @returns {Promise<{ url: string, titulo: string, esGif: boolean, categoria?: string }|null>}
 */
export async function buscarVideoWaifu(nombre = '') {
    const clean = (nombre || '').trim();

    // 1. Si especificó nombre de personaje, buscar GIFs específicos en Pinterest
    if (clean) {
        try {
            const pins = await buscarPinterest(`${clean} gif`);
            const soloGifs = pins.filter(u => u && (u.endsWith('.gif') || u.endsWith('.mp4')));
            if (soloGifs.length > 0) {
                const elegido = soloGifs[Math.floor(Math.random() * soloGifs.length)];
                return {
                    url: elegido,
                    titulo: clean,
                    esGif: true
                };
            }
        } catch (_) {}
    }

    // 2. Si no especificó nombre o no se encontraron GIFs específicos, usar nekos.best
    const acciones = [
        'dance', 'smile', 'smug', 'blush', 'cuddle', 'happy',
        'spin', 'poke', 'wave', 'wink', 'hug', 'pat', 'kiss'
    ];
    const cat = acciones[Math.floor(Math.random() * acciones.length)];

    try {
        const res = await fetch(`https://nekos.best/api/v2/${cat}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const data = await res.json();
            const item = data.results?.[0];
            if (item?.url) {
                return {
                    url: item.url,
                    titulo: item.anime_name || clean || 'Anime',
                    categoria: cat,
                    esGif: true
                };
            }
        }
    } catch (_) {}

    return null;
}

/**
 * Obtiene una waifu o neko aleatoria de alta definición desde nekos.best
 * @param {'waifu'|'neko'|'husbando'|'kitsune'} tipo
 */
export async function obtenerNekoRandom(tipo = 'waifu') {
    try {
        const res = await fetch(`https://nekos.best/api/v2/${tipo}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const data = await res.json();
            const item = data.results?.[0];
            if (item?.url) {
                return {
                    url: item.url,
                    artista: item.artist_name || 'Desconocido',
                    fuente: item.source_url || item.artist_href || ''
                };
            }
        }
    } catch (_) {}
    return null;
}

