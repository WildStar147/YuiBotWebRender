import os from 'os';

/**
 * Módulo de comandos de administración y diagnóstico del Bot
 */

/**
 * Formatea segundos en formato legible (días, horas, minutos, segundos)
 * @param {number} segundos 
 * @returns {string}
 */
function formatearUptime(segundos) {
    const d = Math.floor(segundos / (3600 * 24));
    const h = Math.floor((segundos % (3600 * 24)) / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = Math.floor(segundos % 60);

    const partes = [];
    if (d > 0) partes.push(`${d}d`);
    if (h > 0) partes.push(`${h}h`);
    if (m > 0) partes.push(`${m}m`);
    partes.push(`${s}s`);

    return partes.join(' ');
}

/**
 * Maneja los comandos de administración y diagnóstico
 * @param {object} sock - Socket de Baileys
 * @param {object} msgInfo - Información del mensaje
 * @param {string} comando - Comando ejecutado
 * @param {Array<string>} args - Argumentos del comando
 */
export async function manejarAdmin(sock, msgInfo, comando, args) {
    const { from, messageTimestamp } = msgInfo;

    // Comando: -ping
    if (comando === 'ping') {
        const tiempoInicio = Date.now();
        // Timestamp del mensaje en milisegundos si está disponible
        const tiempoMensaje = messageTimestamp ? messageTimestamp * 1000 : tiempoInicio;
        const latencia = Math.max(0, Date.now() - tiempoMensaje);

        const respuesta = `🏓 *¡Pong!* ⚡\n\n*Velocidad:* \`${latencia} ms\`\n*Estado:* Activo y listo para tocar con Giita 🎸✨`;
        return await sock.sendMessage(from, { text: respuesta });
    }

    // Comando: -info o -estado
    if (comando === 'info' || comando === 'estado') {
        const uptimeBot = formatearUptime(process.uptime());
        const memoria = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const memLibre = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

        const respuesta = `📊 *INFORMACIÓN DEL BOT Y SISTEMA* 📊\n\n` +
            `🤖 *Nombre:* Yui Bot (Baileys)\n` +
            `⏳ *Tiempo Activo:* ${uptimeBot}\n` +
            `🧠 *Uso de RAM (Node):* ${memoria} MB\n` +
            `💻 *Memoria Servidor:* ${memLibre} GB libres de ${memTotal} GB\n` +
            `⚙️ *Plataforma:* ${os.type()} (${os.arch()})\n` +
            `🟢 *Node.js:* ${process.version}\n\n` +
            `_¡Yui está funcionando al 100%! 🍰_`;

        return await sock.sendMessage(from, { text: respuesta });
    }
}
