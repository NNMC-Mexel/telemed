# MedConnect - Телемедицина платформа

## 🏥 Описание

MedConnect - современная телемедицинская платформа для онлайн-консультаций с врачами. Включает видеозвонки, чат, управление записями, документами и отзывами.

## 🛠 Технологии

**Frontend:**
- React 18 + Vite
- Tailwind CSS
- Zustand (state management)
- Socket.io (WebRTC сигнализация)
- Axios

**Backend:**
- Strapi CMS v5
- PostgreSQL / SQLite
- Socket.io (signaling server)

## 📦 Структура проекта

```
telemedicine/
├── frontend/          # React приложение
├── backend/           # Strapi CMS
├── signaling-server/  # WebRTC сигнальный сервер
└── README.md
```

## 🚀 Запуск

### 1. Backend (Strapi)

```bash
cd backend
npm install
npm run develop
```

Откроется админ-панель: http://localhost:1337/admin

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Откроется: http://localhost:5173

### 3. Signaling Server (для видеозвонков)

```bash
cd signaling-server
npm install
npm start
```

Запустится на: http://localhost:3001

---

## 📋 Настройка Strapi - Content Types (ОБЯЗАТЕЛЬНО!)

Создай следующие Content Types в админ-панели Strapi:

### 1. **Doctor** (Врач)
Путь: Content-Type Builder → Create new collection type

| Поле | Тип | Настройки |
|------|-----|-----------|
| `fullName` | Text | Required |
| `specialization` | Relation | Many-to-One → Specialization |
| `experience` | Integer | Min: 0 |
| `price` | Integer | Min: 0 |
| `bio` | Rich Text | - |
| `education` | Text (Long) | - |
| `rating` | Decimal | Min: 0, Max: 5, Default: 0 |
| `reviewsCount` | Integer | Default: 0 |
| `isAvailable` | Boolean | Default: true |
| `photo` | Media | Single image |
| `user` | Relation | One-to-One → User |

### 2. **Patient** (Пациент)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `fullName` | Text | - |
| `iin` | Text | Unique |
| `birthDate` | Date | - |
| `address` | Text | - |
| `medicalHistory` | Rich Text | - |
| `user` | Relation | One-to-One → User |

### 3. **Specialization** (Специализация)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `name` | Text | Required, Unique |
| `description` | Text | - |
| `icon` | Text | Например: "Stethoscope" |
| `doctors` | Relation | One-to-Many → Doctor |

**Предустановленные специализации:**
- Терапевт
- Кардиолог
- Невролог
- Педиатр
- Дерматолог
- Офтальмолог
- ЛОР
- Эндокринолог
- Психотерапевт
- Гастроэнтеролог

### 4. **Appointment** (Запись на приём)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `dateTime` | DateTime | Required |
| `status` | Enumeration | pending, confirmed, completed, cancelled |
| `type` | Enumeration | video, chat |
| `symptoms` | Text (Long) | - |
| `notes` | Text (Long) | - |
| `price` | Integer | - |
| `roomId` | Text | Unique (генерируется автоматически) |
| `doctor` | Relation | Many-to-One → Doctor |
| `patient` | Relation | Many-to-One → User |

### 5. **Review** (Отзыв)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `rating` | Integer | Required, Min: 1, Max: 5 |
| `comment` | Text (Long) | - |
| `doctor` | Relation | Many-to-One → Doctor |
| `patient` | Relation | Many-to-One → User |
| `appointment` | Relation | One-to-One → Appointment |

### 6. **Document** (Медицинский документ)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `name` | Text | Required |
| `type` | Enumeration | analysis, prescription, certificate, report, other |
| `description` | Text | - |
| `file` | Media | Single file |
| `user` | Relation | Many-to-One → User |
| `appointment` | Relation | Many-to-One → Appointment |

### 7. **Conversation** (Диалог/Чат)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `participants` | Relation | Many-to-Many → User |
| `lastMessage` | Relation | One-to-One → Message |
| `unreadCount` | Integer | Default: 0 |

### 8. **Message** (Сообщение)
| Поле | Тип | Настройки |
|------|-----|-----------|
| `content` | Text (Long) | Required |
| `sender` | Relation | Many-to-One → User |
| `conversation` | Relation | Many-to-One → Conversation |
| `isRead` | Boolean | Default: false |
| `attachments` | Media | Multiple files |

### 9. **TimeSlot** (Временной слот) - опционально
| Поле | Тип | Настройки |
|------|-----|-----------|
| `startTime` | Time | Required |
| `endTime` | Time | Required |
| `dayOfWeek` | Integer | 0-6 (Вс-Сб) |
| `isAvailable` | Boolean | Default: true |
| `doctor` | Relation | Many-to-One → Doctor |

---

## 👤 Расширение модели User

В файле `backend/src/extensions/users-permissions/content-types/user/schema.json` добавь поля:

```json
{
  "kind": "collectionType",
  "collectionName": "up_users",
  "info": {
    "name": "user",
    "description": ""
  },
  "attributes": {
    "fullName": {
      "type": "string"
    },
    "phone": {
      "type": "string"
    },
    "userRole": {
      "type": "enumeration",
      "enum": ["patient", "doctor", "admin"],
      "default": "patient"
    },
    "avatar": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "iin": {
      "type": "string"
    },
    "birthDate": {
      "type": "date"
    },
    "address": {
      "type": "string"
    }
  }
}
```

---

## 🔐 Права доступа (Permissions)

В админ-панели → Settings → Users & Permissions → Roles:

### Public (неавторизованные)
- **Auth**: `callback`, `register`
- **Doctors**: `find`, `findOne`
- **Specializations**: `find`, `findOne`

### Authenticated (авторизованные)
- **Doctors**: `find`, `findOne`, `create`, `update`
- **Appointments**: `find`, `findOne`, `create`, `update`, `delete`
- **Reviews**: `find`, `findOne`, `create`
- **Documents**: `find`, `findOne`, `create`, `delete`
- **Conversations**: `find`, `findOne`, `create`
- **Messages**: `find`, `findOne`, `create`
- **Users-permissions/User**: `find`, `findOne`, `update`, `me`
- **Upload**: `upload`, `destroy`

---

## ⚙️ Переменные окружения

### Frontend (.env)
```env
VITE_API_URL=http://localhost:1337
VITE_SIGNALING_SERVER=http://localhost:3001
```

### Backend (.env)
```env
HOST=0.0.0.0
PORT=1337
APP_KEYS=ваш-ключ
API_TOKEN_SALT=ваш-salt
ADMIN_JWT_SECRET=ваш-jwt-secret
JWT_SECRET=ваш-jwt-secret
```

### Signaling Server (.env)
```env
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

## 📱 Функционал платформы

### Для пациентов:
- ✅ Регистрация/авторизация
- ✅ Просмотр списка врачей с фильтрацией
- ✅ Запись на консультацию
- ✅ Видеоконсультации (WebRTC)
- ✅ Чат с врачами
- ✅ Управление документами
- ✅ Профиль с личными данными
- ✅ История консультаций

### Для врачей:
- ✅ Личный кабинет
- ✅ Расписание и управление записями
- ✅ Список пациентов
- ✅ Проведение консультаций
- ✅ Просмотр отзывов
- ✅ Управление профилем

### Для админов:
- ✅ Панель управления
- ✅ Статистика
- ✅ Управление пользователями

---

## 🎥 WebRTC Видеозвонки

Для работы видеозвонков необходим сигнальный сервер:

1. Запусти `signaling-server`
2. Убедись что STUN серверы доступны (используем Google STUN)
3. Для production добавь TURN сервер для NAT traversal

---

## 🔧 Troubleshooting

### "Нет данных" / Пустые списки
1. Проверь что Strapi запущен
2. Проверь права доступа в Roles
3. Создай тестовые данные в админке Strapi

### Ошибки CORS
Добавь в `backend/config/middlewares.js`:
```js
module.exports = [
  'strapi::errors',
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:5173'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      headers: ['Content-Type', 'Authorization'],
    },
  },
  // ...остальные middleware
];
```

### Видеозвонки не работают
1. Проверь что signaling-server запущен
2. Дай разрешения браузеру на камеру/микрофон
3. Используй HTTPS в production

---

## 📞 Контакты

По вопросам: [ваш email]
