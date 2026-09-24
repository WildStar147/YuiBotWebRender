# 🎸 Yui Hirasawa - WhatsApp Bot (Edición Render Web Service) 🍰

> Versión adaptada especialmente para alojarse en la nube como un **Web Service en Render**, permitiéndote correr el bot 24/7 sin necesidad de tener tu laptop encendida y controlarlo desde un panel web con código QR en vivo.

---

## ✨ Novedades de esta Versión para Render

1. **🌐 Panel de Control Web y QR en Vivo:**
   - Cumple con el requisito de puerto de Render (`process.env.PORT`).
   - Sirve una página web en `/` donde puedes ver el estado del bot (Conectado / Desconectado) y **escanear el código QR directamente desde la pantalla de tu celular o PC** sin sufrir con la terminal de logs de Render.
2. **🐳 Preparado para Docker (Render Free Tier):**
   - Incluye `Dockerfile` con **Node 20**, **FFmpeg**, **Python3**, **yt-dlp** y fuentes tipográficas preinstaladas.
   - Todos los comandos multimedia (`-s`, `-img`, `-gif`, `-reveal`, `-meme`, `-ytmp3`, `-tiktok`, filtros de audio) funcionan al 100% en la nube.
3. **🔒 Seguridad y Privacidad:**
   - `.gitignore` configurado para que nunca se suban credenciales de WhatsApp ni claves de entorno a GitHub.
4. **🩺 Health Check (`/health`):**
   - Endpoint HTTP 200 para monitoreo y para mantener el contenedor despierto 24/7.

---

## 🚀 Guía Paso a Paso: De tu Computadora a Render

### Paso 1: Subir esta carpeta a tu GitHub

1. Abre una terminal dentro de esta carpeta (`BotBaileys (Copia)`):
   ```bash
   cd "/home/wildstar/Documentos/VSCode/Proyectos/BotBaileys (Copia)"
   ```

2. Inicializa Git (si aún no lo está) y prepara los archivos:
   ```bash
   git init
   git add .
   git commit -m "feat: Yui Bot para Render Web Service"
   ```

3. Crea un repositorio en [GitHub](https://github.com/new) (puede ser **Público** o **Privado**; gracias al `.gitignore`, tus credenciales no se subirán).

4. Vincula y sube los archivos a GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

---

### Paso 2: Crear el Web Service en Render

1. Entra a [Render](https://dashboard.render.com/) e inicia sesión.
2. Haz clic en el botón **New +** (arriba a la derecha) y selecciona **Web Service**.
3. Selecciona **Build and deploy from a Git repository** y conecta tu repositorio de GitHub recién creado.
4. Configura los siguientes campos:
   - **Name:** `yui-bot-whatsapp` (o el nombre que elijas)
   - **Region:** Elige la más cercana (ej. *Oregon (US West)* u *Ohio (US East)*)
   - **Branch:** `main`
   - **Runtime:** Selecciona **Docker** *(Render detectará automáticamente el `Dockerfile`)*
   - **Instance Type:** **Free**
5. En la sección **Environment Variables** (opcional):
   - `GEMINI_API_KEY`: Tu API Key de Google AI Studio (si deseas usar el motor oficial de Gemini).
6. Haz clic en el botón **Create Web Service**.

---

### Paso 3: Escanear el QR desde el Panel Web

1. Render tardará unos 2 a 3 minutos en construir la imagen Docker y levantar el servicio.
2. Una vez que diga **Live**, Render te proporcionará tu URL pública (ejemplo: `https://yui-bot-whatsapp.onrender.com`).
3. Abre esa URL en el navegador de tu computadora o de tu teléfono celular.
4. Verás el **Panel de Control de Yui Hirasawa** con el **Código QR** generado nítidamente en pantalla.
5. En tu teléfono celular:
   - Abre **WhatsApp**.
   - Toca **Menú (⋮)** o **Ajustes (⚙️)** > **Dispositivos vinculados**.
   - Toca **"Vincular un dispositivo"**.
   - Apunta la cámara al código QR de la página web.
6. ¡Listo! La página web se actualizará automáticamente a 🟢 **"¡Bot Conectado y Listo!"** y el bot comenzará a responder en todos tus grupos y chats privados.

---

### Paso 4: Mantener el Bot Activo 24/7 (Evitar suspensión en Render Free)

Los servicios gratuitos de Render entran en suspensión tras 15 minutos sin tráfico web entrante. Para mantener a Yui despierta las 24 horas del día:

1. Crea una cuenta gratuita en [cron-job.org](https://cron-job.org/) o [UptimeRobot](https://uptimerobot.com/).
2. Añade un nuevo monitor HTTP:
   - **URL:** `https://tu-servicio.onrender.com/health`
   - **Intervalo:** Cada **10 minutos**
   - **Método:** `GET`
3. Con este ping regular, Render mantendrá tu bot activo sin suspenderlo.

---

## 💬 Comandos Disponibles

| Categoría | Comando | Descripción |
| :--- | :--- | :--- |
| 🍰 **General** | `-menu` | Muestra la lista interactiva de comandos de Yui |
| 🧠 **IA Yui** | `-yui [mensaje]` | Habla con la waifu Yui Hirasawa (con memoria de chat) |
| 👥 **Métricas**| _Preguntarle a Yui en grupo_ | ¿Cuántas personas hay en el grupo? (Yui recuerda quién ha hablado) |
| 🎨 **Stickers**| `-s` o `-sticker` | Convierte fotos/videos a stickers |
| 🖼️ **Imágenes**| `-img` o `-imagen` | Extrae la imagen original a partir de un sticker |
| 🎞️ **GIFs** | `-gif` | Convierte stickers o videos cortos a formato GIF de WhatsApp |
| 👁️ **Anti-ViewOnce** | `-reveal` | Revela y descarga fotos o videos de una sola vez |
| 🤣 **Memes** | `-meme [arriba] \| [abajo]` | Genera meme con texto clásico sobre una foto |
| 🎵 **Descargas** | `-ytmp3 [enlace/título]` | Descarga música en MP3 con metadatos y portada |
| 🎬 **Videos** | `-ytmp4 [enlace]` | Descarga videos de YouTube en MP4 |
| 📱 **TikTok** | `-tiktok [enlace]` | Descarga videos de TikTok limpios sin marca de agua |
| 🎛️ **Filtros Audio** | `-ardilla`, `-grave`, `-robot`, `-eco`, `-reversa`, `-rapido` | Aplica efectos divertidos a notas de voz citadas |

---

## 🖥️ Nota sobre tu Bot Local en la Laptop

Tu carpeta original `BotBaileys` sigue completamente intacta. Puedes seguir usándola en tu laptop ejecutando `npm start` de forma independiente cuando no desees tener activo el servicio en la nube. ¡Recuerda no tener vinculada la misma cuenta con dos sesiones idénticas activas a la vez para evitar cierres de sesión!
