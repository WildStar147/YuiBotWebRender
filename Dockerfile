# Usamos Node 20 sobre Debian Bookworm Slim
FROM node:20-bookworm-slim

# Instalar dependencias del sistema necesarias:
# - ffmpeg: para procesamiento de audio, notas de voz, stickers animados y memes
# - python3: requerido para ejecuciones auxiliares de yt-dlp
# - curl: para descargar el binario de yt-dlp
# - ca-certificates: certificados SSL actualizados
# - fonts-dejavu-core: fuentes tipográficas para la creación de memes (-meme)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev

# Descargar e instalar el binario actualizado de yt-dlp
RUN mkdir -p bin && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp && \
    chmod a+rx bin/yt-dlp

# Copiar el código fuente completo
COPY . .

# Asegurar existencia de carpeta de autenticación
RUN mkdir -p sesion_auth

# Variables de entorno predeterminadas para Render Web Service
ENV PORT=3000
ENV NODE_ENV=production

# Puerto expuesto para Render
EXPOSE 3000

# Comando de inicio del bot y panel web
CMD ["npm", "start"]
