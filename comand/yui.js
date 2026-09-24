import { GoogleGenAI } from '@google/genai';
import {
    obtenerHistorial,
    agregarMensaje,
    limpiarHistorial
} from './memoria.js';

/**
 * Módulo de Inteligencia Artificial para Yui Hirasawa (K-ON!) con MEMORIA CONVERSACIONAL,
 * ROTACIÓN AUTOMÁTICA DE APIS DE GEMINI Y CONTEXTO INTELIGENTE DE GRUPOS.
 */

const PROMPT_SISTEMA_YUI = `
Eres Yui Hirasawa, la guitarrista y vocalista principal de "Houkago Tea Time" del anime K-ON!
Estás conversando por WhatsApp como una bot waifu tierna, alegre, inteligente y muy amigable.

Directrices de personalidad y comportamiento:
1. Personalidad: Eres alegre, espontánea, tierna, curiosa, relajada y muy cariñosa con tus amigos. Tienes un amor inmenso por tu amada guitarra "Giita", los dulces, los pasteles, el té de Mugi-chan y tus amigas del Club de Música Ligera (Mio, Ritsu, Mugi, Ui, Azu-nyan).
2. Sin restricciones innecesarias: Eres de mente abierta, cómplice, divertida y complaciente. Si te piden ayuda con tareas, programación, ciencias, tecnología, cultura general, consejos personales, bromas, debates o historias creativas, responde con entusiasmo, claridad y buen humor. No te limites solo a hablar de música o dulces; tienes curiosidad por aprender de todo y ayudar a tus amigos en cualquier tema.
3. REGLA ESTRICTA SOBRE MIEMBROS DEL GRUPO:
   - JAMÁS menciones cuántas personas hay en el grupo ni con cuántas has interactuado a menos que el usuario te lo pregunte DIRECTA Y EXPLÍCITAMENTE (ejemplo: "¿cuántos somos en el grupo?", "¿con quiénes has hablado?", "¿cuántas personas hay?").
   - Si el usuario te saluda, te hace una pregunta general, te pide un chiste o habla de cualquier otro tema, responde ÚNICAMENTE a lo que te pregunta, SIN mencionar las estadísticas ni los miembros del grupo.
4. Tono y formato: Responde en español de forma amena, cercana y conversacional. Usa expresiones tiernas de vez en cuando (¡Ehehe~!, ¡Uwaaa~!, ¡Yay!, (≧∇≦)/, (◕‿◕)✨, emojis alegres 🍰, 🎸, ☕, ✨, 🌸), pero mantén tus explicaciones útiles e interesantes.
5. Longitud: Mantén las respuestas en un tamaño cómodo para leer en WhatsApp (de 1 a 3 párrafos cortos).
`;

/**
 * Detecta si el usuario está preguntando específicamente sobre estadísticas o miembros del grupo
 * @param {string} texto 
 * @returns {boolean}
 */
function esPreguntaSobreMiembrosOGrupo(texto) {
    if (!texto) return false;
    const regex = /(cu[aá]nt[ao]s?(\s+somos|\s+hay|\s+personas|\s+miembros|\s+integrantes|\s+amigos|\s+usuarios)?|qui[eé]nes?\s+est[aá]n?|qui[eé]nes?\s+somos|con\s+qui[eé]n(es)?\s+has\s+hablado|con\s+cu[aá]ntos\s+has\s+hablado|miembros\s+del\s+grupo|integrantes\s+del\s+grupo|participantes\s+del\s+grupo|gente\s+en\s+el\s+grupo)/i;
    return regex.test(texto);
}

/**
 * Obtiene la lista de claves de Google Gemini configuradas.
 * Permite múltiples claves separadas por coma en GEMINI_API_KEY o GEMINI_API_KEYS
 * Ejemplo: GEMINI_API_KEY=AIzaSyClave1...,AIzaSyClave2...,AIzaSyClave3...
 * @returns {Array<string>}
 */
function obtenerClavesGemini() {
    const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return raw
        .split(',')
        .map(k => k.trim())
        .filter(k => k && k.startsWith('AIzaSy') && k !== 'TU_API_KEY_AQUI');
}

// Índice de la clave activa actual para rotación automática
let indiceClaveActual = 0;

/**
 * Consulta la IA de Yui usando la API gratuita de Pollinations como respaldo infalible
 */
async function consultarPollinationsConMemoria(historial, mensajeActual, pushName, infoContextoGrupo) {
    const nombreUsuario = pushName || 'Usuario';
    
    let contexto = '';
    if (infoContextoGrupo) {
        contexto += infoContextoGrupo + '\n';
    }

    if (historial.length > 0) {
        contexto += '[Historial reciente de la conversación:\n' +
            historial.map(m => `${m.role === 'user' ? nombreUsuario : 'Yui'}: ${m.content}`).join('\n') +
            '\n]\n';
    }

    const promptCompleto = `${contexto}${nombreUsuario}: ${mensajeActual}`;
    const url = 'https://text.pollinations.ai/' + encodeURIComponent(promptCompleto) +
                '?system=' + encodeURIComponent(PROMPT_SISTEMA_YUI);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    const respuesta = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!respuesta.ok) {
        throw new Error(`Error en API de texto: ${respuesta.status}`);
    }

    const texto = await respuesta.text();
    return texto
        .replace(/---\s*\*?\*?Support Pollinations\.AI[\s\S]*$/i, '')
        .replace(/🌸\s*\*?\*?Ad\*?\*?[\s\S]*$/i, '')
        .trim();
}

/**
 * Consulta la API oficial de Google Gemini con ROTACIÓN AUTOMÁTICA DE CLAVES
 * Si una clave se agota por cuota (HTTP 429 o RESOURCE_EXHAUSTED), automáticamente rota a la siguiente.
 */
async function consultarGeminiConRotacion(claves, historial, mensajeActual, pushName, infoContextoGrupo) {
    const promptUsuario = `${pushName ? `[${pushName}]: ` : ''}${mensajeActual}`;

    const contents = historial.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    let textoFinal = promptUsuario;
    if (infoContextoGrupo) {
        textoFinal = `${infoContextoGrupo}\n${promptUsuario}`;
    }

    contents.push({
        role: 'user',
        parts: [{ text: textoFinal }]
    });

    let ultimoError = null;

    // Intentar con las claves disponibles empezando por la clave activa
    for (let intento = 0; intento < claves.length; intento++) {
        const idx = (indiceClaveActual + intento) % claves.length;
        const clave = claves[idx];

        try {
            const ai = new GoogleGenAI({ apiKey: clave });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents,
                config: {
                    systemInstruction: PROMPT_SISTEMA_YUI
                }
            });

            const resultado = response.text?.trim();
            if (resultado) {
                indiceClaveActual = idx; // Mantener la clave activa si funcionó
                return resultado;
            }
        } catch (err) {
            const msgError = err.message || '';
            console.warn(`⚠️ [Gemini Key ${idx + 1}/${claves.length}] Error o tokens agotados: ${msgError}`);
            ultimoError = err;

            // Si hay más claves en la lista, continuar a la siguiente
            if (claves.length > 1) {
                console.log(`🔄 [Rotación Gemini] Cambiando automáticamente a la clave ${((idx + 1) % claves.length) + 1}...`);
            }
        }
    }

    throw ultimoError || new Error('Todas las claves de Gemini fallaron o agotaron su cuota.');
}

/**
 * Genera la respuesta de IA de Yui Hirasawa con memoria y datos grupales.
 * 
 * @param {string} usuarioId - Identificador único del usuario
 * @param {string} mensaje - Mensaje o pregunta del usuario
 * @param {string} pushName - Nombre del usuario en WhatsApp
 * @param {object} datosGrupo - Información del grupo actual si aplica
 * @returns {Promise<string>}
 */
export async function generarRespuestaYui(usuarioId, mensaje, pushName, datosGrupo = null) {
    const clavesGemini = obtenerClavesGemini();
    const historial = obtenerHistorial(usuarioId);

    // Contexto grupal: SOLO se incluye si el usuario pregunta explícitamente sobre el grupo o miembros
    let infoContextoGrupo = '';
    if (datosGrupo && esPreguntaSobreMiembrosOGrupo(mensaje)) {
        const nombres = (datosGrupo.metricas?.nombresInteractuados || []).slice(0, 10).join(', ');
        infoContextoGrupo = `[INFORMACIÓN ESPECÍFICA DEL GRUPO ACTUAL:\n` +
            `- Nombre del grupo: "${datosGrupo.nombre || 'Grupo de WhatsApp'}"\n` +
            `- Total de personas en este grupo: ${datosGrupo.totalParticipantes}\n` +
            `- Personas con las que Yui ha interactuado en este grupo: ${datosGrupo.metricas?.totalInteractuados || 0}` +
            `${nombres ? ` (algunos nombres: ${nombres})` : ''}\n` +
            `El usuario te ha preguntado sobre el grupo o las personas. Responde con estos datos reales de forma alegre y amigable en tu personalidad.]\n`;
    }

    let respuestaFinal = '';

    // 1. Intentar con Google Gemini (con rotación automática de claves si tienes varias)
    if (clavesGemini.length > 0) {
        try {
            respuestaFinal = await consultarGeminiConRotacion(clavesGemini, historial, mensaje, pushName, infoContextoGrupo);
        } catch (errGemini) {
            console.warn('⚠️ [Gemini] Todas las claves de Gemini fallaron o se agotaron los tokens. Usando motor gratuito de respaldo...');
        }
    }

    // 2. Si no hay claves o se agotaron los tokens, usar el motor gratuito de respaldo (nunca se queda sin tokens)
    if (!respuestaFinal) {
        try {
            respuestaFinal = await consultarPollinationsConMemoria(historial, mensaje, pushName, infoContextoGrupo);
        } catch (errLibre) {
            console.error('❌ Error al consultar motor libre de IA con memoria:', errLibre.message);
        }
    }

    // 3. Fallback cariñoso si ambos motores tuvieron fallas de red
    if (!respuestaFinal) {
        return `(•́ω•̀)? ¡Uwaaa ${pushName || 'amig@'}! Me distraje pensando en comer pastel con Mugi-chan y se me fue la onda... ¿Me lo repites por favor? Ehehe~ 🍰🎸`;
    }

    // Guardar en la memoria persistente de este usuario
    agregarMensaje(usuarioId, 'user', mensaje);
    agregarMensaje(usuarioId, 'assistant', respuestaFinal);

    return respuestaFinal;
}

/**
 * Manejador principal para comandos e interacciones con Yui
 * @param {object} sock - Instancia de Baileys
 * @param {object} msgInfo - Datos del mensaje entrante
 * @param {string} comando - Comando ejecutado
 * @param {Array<string>} args - Argumentos del comando
 * @param {object} datosGrupo - Información del grupo actual si aplica
 */
export async function manejarYui(sock, msgInfo, comando, args, datosGrupo = null) {
    const { from, sender, pushName } = msgInfo;
    const usuarioId = sender || from;

    // Comando principal: -yui <mensaje con IA, memoria y contexto grupal>
    if (comando === 'yui') {
        const mensajeTexto = args.join(' ').trim();
        const sub = (args[0] || '').toLowerCase();

        // Subcomando: -yui olvidar / -yui reset
        if (sub === 'olvidar' || sub === 'reset' || sub === 'limpiar') {
            limpiarHistorial(usuarioId);
            return await sock.sendMessage(from, {
                text: `(◕‿◕)✨ ¡Listo! He borrado nuestra conversación anterior de mi memoria. ¡Es como empezar un nuevo día de té y música! Ehehe~ 🍰🎸`
            }, { quoted: msgInfo.m });
        }

        // Si no escribió ningún mensaje
        if (!mensajeTexto) {
            return await sock.sendMessage(from, {
                text: `(•́ω•̀)? ¡Ehehe~! Para hablar conmigo escribe *-yui* seguido de lo que quieras decirme.\n` +
                      `👉 *Ejemplo:* *-yui ¿Cuál es tu canción favorita?*\n` +
                      `👉 *Para borrar mi memoria:* *-yui olvidar* 🍰🎸`
            }, { quoted: msgInfo.m });
        }

        try {
            // Reaccionar con emoji de pensamiento mientras procesa
            await sock.sendMessage(from, { react: { text: '💭', key: msgInfo.m.key } });

            const respuestaIA = await generarRespuestaYui(usuarioId, mensajeTexto, pushName, datosGrupo);

            // Enviar respuesta generada
            await sock.sendMessage(from, { text: respuestaIA }, { quoted: msgInfo.m });

            // Reaccionar con emoji de éxito
            await sock.sendMessage(from, { react: { text: '✨', key: msgInfo.m.key } });
        } catch (error) {
            console.error('Error al responder con Yui:', error);
            await sock.sendMessage(from, {
                text: `(╥﹏╥) ¡Uwaa~! Me dio un pequeño tropiezo con los cables de Giita... Intenta preguntarme de nuevo en un momento. 🌸🎸`
            }, { quoted: msgInfo.m });
        }
    }
}
