# Deployment Guide для Coolify

## Порты для локальной разработки

- **Server (Strapi)**: `1337`
- **Signaling Server**: `3001`
- **Frontend**: `3000`

## Домен для продакшна

В продакшн режиме все сервисы автоматически переключаются на домен: `https://medconnect.nnmc.kz`

**Важно**: В продакшне порты не указываются, так как домен будет проксировать запросы через Coolify.

## Настройка переменных окружения

### Server (Strapi)

Создайте файл `.env` в папке `server/`:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
SERVER_URL=https://medconnect.nnmc.kz

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
PORT=3001
FRONTEND_URL=https://medconnect.nnmc.kz
```

### Frontend

Создайте файл `.env` в папке `frontend/` (опционально, в продакшн режиме автоматически используется домен):

```env
# В продакшн режиме эти переменные не нужны - автоматически используется домен
# Для разработки можно указать:
VITE_API_URL=http://localhost:1337
VITE_SIGNALING_SERVER=http://localhost:3001
```

## Настройка Coolify

### 1. Server (Strapi)

- **Port**: `1337` (локально) или настройте проксирование через домен в Coolify
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment**: Установите переменные из `server/.env`

### 2. Signaling Server

- **Port**: `3001` (локально) или настройте проксирование через домен в Coolify
- **Start Command**: `npm start`
- **Environment**: Установите переменные из `signaling-server/.env`

### 3. Frontend

- **Port**: `3000` (локально) или настройте проксирование через домен в Coolify
- **Build Command**: `npm run build`
- **Start Command**: `npm run preview` (или используйте nginx для статики)
- **Environment**: В продакшн режиме переменные не обязательны

## Автоматическое переключение на домены

Все сервисы автоматически определяют продакшн режим по переменной `NODE_ENV=production` и переключаются на домен `https://medconnect.nnmc.kz`.

### Что происходит автоматически:

1. **Server (Strapi)**:
   - В локальной разработке: порт `1337`, URL `http://localhost:1337`
   - В продакшне: используется домен `https://medconnect.nnmc.kz` (проксирование через Coolify)
   - CORS настраивается для домена в продакшн режиме

2. **Signaling Server**:
   - В локальной разработке: порт `3001`, URL `http://localhost:3001`
   - В продакшне: используется домен `https://medconnect.nnmc.kz` (проксирование через Coolify)
   - CORS настраивается для домена в продакшн режиме

3. **Frontend**:
   - В локальной разработке: порт `3000`, API URL `http://localhost:1337`
   - В продакшне: API URL автоматически становится `https://medconnect.nnmc.kz`
   - Signaling Server URL автоматически становится `https://medconnect.nnmc.kz`

## Проверка после деплоя

1. Убедитесь, что все три сервиса запущены на правильных портах
2. Проверьте, что CORS настроен правильно (в консоли браузера не должно быть ошибок CORS)
3. Проверьте, что API запросы идут на правильный домен
4. Проверьте, что WebRTC соединения работают (signaling server)

## Примечания

- В режиме разработки (`NODE_ENV=development` или без установки `NODE_ENV`) используются стандартные порты и localhost
- Все домены должны быть настроены в Coolify для проксирования на соответствующие порты
- Убедитесь, что SSL сертификаты настроены для домена `medconnect.nnmc.kz`
