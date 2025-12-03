FROM node:18-alpine

WORKDIR /app

# Nhận biến API_HOST từ docker-compose
ARG VITE_API_HOST=localhost
ENV VITE_API_HOST=$VITE_API_HOST

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
