# Etapa 1: Build da aplicação usando Node
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de dependência e instala
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# (Opcional) Recebe variáveis de ambiente no momento do build
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Executa o build do Vite (isso vai gerar a pasta /app/dist)
RUN npm run build

# Etapa 2: Servidor Nginx ultra leve para produção
FROM nginx:alpine

# Limpa a pasta padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia a pasta 'dist' do Vite para dentro do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração vital para o React Router (evita o Erro 403 / 404 ao dar F5)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expõe a porta 80 e roda o Nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]