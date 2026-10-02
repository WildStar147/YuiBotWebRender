import 'dotenv/config';
import { iniciarConexion } from './coneccion.js';
import { iniciarServidorWeb } from './servidorWeb.js';
import { inicializarBinarios } from './binarios.js';
import { inicializarDB } from './database.js';

/**
 * Punto de entrada principal para Yui Bot WhatsApp (Render Web Service)
 */
function imprimirBanner() {
    console.clear();
    console.log(`
  ╭──────────────────────────────────────────────────╮
  │                                                  │
  │    🎸  YUI HIRASAWA - WHATSAPP BOT (BAILEYS) 🍰   │
  │           [ Modo Render Web Service ]            │
  │                                                  │
  │   "¡Divertirse es lo más importante de todo!"     │
  │                                                  │
  │   🪙 Sistema de Economía + 🎴 Gacha de Waifus    │
  │                                                  │
  ╰──────────────────────────────────────────────────╯
    `);
    console.log('🚀 Iniciando servicio del bot en la nube...');
    console.log('🧠 Motor de IA de Yui listo');
    console.log('📦 Verificando servidor web, base de datos y conexión WhatsApp...');
}

// Capturar errores no controlados para mantener la estabilidad del bot
process.on('uncaughtException', (err) => {
    console.error('⚠️ [uncaughtException] Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [unhandledRejection] Promesa rechazada no controlada:', reason);
});

// Inicio del Bot, Servidor Web, DB y verificación de binarios
imprimirBanner();
inicializarDB();
iniciarServidorWeb();
inicializarBinarios().finally(() => {
    iniciarConexion();
});

