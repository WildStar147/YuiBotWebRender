import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

import { jidNormalizedUser } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de persistencia
const CARPETA_SESION = process.env.SESSION_DIR || path.join(__dirname, '..', 'sesion_auth');
const RUTA_DB_LOCAL = path.join(CARPETA_SESION, 'db_yui_economia.json');
const RUTA_MARKET_LOCAL = path.join(CARPETA_SESION, 'db_yui_market.json');

// Variables para MongoDB
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || null;
let mongoClient = null;
let mongoDb = null;
let usandoMongo = false;

// Caché en memoria para alta velocidad
let cacheUsuarios = new Map();
let cacheMercado = [];
let rollosActivos = new Map(); // Map<chatId, { waifu, timestamp, vencimiento, reclamado: boolean }>

/**
 * Inicializa la base de datos (conecta a MongoDB si está configurado, o usa archivos locales)
 */
export async function inicializarDB() {
    if (MONGODB_URI) {
        try {
            console.log('🔄 Conectando a MongoDB Atlas...');
            mongoClient = new MongoClient(MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000
            });
            await mongoClient.connect();
            mongoDb = mongoClient.db('yui_bot');
            usandoMongo = true;
            console.log('✅ Base de datos MongoDB Atlas conectada con éxito.');

            // Cargar usuarios en caché para respuestas instantáneas
            const usuariosColeccion = await mongoDb.collection('users').find({}).toArray();
            for (const u of usuariosColeccion) {
                cacheUsuarios.set(u.id, u);
            }

            const ventasColeccion = await mongoDb.collection('market').find({}).toArray();
            cacheMercado = ventasColeccion;
            return;
        } catch (err) {
            console.warn('⚠️ No se pudo conectar a MongoDB Atlas. Usando persistencia local:', err.message);
            usandoMongo = false;
        }
    }

    // Fallback a archivos locales
    try {
        if (!fs.existsSync(CARPETA_SESION)) {
            fs.mkdirSync(CARPETA_SESION, { recursive: true });
        }

        if (fs.existsSync(RUTA_DB_LOCAL)) {
            const data = fs.readFileSync(RUTA_DB_LOCAL, 'utf-8');
            const parsed = JSON.parse(data);
            cacheUsuarios = new Map(Object.entries(parsed));
        }

        // Limpiar cualquier entrada errónea de grupos que se haya guardado previamente
        for (const [key] of cacheUsuarios.entries()) {
            if (key.endsWith('@g.us')) {
                cacheUsuarios.delete(key);
            }
        }

        if (fs.existsSync(RUTA_MARKET_LOCAL)) {
            const dataM = fs.readFileSync(RUTA_MARKET_LOCAL, 'utf-8');
            cacheMercado = JSON.parse(dataM);
        }
        console.log(`✅ Base de datos local cargada (${cacheUsuarios.size} usuarios registrados).`);
    } catch (err) {
        console.error('❌ Error al cargar base de datos local:', err.message);
    }
}

/**
 * Guarda los datos en el medio correspondiente (Mongo o Disco)
 */
async function guardarUsuario(usuario) {
    if (!usuario || !usuario.id || usuario.id.endsWith('@g.us')) return;

    usuario.id = jidNormalizedUser(usuario.id);
    cacheUsuarios.set(usuario.id, usuario);

    if (usandoMongo && mongoDb) {
        try {
            await mongoDb.collection('users').updateOne(
                { id: usuario.id },
                { $set: usuario },
                { upsert: true }
            );
        } catch (err) {
            console.error('Error al guardar en MongoDB:', err.message);
        }
    } else {
        try {
            const obj = Object.fromEntries(cacheUsuarios);
            fs.writeFileSync(RUTA_DB_LOCAL, JSON.stringify(obj, null, 2), 'utf-8');
        } catch (err) {
            console.error('Error al guardar base de datos local:', err.message);
        }
    }
}

/**
 * Guarda el mercado en disco o mongo
 */
async function guardarMercado() {
    if (usandoMongo && mongoDb) {
        try {
            await mongoDb.collection('market').deleteMany({});
            if (cacheMercado.length > 0) {
                await mongoDb.collection('market').insertMany(cacheMercado);
            }
        } catch (err) {
            console.error('Error al guardar mercado en MongoDB:', err.message);
        }
    } else {
        try {
            fs.writeFileSync(RUTA_MARKET_LOCAL, JSON.stringify(cacheMercado, null, 2), 'utf-8');
        } catch (err) {
            console.error('Error al guardar mercado local:', err.message);
        }
    }
}

/**
 * Obtiene o crea el perfil de economía y gacha de un usuario
 * @param {string} usuarioId - JID del usuario
 * @param {string} pushName - Nombre en WhatsApp
 * @returns {object} Perfil completo del usuario
 */
export async function obtenerUsuario(usuarioId, pushName = 'Usuario') {
    if (!usuarioId || typeof usuarioId !== 'string') return null;

    const cleanId = jidNormalizedUser(usuarioId);
    if (!cleanId || cleanId.endsWith('@g.us')) {
        console.warn('⚠️ Se rechazó acceso a perfil de usuario con ID de grupo o inválido:', usuarioId);
        return null;
    }

    let user = cacheUsuarios.get(cleanId);

    if (!user) {
        user = {
            id: cleanId,
            nombre: pushName || 'Usuario',
            wallet: 500, // Balance inicial de bienvenida
            banco: 0,
            rachaDaily: 0,
            ultimoDaily: 0,
            ultimoWork: 0,
            ultimoCrime: 0,
            ultimoSlut: 0,
            ultimoRobo: 0,
            ultimoRoll: 0,
            ultimoVoto: 0,
            claimMsg: '',
            harem: [],
            estadisticas: {
                trabajos: 0,
                crimenesExitosos: 0,
                crimenesFallidos: 0,
                apuestasGanadas: 0,
                apuestasPerdidas: 0,
                robosExitosos: 0,
                robosSufridos: 0
            }
        };
        await guardarUsuario(user);
    } else {
        // Asegurar que propiedades nuevas no sean undefined
        if (typeof user.wallet !== 'number') user.wallet = 500;
        if (typeof user.banco !== 'number') user.banco = 0;
        if (!Array.isArray(user.harem)) user.harem = [];
        if (!user.estadisticas) {
            user.estadisticas = {
                trabajos: 0,
                crimenesExitosos: 0,
                crimenesFallidos: 0,
                apuestasGanadas: 0,
                apuestasPerdidas: 0,
                robosExitosos: 0,
                robosSufridos: 0
            };
        }
        if (pushName && pushName !== 'Usuario' && user.nombre !== pushName) {
            user.nombre = pushName;
        }
    }

    return user;
}

/**
 * Actualiza los datos de un usuario
 */
export async function actualizarUsuario(user) {
    if (!user || !user.id || user.id.endsWith('@g.us')) return;
    await guardarUsuario(user);
}

/**
 * Obtiene todos los usuarios ordenados por riqueza total (Wallet + Banco)
 */
export function obtenerTopEconomia() {
    const lista = Array.from(cacheUsuarios.values()).filter(u => u.id && !u.id.endsWith('@g.us'));
    lista.sort((a, b) => {
        const totalA = (a.wallet || 0) + (a.banco || 0);
        const totalB = (b.wallet || 0) + (b.banco || 0);
        return totalB - totalA;
    });
    return lista;
}

/**
 * Obtiene los mejores coleccionistas por valor total de su harem
 */
export function obtenerTopHarem() {
    const lista = Array.from(cacheUsuarios.values()).filter(u => u.id && !u.id.endsWith('@g.us'));
    return lista
        .map(u => {
            const valorTotal = (u.harem || []).reduce((acc, c) => acc + (c.valor || c.valorBase || 0), 0);
            return {
                id: u.id,
                nombre: u.nombre,
                cantidadWaifus: (u.harem || []).length,
                valorTotal
            };
        })
        .filter(u => u.cantidadWaifus > 0)
        .sort((a, b) => b.valorTotal - a.valorTotal);
}

/**
 * Registra un rollo activo de waifu en un chat
 */
export function establecerRolloActivo(chatId, waifu) {
    rollosActivos.set(chatId, {
        waifu,
        timestamp: Date.now(),
        vencimiento: Date.now() + 60000, // 60 segundos para reclamar
        reclamado: false
    });
}

/**
 * Obtiene el rollo activo de un chat
 */
export function obtenerRolloActivo(chatId) {
    const rollo = rollosActivos.get(chatId);
    if (!rollo) return null;
    if (Date.now() > rollo.vencimiento) {
        rollosActivos.delete(chatId);
        return null;
    }
    return rollo;
}

/**
 * Marca el rollo activo como reclamado
 */
export function marcarRolloReclamado(chatId) {
    const rollo = rollosActivos.get(chatId);
    if (rollo) {
        rollo.reclamado = true;
        rollosActivos.delete(chatId);
    }
}

/**
 * Verifica si alguien en algún chat ya tiene reclamada a esta waifu
 */
export function buscarDuenioWaifu(waifuId, waifuNombre) {
    for (const u of cacheUsuarios.values()) {
        if (!u.id || u.id.endsWith('@g.us')) continue;
        const found = (u.harem || []).find(
            w => (waifuId && w.id === waifuId) || 
                 (waifuNombre && w.nombre?.toLowerCase() === waifuNombre?.toLowerCase())
        );
        if (found) {
            return { duenio: u, waifu: found };
        }
    }
    return null;
}

/**
 * Mercado de waifus (compra/venta)
 */
export function obtenerMercado() {
    return cacheMercado;
}

export async function agregarVentaMercado(item) {
    cacheMercado.push(item);
    await guardarMercado();
}

export async function removerVentaMercado(idVenta) {
    cacheMercado = cacheMercado.filter(v => v.idVenta !== idVenta);
    await guardarMercado();
}
