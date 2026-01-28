FROM node:18-alpine

WORKDIR /home/container

# Instalar dependencias del sistema para sqlite3
RUN apk add --no-cache python3 make g++

# Copiar package.json primero para cachear dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Puerto (ajusta si usas otro)
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
