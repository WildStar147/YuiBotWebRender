import { jidNormalizedUser } from '@whiskeysockets/baileys';
import {
    obtenerUsuario,
    actualizarUsuario,
    obtenerTopEconomia
} from './database.js';

// Cooldowns en milisegundos
const COOLDOWN_DAILY = 24 * 60 * 60 * 1000; // 24 horas
const COOLDOWN_WORK = 15 * 60 * 1000;       // 15 minutos
const COOLDOWN_CRIME = 25 * 60 * 1000;      // 25 minutos
const COOLDOWN_SLUT = 20 * 60 * 1000;       // 20 minutos
const COOLDOWN_ROBO = 30 * 60 * 1000;       // 30 minutos

/**
 * Formatea un número a estilo de moneda (ej: 1,500)
 */
function fNum(n) {
    return (n || 0).toLocaleString('es-MX');
}

/**
 * Formatea tiempo restante a texto legible (ej: 12h 30m 15s)
 */
function formatoTiempo(ms) {
    if (ms <= 0) return '0s';
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / (1000 * 60)) % 60);
    const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));

    const partes = [];
    if (d > 0) partes.push(`${d}d`);
    if (h > 0) partes.push(`${h}h`);
    if (m > 0) partes.push(`${m}m`);
    if (s > 0 || partes.length === 0) partes.push(`${s}s`);
    return partes.join(' ');
}

/**
 * Obtiene el JID de usuario válido del emisor, impidiendo que un ID de grupo sea tomado como usuario
 */
function resolverActor(msgInfo) {
    const { from, sender, esGrupo } = msgInfo;
    const actor = sender || (!esGrupo ? from : null);
    if (!actor || actor.endsWith('@g.us')) return null;
    return jidNormalizedUser(actor);
}

/**
 * -balance / -bal / -coins [@mención]
 */
export async function manejarBalance(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = quoted || (mentioned.length > 0 ? mentioned[0] : actorJid);
    if (targetJid) targetJid = jidNormalizedUser(targetJid);

    if (!targetJid || targetJid.endsWith('@g.us')) {
        targetJid = actorJid;
    }

    if (!targetJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const esPropio = targetJid === actorJid;
    const usuario = await obtenerUsuario(targetJid, esPropio ? pushName : 'Usuario');

    if (!usuario) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No se pudo cargar el perfil financiero.` }, { quoted: m });
    }

    const wallet = usuario.wallet || 0;
    const banco = usuario.banco || 0;
    const total = wallet + banco;

    // Calcular posición en el ranking
    const todos = obtenerTopEconomia();
    const pos = todos.findIndex(u => u.id === targetJid) + 1;
    const posTexto = pos > 0 ? `#${pos}` : 'Sin clasificar';

    const tag = targetJid.split('@')[0];

    const texto = `╭━━━〔 💰 *BALANCE FINANCIERO* 〕━━━╮\n` +
                  `┃ 👤 *Usuario:* @${tag}\n` +
                  `┃ 🪙 *En mano (Wallet):* $${fNum(wallet)} coins\n` +
                  `┃ 🏦 *En el Banco:* $${fNum(banco)} coins\n` +
                  `┃ 💎 *Patrimonio Total:* $${fNum(total)} coins\n` +
                  `┃ 🏆 *Ranking:* ${posTexto}\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                  `_💡 Protege tu dinero depositándolo en el banco con *-dep all*_ 🍰`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: [targetJid]
    }, { quoted: m });
}

/**
 * -daily : Recompensa diaria con racha
 */
export async function manejarDaily(sock, msgInfo) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    if (!usuario) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) Error al cargar tu perfil de usuario.` }, { quoted: m });
    }

    const ahora = Date.now();
    const tiempoPasado = ahora - (usuario.ultimoDaily || 0);

    if (tiempoPasado < COOLDOWN_DAILY) {
        const restante = COOLDOWN_DAILY - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa, ${pushName}! Ya reclamaste tu recompensa diaria hoy.\n` +
                  `⏳ *Vuelve en:* ${formatoTiempo(restante)} 🍰✨`
        }, { quoted: m });
    }

    // Comprobar racha (si pasaron más de 48h desde el último reclamo, se reinicia la racha)
    if (tiempoPasado > COOLDOWN_DAILY * 2) {
        usuario.rachaDaily = 1;
    } else {
        usuario.rachaDaily = (usuario.rachaDaily || 0) + 1;
    }

    // Recompensa base: 1,000 + (racha * 150)
    const base = 1000;
    const bonusRacha = Math.min(2000, (usuario.rachaDaily - 1) * 150);
    const recompensaTotal = base + bonusRacha;

    usuario.wallet = (usuario.wallet || 0) + recompensaTotal;
    usuario.ultimoDaily = ahora;
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '🎁', key: m.key } });

    const texto = `╭━━━〔 🎁 *RECOMPENSA DIARIA* 〕━━━╮\n` +
                  `┃ ¡Konnichiwa, *${pushName}*! (≧∇≦)/ 🍓\n` +
                  `┃ 🪙 *Recompensa:* +$${fNum(base)} coins\n` +
                  `┃ 🔥 *Racha activa:* ${usuario.rachaDaily} días (+${fNum(bonusRacha)})\n` +
                  `┃ 💰 *Total recibido:* +$${fNum(recompensaTotal)} coins\n` +
                  `┃ 👛 *Tu nuevo balance:* $${fNum(usuario.wallet)} coins\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                  `_¡No olvides regresar mañana para no perder tu racha!_ 🍰🎸`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -work / -w : Trabajar para ganar dinero
 */
export async function manejarWork(sock, msgInfo) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    if (!usuario) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) Error al cargar tu perfil de usuario.` }, { quoted: m });
    }

    const ahora = Date.now();
    const tiempoPasado = ahora - (usuario.ultimoWork || 0);

    if (tiempoPasado < COOLDOWN_WORK) {
        const restante = COOLDOWN_WORK - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `(；´д｀) ¡Uwaaa, ${pushName}! Estás agotad@ de tanto trabajar.\n` +
                  `☕ Tómate un tecito y descansa: *espera ${formatoTiempo(restante)}* 🍰`
        }, { quoted: m });
    }

    const TRABAJOS = [
        { desc: 'Ayudaste a Yui a afinar a Giita para su próxima práctica de Houkago Tea Time 🎸', pago: 380 },
        { desc: 'Mugi-chan te contrató para servir té de jazmín y pasteles de fresa en el club ☕🍰', pago: 450 },
        { desc: 'Ayudaste a Mio a escribir la letra de una nueva canción súper tierna 📝✨', pago: 420 },
        { desc: 'Ritsu te pidió que organizaras las baquetas de su batería para el concierto 🥁', pago: 360 },
        { desc: 'Cuidaste a Azu-nyan en el club y le diste un postrecito delicioso 🐾🍮', pago: 400 },
        { desc: 'Ui te invitó a preparar la cena en casa de las hermanas Hirasawa 🍲🌸', pago: 480 },
        { desc: 'Trabajaste de medio tiempo atendiendo una tienda de mangas y guitarras 🏬', pago: 350 },
        { desc: 'Ayudaste a Sawako-sensei a coser disfraces para la banda escolar 👗✨', pago: 460 },
        { desc: 'Repartiste volantes para la presentación del Club de Música Ligera 📄🎵', pago: 330 }
    ];

    const trabajo = TRABAJOS[Math.floor(Math.random() * TRABAJOS.length)];
    const ganancia = trabajo.pago + Math.floor(Math.random() * 80);

    usuario.wallet = (usuario.wallet || 0) + ganancia;
    usuario.ultimoWork = ahora;
    usuario.estadisticas.trabajos = (usuario.estadisticas.trabajos || 0) + 1;
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '💼', key: m.key } });

    const texto = `╭━━━〔 💼 *JORNADA LABORAL* 〕━━━╮\n` +
                  `┃ *Trabajo:* ${trabajo.desc}\n` +
                  `┃ 💵 *Sueldo ganado:* +$${fNum(ganancia)} coins\n` +
                  `┃ 👛 *Wallet:* $${fNum(usuario.wallet)} coins\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                  `_¡Gran esfuerzo, ${pushName}! Te mereces un descanso._ (≧∇≦)/ 🍓`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -crime : Cometer un crimen con riesgo de multa
 */
export async function manejarCrime(sock, msgInfo) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    if (!usuario) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) Error al cargar tu perfil de usuario.` }, { quoted: m });
    }

    const ahora = Date.now();
    const tiempoPasado = ahora - (usuario.ultimoCrime || 0);

    if (tiempoPasado < COOLDOWN_CRIME) {
        const restante = COOLDOWN_CRIME - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `🚨 ¡Shhh! La policía todavía está vigilando la zona.\n` +
                  `⏳ Espera a que se calmen las cosas: *${formatoTiempo(restante)}* 🚓`
        }, { quoted: m });
    }

    const exito = Math.random() < 0.65; // 65% de éxito
    usuario.ultimoCrime = ahora;

    if (exito) {
        const botin = Math.floor(Math.random() * 900) + 600; // 600 a 1500
        const CRIMENES_EXITOSOS = [
            'Hackeaste la máquina expendedora de la academia y sacaste todas las monedas 🍫💻',
            'Te colaste a la pastelería de lujo y te robaste una caja fuerte con dulces y dinero 🎂💰',
            'Vendiste boletos falsos en primera fila para el concierto de Houkago Tea Time 🎟️🤫',
            'Hiciste contrabando de guitarras vintage importadas sin pagar aduanas 🎸🕶️'
        ];
        const desc = CRIMENES_EXITOSOS[Math.floor(Math.random() * CRIMENES_EXITOSOS.length)];

        usuario.wallet = (usuario.wallet || 0) + botin;
        usuario.estadisticas.crimenesExitosos = (usuario.estadisticas.crimenesExitosos || 0) + 1;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '🥷', key: m.key } });

        const texto = `╭━━━〔 🥷 *CRIMEN EXITOSO* 〕━━━╮\n` +
                      `┃ *Misión:* ${desc}\n` +
                      `┃ 💰 *Botín obtenido:* +$${fNum(botin)} coins\n` +
                      `┃ 👛 *Wallet:* $${fNum(usuario.wallet)} coins\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `_¡Escapaste sin dejar rastro! Ehehe~_ 🍰✨`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    } else {
        const multa = Math.min(usuario.wallet || 0, Math.floor(Math.random() * 500) + 400);
        usuario.wallet = Math.max(0, (usuario.wallet || 0) - multa);
        usuario.estadisticas.crimenesFallidos = (usuario.estadisticas.crimenesFallidos || 0) + 1;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '🚨', key: m.key } });

        const texto = `╭━━━〔 🚓 *¡TE ATRAPARON!* 〕━━━╮\n` +
                      `┃ ¡Mio-chan y la policía te descubrieron in fraganti! (╥﹏╥)\n` +
                      `┃ 💸 *Multa pagada:* -$${fNum(multa)} coins\n` +
                      `┃ 👛 *Wallet restante:* $${fNum(usuario.wallet)} coins\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `_¡El crimen no siempre paga! Ten más cuidado._ 🌸`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    }
}

/**
 * -slut : Actividad riesgosa con recompensa o pérdidas
 */
export async function manejarSlut(sock, msgInfo) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    if (!usuario) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) Error al cargar tu perfil de usuario.` }, { quoted: m });
    }

    const ahora = Date.now();
    const tiempoPasado = ahora - (usuario.ultimoSlut || 0);

    if (tiempoPasado < COOLDOWN_SLUT) {
        const restante = COOLDOWN_SLUT - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `(⁄ ⁄•́ω•̀⁄ ⁄) ¡Uwaaa, necesitas descansar!\n` +
                  `⏳ Vuelve en: *${formatoTiempo(restante)}* 🌸`
        }, { quoted: m });
    }

    usuario.ultimoSlut = ahora;
    const exito = Math.random() < 0.70;

    if (exito) {
        const propina = Math.floor(Math.random() * 700) + 500;
        usuario.wallet = (usuario.wallet || 0) + propina;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '💋', key: m.key } });

        const texto = `╭━━━〔 💋 *ENCUENTRO NOCTURNO* 〕━━━╮\n` +
                      `┃ Saliste al club nocturno y cautivaste a todos con tus encantos.\n` +
                      `┃ 💵 *Propina recibida:* +$${fNum(propina)} coins\n` +
                      `┃ 👛 *Wallet:* $${fNum(usuario.wallet)} coins\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `_¡Te dejaron una muy buena recompensa!_ (≧∇≦)/ ✨`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    } else {
        const estafa = Math.min(usuario.wallet || 0, Math.floor(Math.random() * 400) + 250);
        usuario.wallet = Math.max(0, (usuario.wallet || 0) - estafa);
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '💔', key: m.key } });

        const texto = `╭━━━〔 💔 *MALA SUERTE* 〕━━━╮\n` +
                      `┃ El cliente resultó ser un tacaño y te robó lo que llevabas puesto. (╥﹏╥)\n` +
                      `┃ 💸 *Pérdida:* -$${fNum(estafa)} coins\n` +
                      `┃ 👛 *Wallet:* $${fNum(usuario.wallet)} coins\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `_Mejor guarda tu dinero en el banco..._ 🏦`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    }
}

/**
 * -steal / -robar / -rob [@mención] : Intentar robar coins a otro usuario
 */
export async function manejarSteal(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = quoted || (mentioned.length > 0 ? mentioned[0] : null);
    if (targetJid) targetJid = jidNormalizedUser(targetJid);

    if (!targetJid || targetJid === actorJid || targetJid.endsWith('@g.us')) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Debes etiquetar o responder al mensaje de alguien para robarle!\n` +
                  `👉 *Ejemplo:* *-robar @amigo*`
        }, { quoted: m });
    }

    const ladron = await obtenerUsuario(actorJid, pushName);
    const ahora = Date.now();
    const tiempoPasado = ahora - (ladron.ultimoRobo || 0);

    if (tiempoPasado < COOLDOWN_ROBO) {
        const restante = COOLDOWN_ROBO - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `🤫 Aún tienes las manos temblorosas por tu último intento de robo.\n` +
                  `⏳ Espera: *${formatoTiempo(restante)}* 🕒`
        }, { quoted: m });
    }

    const victima = await obtenerUsuario(targetJid, 'Víctima');
    if ((victima.wallet || 0) < 100) {
        return await sock.sendMessage(from, {
            text: `(；´д｀) ¡Oye! @${targetJid.split('@')[0]} apenas tiene $${fNum(victima.wallet)} coins en su wallet. ¡No seas tan cruel, no tiene nada que robarle! 🌸`,
            mentions: [targetJid]
        }, { quoted: m });
    }

    ladron.ultimoRobo = ahora;

    const exito = Math.random() < 0.45; // 45% de probabilidad
    if (exito) {
        // Roba entre el 15% y el 35% del dinero en mano
        const porcentaje = (Math.floor(Math.random() * 20) + 15) / 100;
        const robado = Math.floor(victima.wallet * porcentaje);

        victima.wallet -= robado;
        ladron.wallet = (ladron.wallet || 0) + robado;
        ladron.estadisticas.robosExitosos = (ladron.estadisticas.robosExitosos || 0) + 1;
        victima.estadisticas.robosSufridos = (victima.estadisticas.robosSufridos || 0) + 1;

        await actualizarUsuario(ladron);
        await actualizarUsuario(victima);

        await sock.sendMessage(from, { react: { text: '💰', key: m.key } });

        const texto = `╭━━━〔 🕵️‍♂️ *ROBO EXITOSO* 〕━━━╮\n` +
                      `┃ ¡@${actorJid.split('@')[0]} fue súper sigilos@ y le quitó dinero a @${targetJid.split('@')[0]}!\n` +
                      `┃ 💵 *Monto sustraído:* $${fNum(robado)} coins\n` +
                      `┃ 👛 *Tu nuevo balance:* $${fNum(ladron.wallet)} coins\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `_¡Recuerden guardar sus coins en el banco con -dep!_ 🏦🍰`;

        await sock.sendMessage(from, {
            text: texto,
            mentions: [actorJid, targetJid]
        }, { quoted: m });
    } else {
        // Falla y paga compensación a la víctima
        const multa = Math.min(ladron.wallet || 0, Math.floor(Math.random() * 350) + 200);
        ladron.wallet = Math.max(0, (ladron.wallet || 0) - multa);
        victima.wallet = (victima.wallet || 0) + multa;

        await actualizarUsuario(ladron);
        await actualizarUsuario(victima);

        await sock.sendMessage(from, { react: { text: '🚨', key: m.key } });

        const texto = `╭━━━〔 🚓 *¡INTENTO DE ROBO FRUSTRADO!* 〕━━━╮\n` +
                      `┃ ¡@${targetJid.split('@')[0]} descubrió a @${actorJid.split('@')[0]} y le dio una buena tunda!\n` +
                      `┃ 💸 *Compensación pagada a la víctima:* $${fNum(multa)} coins\n` +
                      `┃ 👛 *Tu Wallet restante:* $${fNum(ladron.wallet)} coins\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `_¡Te salió el tiro por la culata! Ehehe~_ (≧∇≦)/ 🍓`;

        await sock.sendMessage(from, {
            text: texto,
            mentions: [actorJid, targetJid]
        }, { quoted: m });
    }
}

/**
 * -deposit / -dep [cantidad | all]
 */
export async function manejarDeposit(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    const montoArg = (args[0] || '').toLowerCase();

    if (!montoArg) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¿Cuánto dinero quieres depositar en el banco?\n` +
                  `👉 *Ejemplo:* *-dep 500*\n` +
                  `👉 *Ejemplo:* *-dep all* (deposita todo)`
        }, { quoted: m });
    }

    let cantidad = 0;
    if (montoArg === 'all' || montoArg === 'todo') {
        cantidad = usuario.wallet || 0;
    } else {
        cantidad = parseInt(montoArg, 10);
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        return await sock.sendMessage(from, {
            text: `❌ Ingresa una cantidad válida de coins para depositar.`
        }, { quoted: m });
    }

    if (cantidad > (usuario.wallet || 0)) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes suficientes coins en mano. Tu Wallet es de solo *$${fNum(usuario.wallet)}* coins.`
        }, { quoted: m });
    }

    usuario.wallet -= cantidad;
    usuario.banco = (usuario.banco || 0) + cantidad;
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '🏦', key: m.key } });

    const texto = `🏦 *¡Depósito bancario exitoso!*\n` +
                  `📥 *Depositado:* $${fNum(cantidad)} coins\n` +
                  `👛 *En mano:* $${fNum(usuario.wallet)} coins\n` +
                  `💎 *Total en Banco:* $${fNum(usuario.banco)} coins (¡Seguro contra robos!) ✨`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -withdraw / -with / -retirar [cantidad | all]
 */
export async function manejarWithdraw(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    const montoArg = (args[0] || '').toLowerCase();

    if (!montoArg) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¿Cuánto dinero deseas retirar del banco?\n` +
                  `👉 *Ejemplo:* *-with 500*\n` +
                  `👉 *Ejemplo:* *-with all* (retira todo)`
        }, { quoted: m });
    }

    let cantidad = 0;
    if (montoArg === 'all' || montoArg === 'todo') {
        cantidad = usuario.banco || 0;
    } else {
        cantidad = parseInt(montoArg, 10);
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        return await sock.sendMessage(from, {
            text: `❌ Ingresa una cantidad válida de coins para retirar.`
        }, { quoted: m });
    }

    if (cantidad > (usuario.banco || 0)) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes esa cantidad en el banco. Tu saldo en banco es de *$${fNum(usuario.banco)}* coins.`
        }, { quoted: m });
    }

    usuario.banco -= cantidad;
    usuario.wallet = (usuario.wallet || 0) + cantidad;
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '💵', key: m.key } });

    const texto = `🏧 *¡Retiro bancario exitoso!*\n` +
                  `📤 *Retirado:* $${fNum(cantidad)} coins\n` +
                  `👛 *Wallet actual:* $${fNum(usuario.wallet)} coins\n` +
                  `🏦 *Restante en Banco:* $${fNum(usuario.banco)} coins 🍰`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -givecoins / -pay [@mención] [cantidad]
 */
export async function manejarPay(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = quoted || (mentioned.length > 0 ? mentioned[0] : null);
    if (targetJid) targetJid = jidNormalizedUser(targetJid);

    const cantidadArg = args.find(a => !a.startsWith('@') && !isNaN(parseInt(a, 10)));
    const cantidad = parseInt(cantidadArg, 10);

    if (!targetJid || isNaN(cantidad) || cantidad <= 0) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Para transferir dinero a un amigo:\n` +
                  `👉 *Uso:* *-pay @usuario [cantidad]*\n` +
                  `👉 *Ejemplo:* *-pay @amigo 500* 🍰`
        }, { quoted: m });
    }

    if (targetJid === actorJid || targetJid.endsWith('@g.us')) {
        return await sock.sendMessage(from, { text: `¡No te puedes transferir dinero a ti mism@ ni a un grupo! (≧∇≦)/` }, { quoted: m });
    }

    const remitente = await obtenerUsuario(actorJid, pushName);
    if ((remitente.wallet || 0) < cantidad) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes suficientes coins en mano. Tu Wallet es de solo *$${fNum(remitente.wallet)}* coins.`
        }, { quoted: m });
    }

    const receptor = await obtenerUsuario(targetJid, 'Receptor');

    remitente.wallet -= cantidad;
    receptor.wallet = (receptor.wallet || 0) + cantidad;

    await actualizarUsuario(remitente);
    await actualizarUsuario(receptor);

    await sock.sendMessage(from, { react: { text: '💸', key: m.key } });

    const texto = `💸 *¡Transferencia completada!* (≧∇≦)/ 🍓\n` +
                  `👤 @${actorJid.split('@')[0]} le envió *$${fNum(cantidad)} coins* a @${targetJid.split('@')[0]} ✨\n` +
                  `👛 *Tu nuevo saldo:* $${fNum(remitente.wallet)} coins`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: [actorJid, targetJid]
    }, { quoted: m });
}

/**
 * -coinflip / -flip / -cf [cantidad] [cara/cruz]
 */
export async function manejarCoinflip(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    const cantidadArg = args[0];
    const eleccionArg = (args[1] || 'cara').toLowerCase();

    const cantidad = cantidadArg === 'all' ? (usuario.wallet || 0) : parseInt(cantidadArg, 10);
    const eleccion = eleccionArg.startsWith('cr') ? 'cruz' : 'cara';

    if (isNaN(cantidad) || cantidad <= 0) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¿Cuánto quieres apostar al cara o cruz?\n` +
                  `👉 *Uso:* *-cf [cantidad] [cara/cruz]*\n` +
                  `👉 *Ejemplo:* *-cf 500 cara*`
        }, { quoted: m });
    }

    if (cantidad > (usuario.wallet || 0)) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes suficientes coins en mano para esta apuesta ($${fNum(usuario.wallet)} en Wallet).`
        }, { quoted: m });
    }

    const resultado = Math.random() < 0.5 ? 'cara' : 'cruz';
    const gano = resultado === eleccion;

    if (gano) {
        usuario.wallet += cantidad;
        usuario.estadisticas.apuestasGanadas = (usuario.estadisticas.apuestasGanadas || 0) + 1;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '🪙', key: m.key } });
        const texto = `🪙 *¡Lanzamiento de Moneda!* 🪙\n` +
                      `✨ Cayó: *${resultado.toUpperCase()}*\n` +
                      `🎉 ¡Acertaste! Ganaste *$${fNum(cantidad)} coins* (≧∇≦)/ 🍰\n` +
                      `👛 *Nuevo saldo:* $${fNum(usuario.wallet)} coins`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    } else {
        usuario.wallet -= cantidad;
        usuario.estadisticas.apuestasPerdidas = (usuario.estadisticas.apuestasPerdidas || 0) + 1;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '💔', key: m.key } });
        const texto = `🪙 *¡Lanzamiento de Moneda!* 🪙\n` +
                      `💨 Cayó: *${resultado.toUpperCase()}*\n` +
                      `(╥﹏╥) ¡Mala suerte! Perdiste *$${fNum(cantidad)} coins*.\n` +
                      `👛 *Saldo restante:* $${fNum(usuario.wallet)} coins`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    }
}

/**
 * -roulette / -rt [red/black | rojo/negro] [cantidad]
 */
export async function manejarRoulette(sock, msgInfo, args) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const usuario = await obtenerUsuario(actorJid, pushName);
    const colorArg = (args[0] || '').toLowerCase();
    const cantidadArg = args[1];

    let colorApostado = '';
    if (['red', 'rojo', 'r'].includes(colorArg)) colorApostado = 'rojo';
    else if (['black', 'negro', 'b', 'n'].includes(colorArg)) colorApostado = 'negro';

    const cantidad = cantidadArg === 'all' ? (usuario.wallet || 0) : parseInt(cantidadArg, 10);

    if (!colorApostado || isNaN(cantidad) || cantidad <= 0) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¿A qué color y cuánto deseas apostar en la ruleta?\n` +
                  `👉 *Uso:* *-rt [rojo/negro] [cantidad]*\n` +
                  `👉 *Ejemplo:* *-rt rojo 500*`
        }, { quoted: m });
    }

    if (cantidad > (usuario.wallet || 0)) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes suficientes coins en mano para esta apuesta ($${fNum(usuario.wallet)} en Wallet).`
        }, { quoted: m });
    }

    // Ruleta europea: 0 (Verde), 1-18 (Rojo), 19-36 (Negro)
    const numeroRuleta = Math.floor(Math.random() * 37);
    let colorResultado = '';
    if (numeroRuleta === 0) colorResultado = 'verde';
    else if (numeroRuleta % 2 === 0) colorResultado = 'negro';
    else colorResultado = 'rojo';

    const gano = colorResultado === colorApostado;

    if (gano) {
        usuario.wallet += cantidad;
        usuario.estadisticas.apuestasGanadas = (usuario.estadisticas.apuestasGanadas || 0) + 1;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '🎰', key: m.key } });
        const texto = `🎰 *¡GIRÓ LA RULETA!* 🎰\n` +
                      `🎯 La bola cayó en: *#${numeroRuleta} ${colorResultado.toUpperCase()}*\n` +
                      `🎉 ¡FELICIDADES! Duplicaste tu apuesta: *+$${fNum(cantidad)} coins* (≧∇≦)/ 🍰\n` +
                      `👛 *Nuevo balance:* $${fNum(usuario.wallet)} coins`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    } else {
        usuario.wallet -= cantidad;
        usuario.estadisticas.apuestasPerdidas = (usuario.estadisticas.apuestasPerdidas || 0) + 1;
        await actualizarUsuario(usuario);

        await sock.sendMessage(from, { react: { text: '💀', key: m.key } });
        const texto = `🎰 *¡GIRÓ LA RULETA!* 🎰\n` +
                      `🎯 La bola cayó en: *#${numeroRuleta} ${colorResultado.toUpperCase()}*\n` +
                      `💔 Oh no... La casa se queda con tu apuesta: *-$${fNum(cantidad)} coins* (╥﹏╥)\n` +
                      `👛 *Saldo restante:* $${fNum(usuario.wallet)} coins`;
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    }
}

/**
 * -economyboard / -baltop / -eboard [página]
 */
export async function manejarBaltop(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const todos = obtenerTopEconomia();

    const pagina = Math.max(1, parseInt(args[0], 10) || 1);
    const porPagina = 10;
    const totalPaginas = Math.max(1, Math.ceil(todos.length / porPagina));

    const inicio = (pagina - 1) * porPagina;
    const ranking = todos.slice(inicio, inicio + porPagina);

    if (ranking.length === 0) {
        return await sock.sendMessage(from, { text: `No hay usuarios en esta página.` }, { quoted: m });
    }

    let texto = `╭━━━〔 🏆 *RANKING DE MILLONARIOS* 〕━━━╮\n` +
                `┃ Página: ${pagina}/${totalPaginas} | Top Global\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    const menciones = [];
    ranking.forEach((u, i) => {
        const puesto = inicio + i + 1;
        const medalla = puesto === 1 ? '🥇' : (puesto === 2 ? '🥈' : (puesto === 3 ? '🥉' : '🔹'));
        const total = (u.wallet || 0) + (u.banco || 0);
        const tag = u.id.split('@')[0];
        menciones.push(u.id);

        texto += `${medalla} *#${puesto}* @${tag}\n` +
                 `   💵 Total: *$${fNum(total)}* (👛 $${fNum(u.wallet)} | 🏦 $${fNum(u.banco)})\n`;
    });

    texto += `\n_Escribe -baltop [página] para explorar más._ 🍰✨`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: menciones
    }, { quoted: m });
}

/**
 * -economyinfo / -einfo
 */
export async function manejarEconomyInfo(sock, msgInfo) {
    const { m, from, pushName } = msgInfo;
    const actorJid = resolverActor(msgInfo);

    if (!actorJid) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No pude identificar tu usuario de WhatsApp.` }, { quoted: m });
    }

    const u = await obtenerUsuario(actorJid, pushName);
    const est = u.estadisticas || {};

    const texto = `╭━━━〔 📊 *ESTADÍSTICAS DE ECONOMÍA* 〕━━━╮\n` +
                  `┃ 👤 *Usuario:* ${pushName}\n` +
                  `┃ 💼 *Trabajos completados:* ${est.trabajos || 0}\n` +
                  `┃ 🥷 *Crímenes exitosos:* ${est.crimenesExitosos || 0}\n` +
                  `┃ 🚓 *Veces arrestad@:* ${est.crimenesFallidos || 0}\n` +
                  `┃ 🎲 *Apuestas ganadas:* ${est.apuestasGanadas || 0}\n` +
                  `┃ 💔 *Apuestas perdidas:* ${est.apuestasPerdidas || 0}\n` +
                  `┃ 💰 *Robos exitosos:* ${est.robosExitosos || 0}\n` +
                  `┃ 🛡️ *Robos sufridos:* ${est.robosSufridos || 0}\n` +
                  `┃ 🔥 *Racha diaria actual:* ${u.rachaDaily || 0} días\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                  `_¡Sigue progresando para dominar el ranking!_ 🍰🎸`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}
