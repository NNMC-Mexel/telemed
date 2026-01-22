# Deployment Guide для Coolify

## Порты для локальной разработки

- **Server (Strapi)**: `1340`
- **Signaling Server**: `1341`
- **Frontend**: `1342`

## Домены для продакшна

В продакшн режиме сервисы автоматически переключаются на следующие домены:

- **Server (Strapi)**: `https://medconnectserver.nnmc.kz`
- **Signaling Server**: `https://medconnect.nnmc.kz/server-signaling`
- **Frontend**: `https://medconnect.nnmc.kz`

**Важно**: В продакшне порты не указываются, так как домены будут проксировать запросы через Coolify.

## Настройка переменных окружения

### Server (Strapi)

Создайте файл `.env` в папке `server/`:

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

### Signaling Server

Создайте файл `.env` в папке `signaling-server/`:

```env
NODE_ENV=production
PORT=1341
FRONTEND_URL=https://medconnect.nnmc.kz
```

### Frontend

Создайте файл `.env` в папке `frontend/` (опционально, в продакшн режиме автоматически используется домен):

```env
# В продакшн режиме эти переменные не нужны - автоматически используется домен
# Для разработки можно указать:
VITE_API_URL=http://localhost:1340
VITE_SIGNALING_SERVER=http://localhost:1341
```

## Настройка Coolify

### 1. Server (Strapi)

- **Port**: `1340` (локально)
- **Domain (production)**: `https://medconnectserver.nnmc.kz`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment**: Установите переменные из `server/.env`

### 2. Signaling Server

- **Port**: `1341` (локально)
- **Domain (production)**: `https://medconnect.nnmc.kz/server-signaling`
- **Start Command**: `npm start`
- **Environment**: Установите переменные из `signaling-server/.env`

### 3. Frontend

- **Port**: `1342` (локально)
- **Domain (production)**: `https://medconnect.nnmc.kz`
- **Build Command**: `npm run build`
- **Start Command**: `npm run preview` (или используйте nginx для статики)
- **Environment**: В продакшн режиме переменные не обязательны

## Автоматическое переключение на домены

Все сервисы автоматически определяют продакшн режим по переменной `NODE_ENV=production` и переключаются на соответствующие домены.

### Что происходит автоматически:

1. **Server (Strapi)**:
   - В локальной разработке: порт `1340`, URL `http://localhost:1340`
   - В продакшне: используется домен `https://medconnectserver.nnmc.kz`
   - CORS настраивается для основного домена `https://medconnect.nnmc.kz` в продакшн режиме

2. **Signaling Server**:
   - В локальной разработке: порт `1341`, URL `http://localhost:1341`
   - В продакшне: используется домен `https://medconnect.nnmc.kz/server-signaling`
   - CORS настраивается для основного домена `https://medconnect.nnmc.kz` в продакшн режиме

3. **Frontend**:
   - В локальной разработке: порт `1342`, API URL `http://localhost:1340`
   - В продакшне: API URL автоматически становится `https://medconnectserver.nnmc.kz`
   - Signaling Server URL автоматически становится `https://medconnect.nnmc.kz/server-signaling`

## Проверка после деплоя

1. Убедитесь, что все три сервиса запущены на правильных портах
2. Проверьте, что CORS настроен правильно (в консоли браузера не должно быть ошибок CORS)
3. Проверьте, что API запросы идут на правильный домен
4. Проверьте, что WebRTC соединения работают (signaling server)

## Примечания

- В режиме разработки (`NODE_ENV=development` или без установки `NODE_ENV`) используются порты 1340, 1341, 1342 и localhost
- Все домены должны быть настроены в Coolify для проксирования на соответствующие порты:
  - `https://medconnectserver.nnmc.kz` → Strapi сервер (порт 1340)
  - `https://medconnect.nnmc.kz/server-signaling` → Signaling сервер (порт 1341)
  - `https://medconnect.nnmc.kz` → Frontend (порт 1342)
- Убедитесь, что SSL сертификаты настроены для доменов `medconnect.nnmc.kz` и `medconnectserver.nnmc.kz`
