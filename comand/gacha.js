import {
    obtenerUsuario,
    actualizarUsuario,
    obtenerTopHarem,
    establecerRolloActivo,
    obtenerRolloActivo,
    marcarRolloReclamado,
    buscarDuenioWaifu,
    obtenerMercado,
    agregarVentaMercado,
    removerVentaMercado
} from './database.js';
import {
    obtenerWaifuAleatoria,
    buscarWaifuPorNombre,
    obtenerCatalogoCompleto,
    obtenerListaSeries
} from './catalogoWaifus.js';

const COOLDOWN_ROLL = 15 * 60 * 1000; // 15 minutos
const COOLDOWN_VOTO = 12 * 60 * 60 * 1000; // 12 horas

function fNum(n) {
    return (n || 0).toLocaleString('es-MX');
}

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
 * -roll / -rw / -rollwaifu / -waifu
 */
export async function manejarRoll(sock, msgInfo) {
    const { m, from, sender, pushName } = msgInfo;
    const usuario = await obtenerUsuario(sender || from, pushName);

    const ahora = Date.now();
    const tiempoPasado = ahora - (usuario.ultimoRoll || 0);

    if (tiempoPasado < COOLDOWN_ROLL) {
        const restante = COOLDOWN_ROLL - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa, ${pushName}! Ya hiciste tu ruleta de waifus hace poco.\n` +
                  `⏳ *Podrás girar de nuevo en:* ${formatoTiempo(restante)} 🍰✨`
        }, { quoted: m });
    }

    const waifu = await obtenerWaifuAleatoria();
    if (!waifu) {
        return await sock.sendMessage(from, { text: `(╥﹏╥) No se pudo cargar el catálogo de waifus.` }, { quoted: m });
    }

    usuario.ultimoRoll = ahora;
    await actualizarUsuario(usuario);

    // Guardar rollo activo en el chat
    establecerRolloActivo(from, waifu);

    // Verificar si ya tiene dueño global
    const infoDuenio = buscarDuenioWaifu(waifu.id, waifu.nombre);

    let estadoTexto = '';
    const menciones = [];

    if (infoDuenio) {
        const duenioTag = infoDuenio.duenio.id.split('@')[0];
        menciones.push(infoDuenio.duenio.id);
        estadoTexto = `🔒 *Estado:* Reclamada por @${duenioTag} 💍`;
    } else {
        estadoTexto = `🔓 *Estado:* ¡LIBRE! Escribe *-claim* o *-c* en menos de 60s para reclamarla 💖`;
    }

    const caption = `╭━━━〔 🎴 *RULETA GACHA* 〕━━━╮\n` +
                    `┃ 🌸 *Personaje:* *${waifu.nombre}*\n` +
                    `┃ 📺 *Anime:* ${waifu.anime}\n` +
                    `┃ ✨ *Rareza:* ${waifu.rareza} (${waifu.estrellas})\n` +
                    `┃ 💰 *Valor:* $${fNum(waifu.valor)} coins\n` +
                    `┃ ${estadoTexto}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                    `_Giro realizado por ${pushName}_ 🍰🎸`;

    await sock.sendMessage(from, { react: { text: '🎴', key: m.key } });

    if (waifu.imagen) {
        try {
            await sock.sendMessage(from, {
                image: { url: waifu.imagen },
                caption,
                mentions: menciones
            }, { quoted: m });
            return;
        } catch (e) {
            console.warn('Error enviando imagen de waifu:', e.message);
        }
    }

    await sock.sendMessage(from, { text: caption, mentions: menciones }, { quoted: m });
}

/**
 * -claim / -c / -reclamar [nombre]
 */
export async function manejarClaim(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const rollo = obtenerRolloActivo(from);

    if (!rollo || rollo.reclamado) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¡Uwaaa! No hay ninguna waifu activa en este chat para reclamar o ya expiró el tiempo.\n` +
                  `👉 Usa *-roll* para girar una nueva waifu. 🎴✨`
        }, { quoted: m });
    }

    const waifu = rollo.waifu;

    // Verificar si ya tiene dueño
    const infoDuenio = buscarDuenioWaifu(waifu.id, waifu.nombre);
    if (infoDuenio) {
        const duenioTag = infoDuenio.duenio.id.split('@')[0];
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) ¡Muy tarde! *${waifu.nombre}* ya pertenece al harem de @${duenioTag}.`,
            mentions: [infoDuenio.duenio.id]
        }, { quoted: m });
    }

    // Agregar al harem del usuario
    const usuario = await obtenerUsuario(sender || from, pushName);
    const itemHarem = {
        id: waifu.id,
        nombre: waifu.nombre,
        anime: waifu.anime,
        genero: waifu.genero,
        imagen: waifu.imagen,
        rareza: waifu.rareza,
        estrellas: waifu.estrellas,
        valor: waifu.valor,
        fechaObtencion: Date.now()
    };

    usuario.harem.push(itemHarem);
    marcarRolloReclamado(from);
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '💍', key: m.key } });

    let mensajeReclamo = usuario.claimMsg
        ? `\n💬 _"${usuario.claimMsg}"_`
        : `\n_¡Ahora cuidará con mucho amor de su nuevo amor platónico! Ehehe~_ 🍰`;

    const texto = `╭━━━〔 💍 *¡WAIFU RECLAMADA!* 〕━━━╮\n` +
                  `┃ 🎉 ¡Felicidades, *${pushName}*!\n` +
                  `┃ Has añadido a *${waifu.nombre}* (${waifu.anime}) a tu harem.\n` +
                  `┃ ✨ *Rareza:* ${waifu.rareza}\n` +
                  `┃ 💰 *Valor aportado:* +$${fNum(waifu.valor)} coins\n` +
                  `┃ 📚 *Total en tu harem:* ${usuario.harem.length} waifus\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━━╯` +
                  mensajeReclamo;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -harem / -waifus / -claims [@mención] [página]
 */
export async function manejarHarem(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = quoted || (mentioned.length > 0 ? mentioned[0] : (sender || from));

    const esPropio = targetJid === (sender || from);
    const usuario = await obtenerUsuario(targetJid, esPropio ? pushName : 'Usuario');

    const paginaArg = args.find(a => !a.startsWith('@') && !isNaN(parseInt(a, 10)));
    const pagina = Math.max(1, parseInt(paginaArg, 10) || 1);

    const harem = usuario.harem || [];
    if (harem.length === 0) {
        return await sock.sendMessage(from, {
            text: esPropio
                ? `(•́ω•̀)? ¡Uwaaa, ${pushName}! Aún no tienes ningún personaje en tu harem.\n👉 Usa *-roll* para girar la ruleta y *-claim* para reclamar.`
                : `Este usuario no tiene ningún personaje en su harem aún.`
        }, { quoted: m });
    }

    const porPagina = 8;
    const totalPaginas = Math.ceil(harem.length / porPagina);
    const inicio = (pagina - 1) * porPagina;
    const seleccion = harem.slice(inicio, inicio + porPagina);

    const valorTotal = harem.reduce((acc, w) => acc + (w.valor || 0), 0);
    const tag = targetJid.split('@')[0];

    let texto = `╭━━━〔 🌸 *HAREM DE WAIFUS* 〕━━━╮\n` +
                `┃ 👤 *Dueño:* @${tag}\n` +
                `┃ 🎎 *Personajes:* ${harem.length} | 💰 *Valor Total:* $${fNum(valorTotal)} coins\n` +
                `┃ 📄 *Página:* ${pagina}/${totalPaginas}\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    seleccion.forEach((w, i) => {
        texto += `*${inicio + i + 1}.* *${w.nombre}* [${w.estrellas || '⭐'}]\n` +
                 `   📺 _${w.anime}_ | 💎 $${fNum(w.valor)} coins\n`;
    });

    texto += `\n_Para ver más páginas escribe: -harem ${pagina + 1}_ 🍰✨`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: [targetJid]
    }, { quoted: m });
}

/**
 * -charinfo / -winfo / -waifuinfo [nombre]
 */
export async function manejarCharInfo(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const busqueda = args.join(' ').trim();

    if (!busqueda) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Ingresa el nombre del personaje que deseas buscar.\n👉 *Ejemplo:* *-winfo Yui Hirasawa*`
        }, { quoted: m });
    }

    const waifu = await buscarWaifuPorNombre(busqueda);
    if (!waifu) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No encontré a ningún personaje llamado "*${busqueda}*" en el catálogo.`
        }, { quoted: m });
    }

    const infoDuenio = buscarDuenioWaifu(waifu.id, waifu.nombre);
    let duenioTexto = '🔓 *Libre para reclamar en ruletas*';
    const menciones = [];

    if (infoDuenio) {
        menciones.push(infoDuenio.duenio.id);
        duenioTexto = `💍 *Dueño:* @${infoDuenio.duenio.id.split('@')[0]}`;
    }

    const caption = `╭━━━〔 ℹ️ *INFORMACIÓN DE PERSONAJE* 〕━━━╮\n` +
                    `┃ 🌸 *Nombre:* *${waifu.nombre}*\n` +
                    `┃ 📺 *Anime:* ${waifu.anime}\n` +
                    `┃ ⚧ *Género:* ${waifu.genero || 'Femenino'}\n` +
                    `┃ ✨ *Rareza:* ${waifu.rareza} (${waifu.estrellas})\n` +
                    `┃ 💰 *Valor de mercado:* $${fNum(waifu.valor)} coins\n` +
                    `┃ ❤️ *Favoritos globales:* ${fNum(waifu.favoritos || 0)}\n` +
                    `┃ ${duenioTexto}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    if (waifu.imagen) {
        try {
            await sock.sendMessage(from, {
                image: { url: waifu.imagen },
                caption,
                mentions: menciones
            }, { quoted: m });
            return;
        } catch (e) {}
    }

    await sock.sendMessage(from, { text: caption, mentions: menciones }, { quoted: m });
}

/**
 * -charimage / -cimage [nombre]
 */
export async function manejarCharImage(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const busqueda = args.join(' ').trim();

    if (!busqueda) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Escribe el nombre del personaje para ver su foto.\n👉 *Ejemplo:* *-cimage Marin Kitagawa*`
        }, { quoted: m });
    }

    const waifu = await buscarWaifuPorNombre(busqueda);
    if (!waifu || !waifu.imagen) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No encontré la imagen de "*${busqueda}*".`
        }, { quoted: m });
    }

    await sock.sendMessage(from, {
        image: { url: waifu.imagen },
        caption: `🌸 *${waifu.nombre}* (${waifu.anime}) ✨`
    }, { quoted: m });
}

/**
 * -givechar / -givewaifu / -regalar [@mención] [nombre]
 */
export async function manejarGiveChar(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = quoted || (mentioned.length > 0 ? mentioned[0] : null);

    const nombrePersonaje = args.filter(a => !a.startsWith('@')).join(' ').trim();

    if (!targetJid || !nombrePersonaje) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Para regalar un personaje a un amigo:\n👉 *Uso:* *-regalar @usuario [nombre personaje]*\n👉 *Ejemplo:* *-regalar @amigo Yui Hirasawa*`
        }, { quoted: m });
    }

    if (targetJid === (sender || from)) {
        return await sock.sendMessage(from, { text: `¡No te puedes regalar un personaje a ti mism@! (≧∇≦)/` }, { quoted: m });
    }

    const remitente = await obtenerUsuario(sender || from, pushName);
    const index = (remitente.harem || []).findIndex(w => w.nombre.toLowerCase().includes(nombrePersonaje.toLowerCase()));

    if (index === -1) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes a "*${nombrePersonaje}*" en tu harem.`
        }, { quoted: m });
    }

    const waifuRegalada = remitente.harem.splice(index, 1)[0];
    const receptor = await obtenerUsuario(targetJid, 'Receptor');
    receptor.harem.push(waifuRegalada);

    await actualizarUsuario(remitente);
    await actualizarUsuario(receptor);

    await sock.sendMessage(from, { react: { text: '🎁', key: m.key } });

    const texto = `🎁 *¡REGALO DE PERSONAJE!* 🌸✨\n` +
                  `@${(sender || from).split('@')[0]} le regaló con mucho amor a *${waifuRegalada.nombre}* (${waifuRegalada.anime}) a @${targetJid.split('@')[0]} 💕\n` +
                  `_¡Cuídala muy bien! Ehehe~_ 🍰`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: [sender || from, targetJid]
    }, { quoted: m });
}

/**
 * -giveallharem [@mención]
 */
export async function manejarGiveAllHarem(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = quoted || (mentioned.length > 0 ? mentioned[0] : null);

    if (!targetJid || targetJid === (sender || from)) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Debes etiquetar a quién le transferirás todo tu harem.\n👉 *Ejemplo:* *-giveallharem @amigo*`
        }, { quoted: m });
    }

    const remitente = await obtenerUsuario(sender || from, pushName);
    if (!remitente.harem || remitente.harem.length === 0) {
        return await sock.sendMessage(from, { text: `No tienes ningún personaje para transferir.` }, { quoted: m });
    }

    const receptor = await obtenerUsuario(targetJid, 'Receptor');
    const cantidad = remitente.harem.length;

    receptor.harem.push(...remitente.harem);
    remitente.harem = [];

    await actualizarUsuario(remitente);
    await actualizarUsuario(receptor);

    await sock.sendMessage(from, {
        text: `📦 *¡HAREM TRANSFERIDO POR COMPLETO!*\n` +
              `@${(sender || from).split('@')[0]} le transfirió sus *${cantidad} personajes* a @${targetJid.split('@')[0]} 💍✨`,
        mentions: [sender || from, targetJid]
    }, { quoted: m });
}

/**
 * -deletewaifu / -delwaifu [nombre]
 */
export async function manejarDeleteWaifu(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const nombrePersonaje = args.join(' ').trim();

    if (!nombrePersonaje) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Escribe el nombre del personaje que deseas liberar de tu harem.\n` +
                  `Recibirás el 50% de su valor en coins como compensación.\n` +
                  `👉 *Ejemplo:* *-delwaifu Aqua*`
        }, { quoted: m });
    }

    const usuario = await obtenerUsuario(sender || from, pushName);
    const index = (usuario.harem || []).findIndex(w => w.nombre.toLowerCase().includes(nombrePersonaje.toLowerCase()));

    if (index === -1) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes a "*${nombrePersonaje}*" en tu harem.`
        }, { quoted: m });
    }

    const waifu = usuario.harem.splice(index, 1)[0];
    const reembolso = Math.floor((waifu.valor || 200) * 0.5);
    usuario.wallet = (usuario.wallet || 0) + reembolso;

    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '🕊️', key: m.key } });

    const texto = `🕊️ *¡Personaje liberado!*\n` +
                  `Dejaste libre a *${waifu.nombre}* de tu harem.\n` +
                  `💵 *Recibiste:* +$${fNum(reembolso)} coins (50% de su valor)\n` +
                  `👛 *Wallet:* $${fNum(usuario.wallet)} coins 🍰`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -sell / -vender [precio] [nombre]
 */
export async function manejarSell(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const precioArg = args[0];
    const precio = parseInt(precioArg, 10);
    const nombrePersonaje = args.slice(1).join(' ').trim();

    if (isNaN(precio) || precio <= 0 || !nombrePersonaje) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Para vender un personaje en la tienda:\n` +
                  `👉 *Uso:* *-vender [precio] [nombre]*\n` +
                  `👉 *Ejemplo:* *-vender 1500 Mio Akiyama* 🛍️`
        }, { quoted: m });
    }

    const usuario = await obtenerUsuario(sender || from, pushName);
    const index = (usuario.harem || []).findIndex(w => w.nombre.toLowerCase().includes(nombrePersonaje.toLowerCase()));

    if (index === -1) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes a "*${nombrePersonaje}*" en tu harem para venderla.`
        }, { quoted: m });
    }

    const waifu = usuario.harem.splice(index, 1)[0];
    await actualizarUsuario(usuario);

    const venta = {
        idVenta: 'V_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        vendedorId: sender || from,
        vendedorNombre: pushName,
        precio,
        waifu,
        fecha: Date.now()
    };

    await agregarVentaMercado(venta);

    await sock.sendMessage(from, { react: { text: '🏷️', key: m.key } });

    const texto = `🏷️ *¡PERSONAJE PUESTO A LA VENTA!* 🛍️\n` +
                  `🌸 *Personaje:* *${waifu.nombre}* (${waifu.anime})\n` +
                  `💵 *Precio fijado:* $${fNum(precio)} coins\n` +
                  `🛒 Cualquiera puede comprarla ahora en *-tienda* con *-comprar ${waifu.nombre}* ✨`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -buychar / -buycharacter / -comprar [nombre]
 */
export async function manejarBuyChar(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const busqueda = args.join(' ').trim().toLowerCase();

    if (!busqueda) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Escribe el nombre del personaje que deseas comprar de la tienda.\n👉 *Ejemplo:* *-comprar Mio Akiyama*`
        }, { quoted: m });
    }

    const mercado = obtenerMercado();
    const venta = mercado.find(v => v.waifu.nombre.toLowerCase().includes(busqueda));

    if (!venta) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No hay nadie vendiendo a "*${busqueda}*" en la tienda. Revisa *-tienda*.`
        }, { quoted: m });
    }

    if (venta.vendedorId === (sender || from)) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? No puedes comprar tu propio personaje. Usa *-removesale ${venta.waifu.nombre}* si deseas recuperarla.`
        }, { quoted: m });
    }

    const comprador = await obtenerUsuario(sender || from, pushName);
    if ((comprador.wallet || 0) < venta.precio) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes suficientes coins en tu Wallet ($${fNum(comprador.wallet)}). El precio es de *$${fNum(venta.precio)}* coins.`
        }, { quoted: m });
    }

    // Pagar al vendedor
    comprador.wallet -= venta.precio;
    comprador.harem.push(venta.waifu);

    const vendedor = await obtenerUsuario(venta.vendedorId, venta.vendedorNombre);
    vendedor.wallet = (vendedor.wallet || 0) + venta.precio;

    await removerVentaMercado(venta.idVenta);
    await actualizarUsuario(comprador);
    await actualizarUsuario(vendedor);

    await sock.sendMessage(from, { react: { text: '🎉', key: m.key } });

    const texto = `🎉 *¡COMPRA EXITOSA!* 🛍️💖\n` +
                  `*${pushName}* compró a *${venta.waifu.nombre}* por *$${fNum(venta.precio)} coins*.\n` +
                  `👤 *Vendedor:* @${venta.vendedorId.split('@')[0]} ha recibido el pago.\n` +
                  `👛 *Tu nuevo saldo:* $${fNum(comprador.wallet)} coins ✨`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: [venta.vendedorId]
    }, { quoted: m });
}

/**
 * -haremshop / -tiendawaifus / -wshop [página]
 */
export async function manejarHaremShop(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const mercado = obtenerMercado();

    if (!mercado || mercado.length === 0) {
        return await sock.sendMessage(from, {
            text: `🛍️ *TIENDA DE WAIFUS* 🛍️\n\nActualmente no hay personajes en venta.\n¡Pon uno a la venta con *-vender [precio] [nombre]*! 🍰✨`
        }, { quoted: m });
    }

    const pagina = Math.max(1, parseInt(args[0], 10) || 1);
    const porPagina = 6;
    const totalPaginas = Math.ceil(mercado.length / porPagina);
    const inicio = (pagina - 1) * porPagina;
    const seleccion = mercado.slice(inicio, inicio + porPagina);

    let texto = `╭━━━〔 🛍️ *TIENDA DE WAIFUS EN VENTA* 〕━━━╮\n` +
                `┃ Página: ${pagina}/${totalPaginas} | ${mercado.length} en venta\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    const menciones = [];
    seleccion.forEach((v, i) => {
        menciones.push(v.vendedorId);
        texto += `*${inicio + i + 1}.* *${v.waifu.nombre}* [${v.waifu.estrellas}]\n` +
                 `   📺 _${v.waifu.anime}_\n` +
                 `   💵 *Precio:* $${fNum(v.precio)} coins\n` +
                 `   👤 *Vendedor:* @${v.vendedorId.split('@')[0]}\n\n`;
    });

    texto += `_Compra con: -comprar [nombre]_ 🍰`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: menciones
    }, { quoted: m });
}

/**
 * -removesale / -removerventa [nombre]
 */
export async function manejarRemoveSale(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const busqueda = args.join(' ').trim().toLowerCase();

    if (!busqueda) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Escribe el nombre del personaje que deseas quitar de la venta.\n👉 *Ejemplo:* *-removerventa Mio Akiyama*`
        }, { quoted: m });
    }

    const mercado = obtenerMercado();
    const venta = mercado.find(v => v.vendedorId === (sender || from) && v.waifu.nombre.toLowerCase().includes(busqueda));

    if (!venta) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No tienes a ningún personaje en venta con el nombre "*${busqueda}*".`
        }, { quoted: m });
    }

    const usuario = await obtenerUsuario(sender || from, pushName);
    usuario.harem.push(venta.waifu);

    await removerVentaMercado(venta.idVenta);
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, {
        text: `↩️ *${venta.waifu.nombre}* ha sido retirada del mercado y devuelta a tu harem. 🌸`
    }, { quoted: m });
}

/**
 * -topwaifus / -waifusboard / -wtop [página]
 */
export async function manejarWaifusTop(sock, msgInfo, args) {
    const { m, from } = msgInfo;
    const top = obtenerTopHarem();

    if (top.length === 0) {
        return await sock.sendMessage(from, { text: `Aún no hay coleccionistas de waifus registrados.` }, { quoted: m });
    }

    const pagina = Math.max(1, parseInt(args[0], 10) || 1);
    const porPagina = 10;
    const totalPaginas = Math.ceil(top.length / porPagina);
    const inicio = (pagina - 1) * porPagina;
    const ranking = top.slice(inicio, inicio + porPagina);

    let texto = `╭━━━〔 👑 *TOP COLECCIONISTAS DE WAIFUS* 〕━━━╮\n` +
                `┃ Página: ${pagina}/${totalPaginas} | Por Valor de Harem\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    const menciones = [];
    ranking.forEach((u, i) => {
        const puesto = inicio + i + 1;
        const medalla = puesto === 1 ? '🥇' : (puesto === 2 ? '🥈' : (puesto === 3 ? '🥉' : '🔹'));
        menciones.push(u.id);

        texto += `${medalla} *#${puesto}* @${u.id.split('@')[0]}\n` +
                 `   🎎 Harem: *${u.cantidadWaifus}* | 💎 Valor: *$${fNum(u.valorTotal)} coins*\n`;
    });

    texto += `\n_¡Compite coleccionando waifus con -roll y -claim!_ 🍰✨`;

    await sock.sendMessage(from, {
        text: texto,
        mentions: menciones
    }, { quoted: m });
}

/**
 * -vote / -votar [nombre]
 */
export async function manejarVote(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const busqueda = args.join(' ').trim();

    if (!busqueda) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? ¿Por qué personaje deseas votar?\n👉 *Ejemplo:* *-votar Yui Hirasawa*`
        }, { quoted: m });
    }

    const usuario = await obtenerUsuario(sender || from, pushName);
    const ahora = Date.now();
    const tiempoPasado = ahora - (usuario.ultimoVoto || 0);

    if (tiempoPasado < COOLDOWN_VOTO) {
        const restante = COOLDOWN_VOTO - tiempoPasado;
        return await sock.sendMessage(from, {
            text: `⏳ Ya votaste recientemente. Podrás votar de nuevo en: *${formatoTiempo(restante)}* 🕒`
        }, { quoted: m });
    }

    const waifu = await buscarWaifuPorNombre(busqueda);
    if (!waifu) {
        return await sock.sendMessage(from, {
            text: `(╥﹏╥) No encontré a "*${busqueda}*" en el catálogo.`
        }, { quoted: m });
    }

    usuario.ultimoVoto = ahora;
    usuario.wallet = (usuario.wallet || 0) + 150; // Recompensa por votar
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, { react: { text: '💖', key: m.key } });

    const texto = `💖 *¡VOTO REGISTRADO!* 🌸✨\n` +
                  `Votaste por *${waifu.nombre}* (${waifu.anime}). ¡Su popularidad sigue subiendo!\n` +
                  `🪙 *Recompensa por votar:* +$150 coins\n` +
                  `👛 *Wallet:* $${fNum(usuario.wallet)} coins (≧∇≦)/ 🍓`;

    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

/**
 * -setclaimmsg [texto]
 */
export async function manejarSetClaimMsg(sock, msgInfo, args) {
    const { m, from, sender, pushName } = msgInfo;
    const nuevoMensaje = args.join(' ').trim();

    if (!nuevoMensaje) {
        return await sock.sendMessage(from, {
            text: `(•́ω•̀)? Escribe el mensaje personalizado que quieres que aparezca cuando reclames un personaje.\n👉 *Ejemplo:* *-setclaim ¡Es la reina de mi corazón!*`
        }, { quoted: m });
    }

    const usuario = await obtenerUsuario(sender || from, pushName);
    usuario.claimMsg = nuevoMensaje;
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, {
        text: `✨ *¡Mensaje de reclamo personalizado guardado!*\nAparecerá cuando reclames una waifu:\n💬 _"${nuevoMensaje}"_ 🍰`
    }, { quoted: m });
}

/**
 * -delclaimmsg
 */
export async function manejarDelClaimMsg(sock, msgInfo) {
    const { m, from, sender, pushName } = msgInfo;
    const usuario = await obtenerUsuario(sender || from, pushName);
    usuario.claimMsg = '';
    await actualizarUsuario(usuario);

    await sock.sendMessage(from, {
        text: `🗑️ Tu mensaje de reclamo personalizado ha sido restablecido al valor predeterminado.`
    }, { quoted: m });
}
