# Deployment Guide для Coolify

## Архитектура доменов

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend:          https://medconnect.nnmc.kz               │
│                                                              │
│  Strapi API:        https://medconnectserver.nnmc.kz         │
│                                                              │
│  Signaling:         https://medconnectrtc.nnmc.kz            │
│                     (отдельный домен для WebRTC)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Порты для локальной разработки

- **Server (Strapi)**: `1340`
- **Signaling Server**: `1341`
- **Frontend**: `5173` (Vite dev) или `1342` (preview)

## Домены для продакшна

- **Frontend**: `https://medconnect.nnmc.kz`
- **Server (Strapi)**: `https://medconnectserver.nnmc.kz`
- **Signaling Server**: `https://medconnectrtc.nnmc.kz`

## Настройка переменных окружения

### Server (Strapi) - .env

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=1340
SERVER_URL=https://medconnectserver.nnmc.kz

# Database (настройте под вашу БД)
DATABASE_CLIENT=sqlite
# или для PostgreSQL:
# DATABASE_CLIENT=postgres
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=strapi
# DATABASE_USERNAME=strapi
# DATABASE_PASSWORD=your_password

# Strapi Security Keys (сгенерируйте уникальные значения)
APP_KEYS=your-app-keys-here
API_TOKEN_SALT=your-api-token-salt-here
ADMIN_JWT_SECRET=your-admin-jwt-secret-here
TRANSFER_TOKEN_SALT=your-transfer-token-salt-here
ENCRYPTION_KEY=your-encryption-key-here
```

### Signaling Server - .env

```env
NODE_ENV=production
PORT=1341
FRONTEND_URL=https://medconnect.nnmc.kz
```

### Frontend - .env.production

```env
VITE_API_URL=https://medconnectserver.nnmc.kz
VITE_SIGNALING_SERVER=https://medconnectrtc.nnmc.kz
VITE_TURN_URL=turn:medconnect.nnmc.kz:3478
VITE_TURN_USERNAME=medconnect
VITE_TURN_CREDENTIAL=medconnect2026
VITE_APP_NAME=MedConnect
VITE_APP_VERSION=1.0.0
```

## Установка coturn (TURN relay)

Если звонок работает в одной сети, но не работает между разными сетями, нужен рабочий TURN relay.

### 1) Установка пакета

```bash
sudo apt update
sudo apt install coturn -y
```

### 2) Включение сервиса

В файле `/etc/default/coturn`:

```bash
TURNSERVER_ENABLED=1
```

### 3) Базовый конфиг `/etc/turnserver.conf`

```conf
listening-port=3478
tls-listening-port=5349

realm=medconnect.nnmc.kz
server-name=medconnect.nnmc.kz

lt-cred-mech
user=medconnect:medconnect2026

fingerprint
no-multicast-peers
no-cli

# Укажите реальный публичный IP сервера:
external-ip=YOUR_SERVER_PUBLIC_IP

# Диапазон relay-портов:
min-port=49152
max-port=65535

log-file=/var/log/turnserver.log
verbose
```

Для `turns:` (TLS) добавьте сертификаты:

```conf
cert=/etc/letsencrypt/live/medconnect.nnmc.kz/fullchain.pem
pkey=/etc/letsencrypt/live/medconnect.nnmc.kz/privkey.pem
```

### 4) Открытие портов в firewall

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

### 5) Запуск и проверка

```bash
sudo systemctl restart coturn
sudo systemctl enable coturn
sudo systemctl status coturn
```

После этого пересоберите frontend, чтобы подхватились актуальные `VITE_TURN_*`.

## Nginx конфигурация для Signaling Server

Для отдельного домена `medconnectrtc.nnmc.kz`:

```nginx
server {
    listen 443 ssl http2;
    server_name medconnectrtc.nnmc.kz;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:1341;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout
        proxy_read_timeout 86400;
    }
}
```

## Настройка Coolify

### 1. Server (Strapi)

- **Domain**: `medconnectserver.nnmc.kz`
- **Port**: `1340`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment**: См. выше

### 2. Signaling Server

- **Domain**: `medconnectrtc.nnmc.kz`
- **Port**: `1341`
- **Start Command**: `npm start`
- **Environment**: См. выше
- **ВАЖНО**: Включите поддержку WebSocket в настройках Coolify

### 3. Frontend

- **Domain**: `medconnect.nnmc.kz`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- Статический сайт - используйте nginx или Coolify static hosting

## Автоматическое определение окружения

Код автоматически определяет production по hostname:

```javascript
// Frontend: если hostname === 'medconnect.nnmc.kz'
// автоматически используется:
// - API: https://medconnectserver.nnmc.kz
// - Signaling: https://medconnectrtc.nnmc.kz
```

## Проверка после деплоя

1. ✅ Frontend загружается: `https://medconnect.nnmc.kz`
2. ✅ API работает: `https://medconnectserver.nnmc.kz/api/doctors`
3. ✅ Strapi Admin: `https://medconnectserver.nnmc.kz/admin`
4. ✅ Signaling health: `https://medconnectrtc.nnmc.kz/health`
5. ✅ Нет CORS ошибок в консоли браузера
6. ✅ Видеозвонки работают (WebRTC через signaling)

## Частые проблемы

### CORS ошибки
- Проверьте, что в `server/config/middlewares.ts` указаны правильные домены
- Проверьте, что в `signaling-server/server.js` указаны правильные домены

### API недоступен
- Проверьте, что Strapi запущен и доступен
- Проверьте SSL сертификаты

### WebRTC не работает
- Проверьте, что домен `medconnectrtc.nnmc.kz` настроен
- Проверьте WebSocket upgrade в nginx/Coolify
- Проверьте STUN/TURN серверы
- Убедитесь, что в настройках Coolify включена поддержка WebSocket
