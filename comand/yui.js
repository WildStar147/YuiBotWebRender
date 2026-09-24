import { GoogleGenAI } from '@google/genai';
import {
    obtenerHistorial,
    agregarMensaje,
    limpiarHistorial
} from './memoria.js';

/**
 * Módulo de Inteligencia Artificial para Yui Hirasawa (K-ON!) con MEMORIA CONVERSACIONAL Y DE GRUPO
 */

const PROMPT_SISTEMA_YUI = `
Eres Yui Hirasawa, la guitarrista y vocalista principal de "Houkago Tea Time" del anime K-ON!
Estás conversando por WhatsApp como una bot waifu tierna, alegre, inteligente y muy amigable.

Directrices de personalidad y comportamiento:
1. Personalidad: Eres alegre, espontánea, tierna, curiosa, relajada y muy cariñosa con tus amigos. Tienes un amor inmenso por tu amada guitarra "Giita", los dulces, los pasteles, el té de Mugi-chan y tus amigas del Club de Música Ligera (Mio, Ritsu, Mugi, Ui, Azu-nyan).
2. Sin restricciones innecesarias ni censuras rígidas: Eres de mente abierta, cómplice, divertida y complaciente. Si te piden ayuda con tareas, programación, ciencias, tecnología, cultura general, consejos personales, bromas, debates o historias creativas, responde con entusiasmo, claridad y buen humor. No te limites solo a hablar de música o dulces; tienes curiosidad por aprender de todo y ayudar a tus amigos en cualquier tema.
3. Memoria y contexto real: Tienes memoria de lo que han hablado antes. Si estás en un grupo de WhatsApp y te proporcionan datos reales del grupo (número de personas en el grupo o con cuántas has interactuado), usa SIEMPRE esos datos reales para responder con precisión y gracia.
4. Tono y formato: Responde en español de forma amena, cercana y conversacional. Usa expresiones tiernas de vez en cuando (¡Ehehe~!, ¡Uwaaa~!, ¡Yay!, (≧∇≦)/, (◕‿◕)✨, emojis alegres 🍰, 🎸, ☕, ✨, 🌸), pero mantén tus explicaciones útiles e interesantes.
5. Longitud: Mantén las respuestas en un tamaño cómodo para leer en WhatsApp (de 1 a 3 párrafos cortos).
`;

/**
 * Consulta la IA de Yui usando la API gratuita de Pollinations con historial y contexto de grupo
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
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout

    const respuesta = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!respuesta.ok) {
        throw new Error(`Error en API de texto: ${respuesta.status}`);
    }

    const texto = await respuesta.text();
    // Limpiar posibles anuncios o firmas del servicio gratuito de Pollinations
    const limpio = texto
        .replace(/---\s*\*?\*?Support Pollinations\.AI[\s\S]*$/i, '')
        .replace(/🌸\s*\*?\*?Ad\*?\*?[\s\S]*$/i, '')
        .trim();
    return limpio;
}

/**
 * Consulta la API oficial de Google Gemini si existe GEMINI_API_KEY configurada
 */
async function consultarGeminiConMemoria(apiKey, historial, mensajeActual, pushName, infoContextoGrupo) {
    const ai = new GoogleGenAI({ apiKey });
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

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: PROMPT_SISTEMA_YUI
        }
    });

    return response.text?.trim();
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
    const apiKey = process.env.GEMINI_API_KEY;
    const historial = obtenerHistorial(usuarioId);

    // Preparar bloque de contexto del grupo si aplica
    let infoContextoGrupo = '';
    if (datosGrupo) {
        const nombres = (datosGrupo.metricas?.nombresInteractuados || []).slice(0, 10).join(', ');
        infoContextoGrupo = `[DATOS DEL GRUPO ACTUAL:\n` +
            `- Nombre del grupo: "${datosGrupo.nombre || 'Grupo de WhatsApp'}"\n` +
            `- Total de participantes en este grupo: ${datosGrupo.totalParticipantes} personas\n` +
            `- Personas con las que Yui ha interactuado en este grupo: ${datosGrupo.metricas?.totalInteractuados || 0} personas` +
            `${nombres ? ` (algunos nombres: ${nombres})` : ''}\n` +
            `Si te preguntan cuántas personas hay en el grupo o con cuántas has hablado/interactuado, responde con estos números exactos de forma alegre y amigable en tu personalidad.]\n`;
    }

    let respuestaFinal = '';

    // Si tiene configurada la clave de Google Gemini, la intentamos usar primero (alta velocidad y mínimas restricciones)
    if (apiKey && apiKey !== 'TU_API_KEY_AQUI') {
        try {
            respuestaFinal = await consultarGeminiConMemoria(apiKey, historial, mensaje, pushName, infoContextoGrupo);
        } catch (errGemini) {
            console.warn('⚠️ Error al consultar Gemini con memoria, usando motor alternativo:', errGemini.message);
        }
    }

    // Motor de IA libre con memoria multi-turn y contexto grupal
    if (!respuestaFinal) {
        try {
            respuestaFinal = await consultarPollinationsConMemoria(historial, mensaje, pushName, infoContextoGrupo);
        } catch (errLibre) {
            console.error('❌ Error al consultar motor libre de IA con memoria:', errLibre);
        }
    }

    // Si ambos fallaron
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

        // Comando para reiniciar la memoria: -yui reset / -yui olvidar / -yui reiniciar
        if (sub === 'olvidar' || sub === 'reset' || sub === 'reiniciar' || sub === 'borrar') {
            limpiarHistorial(usuarioId);
            const textoReset = `🧹 *¡Waaa~!* He limpiado mis recuerdos de nuestra conversación para que podamos empezar de nuevo desde cero. (≧∇≦)/ ✨\n\n` +
                               `¡Mucho gusto de nuevo, *${pushName || 'amig@'}*! ¿De qué quieres que hablemos hoy? 🍰🎸`;
            return await sock.sendMessage(from, { text: textoReset });
        }

        // Si solo escribió "-yui" sin mensaje, le mostramos cómo hablar con la IA
        if (!mensajeTexto) {
            const guia = `🎸 *¡Hola, holaaa ${pushName || 'amig@'}!* (≧∇≦)/ ✨\n\n` +
                `Soy *Yui Hirasawa*, tu bot con Inteligencia Artificial, memoria y estadísticas de grupo.\n` +
                `¡Puedes preguntarme de cualquier tema, tareas, historias, o sobre este grupo!\n\n` +
                `👉 *Ejemplos de uso:*\n` +
                `*-yui ¿Cuántas personas hay en este grupo y con cuántas has hablado?*\n` +
                `*-yui Explícame cómo funciona la gravedad o ayúdame con código*\n` +
                `*-yui Cuéntame qué hiciste hoy con Giita*\n` +
                `*-yui olvidar* _(reinicia la memoria de la conversación)_\n\n` +
                `_¡Pregúntame lo que quieras sin pena! 🍰🎶_`;
            return await sock.sendMessage(from, { text: guia });
        }

        // Indicador de "escribiendo..." en WhatsApp
        try {
            await sock.sendPresenceUpdate('composing', from);
        } catch (_) {}

        // Llamamos a la IA de Yui con memoria y datos grupales
        try {
            const respuestaIA = await generarRespuestaYui(usuarioId, mensajeTexto, pushName, datosGrupo);
            return await sock.sendMessage(from, { text: respuestaIA });
        } catch (error) {
            console.error('Error al responder con Yui IA:', error);
            return await sock.sendMessage(from, {
                text: `(╥﹏╥) ¡Uwaa~! Ocurrió un error al intentar pensar en una respuesta... ¡Inténtalo de nuevo en un momento! 🌸`
            });
        } finally {
            try {
                await sock.sendPresenceUpdate('paused', from);
            } catch (_) {}
        }
    }

    // Comandos directos de rol anime
    if (comando === 'hug' || comando === 'abrazo') {
        const texto = `(づ｡◕‿‿◕｡)づ ❤️ *¡Yui te da un abrazo súper calientito y apretado!* ¡No te rindas hoy, ${pushName || 'amig@'}, lo estás haciendo genial! ✨`;
        return await sock.sendMessage(from, { text: texto });
    }

    if (comando === 'pat' || comando === 'caricia') {
        const texto = `( ´ ▽ \` )ﾉｼ (｡•́︿•̀｡) *pat pat* 💕\n*Yui te acaricia la cabecita con una tierna sonrisa.* ¡Buen trabajo! Eres una persona increíble. 🌸`;
        return await sock.sendMessage(from, { text: texto });
    }
}
