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
│  Signaling:         https://medconnect.nnmc.kz/server-signaling │
│                     (через nginx proxy на порт 1341)         │
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
- **Signaling Server**: `https://medconnect.nnmc.kz/server-signaling`

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
VITE_SIGNALING_SERVER=https://medconnect.nnmc.kz/server-signaling
VITE_APP_NAME=MedConnect
VITE_APP_VERSION=1.0.0
```

## Nginx конфигурация для Signaling Proxy

Если signaling-server на том же сервере, настройте nginx proxy:

```nginx
# В конфигурации medconnect.nnmc.kz
location /server-signaling {
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
```

## Настройка Coolify

### 1. Server (Strapi)

- **Domain**: `medconnectserver.nnmc.kz`
- **Port**: `1340`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment**: См. выше

### 2. Signaling Server

- **Domain**: `medconnect.nnmc.kz` (через proxy path `/server-signaling`)
- **Port**: `1341`
- **Start Command**: `npm start`
- **Environment**: См. выше

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
// - Signaling: https://medconnect.nnmc.kz/server-signaling
```

## Проверка после деплоя

1. ✅ Frontend загружается: `https://medconnect.nnmc.kz`
2. ✅ API работает: `https://medconnectserver.nnmc.kz/api/doctors`
3. ✅ Strapi Admin: `https://medconnectserver.nnmc.kz/admin`
4. ✅ Signaling health: `https://medconnect.nnmc.kz/server-signaling/health`
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
- Проверьте nginx proxy для `/server-signaling`
- Проверьте WebSocket upgrade в nginx
- Проверьте STUN/TURN серверы

