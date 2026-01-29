import axios from "axios";

// =====================================================
// КОНФИГУРАЦИЯ ДОМЕНОВ ДЛЯ ПРОДАКШНА
// =====================================================
// Frontend:        https://medconnect.nnmc.kz
// Strapi API:      https://medconnectserver.nnmc.kz
// Signaling:       https://medconnectrtc.nnmc.kz
// =====================================================

// URL для Strapi API
const PRODUCTION_API_URL = "https://medconnectserver.nnmc.kz";
const DEVELOPMENT_API_URL = "http://localhost:1340";

// Определяем URL API в зависимости от окружения
const getApiUrl = () => {
  // ВАЖНО: Проверяем hostname в первую очередь - это самый надежный способ
  // для определения продакшна, так как работает в runtime
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Если мы на продакшн домене фронтенда - используем продакшн API домен
    if (hostname === 'medconnect.nnmc.kz' || hostname === 'www.medconnect.nnmc.kz') {
      return PRODUCTION_API_URL;
    }
  }
  
  // Проверяем переменную окружения (может быть задана через vite.config.js)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Проверяем другие способы определения продакшна
  const isProduction = 
    import.meta.env.MODE === 'production' || 
    import.meta.env.PROD === true;
  
  if (isProduction) {
    return PRODUCTION_API_URL;
  }
  
  // В режиме разработки используем localhost
  return DEVELOPMENT_API_URL;
};

let API_URL = getApiUrl();

// ВАЖНО: Переопределяем API_URL в runtime, если мы на продакшн домене
// Это гарантирует, что даже если сборка была сделана неправильно,
// мы все равно используем правильный домен
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname === 'medconnect.nnmc.kz' || hostname === 'www.medconnect.nnmc.kz') {
    API_URL = PRODUCTION_API_URL;
  }
}

// Логируем для отладки (только в браузере)
if (typeof window !== 'undefined') {
  console.log('[API] API_URL:', API_URL);
  console.log('[API] Mode:', import.meta.env.MODE);
  console.log('[API] PROD:', import.meta.env.PROD);
  console.log('[API] Hostname:', window.location.hostname);
  console.log('[API] Final API URL:', API_URL);
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Дополнительная проверка: убеждаемся, что baseURL правильный
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if ((hostname === 'medconnect.nnmc.kz' || hostname === 'www.medconnect.nnmc.kz') && 
      api.defaults.baseURL !== PRODUCTION_API_URL) {
    console.warn('[API] WARNING: baseURL is incorrect! Fixing...');
    api.defaults.baseURL = PRODUCTION_API_URL;
  }
}

// Request interceptor - добавляем токен и проверяем URL
api.interceptors.request.use(
    (config) => {
        // ВАЖНО: В продакшне принудительно устанавливаем правильный baseURL
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname === 'medconnect.nnmc.kz' || hostname === 'www.medconnect.nnmc.kz') {
                // Принудительно устанавливаем правильный baseURL
                config.baseURL = PRODUCTION_API_URL;
                api.defaults.baseURL = PRODUCTION_API_URL;
            }
        }
        
        // Если baseURL не установлен, используем текущий API_URL
        if (!config.baseURL) {
            config.baseURL = api.defaults.baseURL || API_URL;
        }
        
        // Логируем для отладки в продакшне
        if (typeof window !== 'undefined' && window.location.hostname === 'medconnect.nnmc.kz') {
            if (config.url && config.url.startsWith('/api')) {
                console.log('[API Request]', {
                    baseURL: config.baseURL,
                    url: config.url,
                    finalURL: config.baseURL + config.url
                });
            }
        }
        
        const authStorage = localStorage.getItem("auth-storage");
        if (authStorage) {
            try {
                const { state } = JSON.parse(authStorage);
                if (state?.token) {
                    config.headers.Authorization = `Bearer ${state.token}`;
                }
            } catch (e) {
                console.error("Error parsing auth storage:", e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - обработка ошибок
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("auth-storage");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;

// ===========================================
// HELPER FUNCTIONS для работы со Strapi v5
// ===========================================

/**
 * Нормализация данных из Strapi v5
 * Strapi v5 возвращает: { data: { id, ...fields } } или { data: [{ id, ...fields }] }
 */
export const normalizeData = (data) => {
    if (!data) return null;

    // Если это массив
    if (Array.isArray(data)) {
        return data.map((item) => normalizeItem(item));
    }

    // Если это объект
    return normalizeItem(data);
};

const normalizeItem = (item) => {
    if (!item) return null;

    // Strapi v5 формат - данные уже плоские, но связи могут быть вложенными
    const normalized = { ...item };

    // ВАЖНО: Преобразуем statuse -> status для удобства использования в приложении
    if (normalized.statuse !== undefined) {
        normalized.status = normalized.statuse;
    }

    // Рекурсивно обрабатываем вложенные связи
    Object.keys(normalized).forEach((key) => {
        const value = normalized[key];
        // Если это связь с data внутри
        if (value && typeof value === "object" && value.data !== undefined) {
            normalized[key] = normalizeData(value.data);
        }
        // Если это массив связей
        else if (Array.isArray(value) && value.length > 0 && value[0]?.id) {
            normalized[key] = value.map((v) => normalizeItem(v));
        }
    });

    return normalized;
};

/**
 * Нормализация ответа API
 */
export const normalizeResponse = (response) => {
    if (response?.data?.data !== undefined) {
        return {
            data: normalizeData(response.data.data),
            meta: response.data.meta,
        };
    }
    return response?.data;
};

// ===========================================
// API для загрузки файлов
// ===========================================

export const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("files", file);

    const response = await api.post("/api/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });

    return response.data[0];
};

export const deleteFile = async (fileId) => {
    await api.delete(`/api/upload/files/${fileId}`);
};

// ===========================================
// API для медиафайлов
// ===========================================

export const getMediaUrl = (media) => {
    if (!media) return null;

    // Если это строка - уже URL
    if (typeof media === "string") {
        return media.startsWith("http") ? media : `${API_URL}${media}`;
    }

    // Strapi формат
    const url = media.url;
    if (!url) return null;

    return url.startsWith("http") ? url : `${API_URL}${url}`;
};

// ===========================================
// API для аутентификации
// ===========================================

export const authAPI = {
    login: (identifier, password) =>
        api.post("/api/auth/local", { identifier, password }),

    register: (data) =>
        api.post("/api/auth/local/register", {
            username: data.email,
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            phone: data.phone,
            userRole: "patient",
        }),

    getMe: () => api.get("/api/users/me?populate=*"),

    updateProfile: (userId, data) => api.put(`/api/users/${userId}`, data),
};

// ===========================================
// API для врачей
// ===========================================

export const doctorsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("sort", "rating:desc");

        // Убрал фильтр isActive - показываем всех врачей
        // Можно добавить обратно: query.append('filters[isActive][$eq]', 'true')

        if (params.specialization) {
            query.append(
                "filters[specialization][id][$eq]",
                params.specialization
            );
        }
        if (params.search) {
            query.append("filters[fullName][$containsi]", params.search);
        }

        return api.get(`/api/doctors?${query}`);
    },

    getOne: (id) => api.get(`/api/doctors/${id}?populate=*`),

    getBySpecialization: (specializationId) =>
        api.get(
            `/api/doctors?filters[specialization][id][$eq]=${specializationId}&populate=*`
        ),
    
    // Обновление профиля врача (включая настройки расписания)
    update: (id, data) => api.put(`/api/doctors/${id}`, { data }),
    
    // Получение врача по user ID (используем поле userId)
    getByUserId: (userId) => 
        api.get(`/api/doctors?filters[userId][$eq]=${userId}&populate=*`),
};

// ===========================================
// API для специализаций
// ===========================================

export const specializationsAPI = {
    getAll: () => api.get("/api/specializations?populate=*&sort=sortOrder:asc,name:asc"),

    getOne: (id) => api.get(`/api/specializations/${id}?populate=*`),
};

// ===========================================
// API для записей на приём
// ===========================================
export const appointmentsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate[doctor][populate][0]", "specialization");
        query.append("populate[doctor][populate][1]", "photo");
        query.append("populate[patient][fields][0]", "id");
        query.append("populate[patient][fields][1]", "fullName");
        query.append("populate[patient][fields][2]", "email");
        query.append("populate[patient][fields][3]", "phone");
        query.append("sort", "dateTime:desc");

        if (params.status) {
            query.append("filters[statuse][$eq]", params.status);
        }
        // Фильтрация по пациенту/врачу выполняется на бэке по текущему пользователю.
        // Оставляем только параметры, которые реально нужны в UI.

        return api.get(`/api/appointments?${query}`);
    },

    getOne: (id) =>
        api.get(
            `/api/appointments/${id}?populate[doctor][populate][0]=specialization&populate[doctor][populate][1]=photo&populate[patient][fields][0]=id&populate[patient][fields][1]=fullName&populate[patient][fields][2]=email`
        ),

    create: (data) => {
        // Strapi v5 требует числовые ID для связей
        const patientId = typeof data.patient === 'object' ? data.patient.id : data.patient;
        const doctorId = typeof data.doctor === 'object' ? data.doctor.id : data.doctor;
        
        const strapiData = {
            dateTime: data.dateTime,
            type: data.type || "video",
            statuse: "confirmed", // Сразу подтверждаем - клиент оплатил
            price: data.price,
            paymentStatus: data.paymentStatus || "paid", // Считаем оплаченным
            roomId: data.roomId,
            // Strapi v5 - пробуем разные форматы связей
            patient: patientId,
            doctor: doctorId,
        };
        
        console.log('Creating appointment with data:', strapiData);
        return api.post("/api/appointments", { data: strapiData });
    },

    update: (id, data) => {
        const strapiData = { ...data };
        if (data.status) {
            strapiData.statuse = data.status;
            delete strapiData.status;
        }
        return api.put(`/api/appointments/${id}`, { data: strapiData });
    },

    cancel: (id) =>
        api.put(`/api/appointments/${id}`, { data: { statuse: "cancelled" } }),
};
// ===========================================
// API для временных слотов
// ===========================================

export const timeSlotsAPI = {
    getAvailable: (doctorId, date) => {
        const query = new URLSearchParams();
        query.append("filters[doctor][id][$eq]", doctorId);
        query.append("filters[date][$eq]", date);
        query.append("filters[isBooked][$eq]", "false");
        query.append("filters[isBlocked][$eq]", "false");
        query.append("sort", "startTime:asc");

        return api.get(`/api/time-slots?${query}`);
    },

    create: (data) => api.post("/api/time-slots", { data }),

    update: (id, data) => api.put(`/api/time-slots/${id}`, { data }),
};

// ===========================================
// API для получения занятых слотов врача
// ===========================================

export const getBookedSlots = async (doctorId, date) => {
    // Получаем все записи врача на указанную дату (не отменённые)
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    
    const query = new URLSearchParams();
    query.append("filters[doctor][id][$eq]", doctorId);
    query.append("filters[dateTime][$gte]", startOfDay);
    query.append("filters[dateTime][$lte]", endOfDay);
    query.append("filters[statuse][$ne]", "cancelled"); // Не включаем отменённые
    query.append("fields[0]", "dateTime");
    
    const response = await api.get(`/api/appointments?${query}`);
    const { data } = normalizeResponse(response);
    
    // Возвращаем массив занятых времён в формате "HH:mm"
    return (data || []).map(apt => {
        const date = new Date(apt.dateTime);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    });
};

// ===========================================
// API для диалогов
// ===========================================

export const conversationsAPI = {
    getAll: (userId) => {
        const query = new URLSearchParams();
        query.append("populate[participants][populate]", "*");
        query.append("populate[lastMessage]", "*");
        query.append("sort", "updatedAt:desc");

        if (userId) {
            // Фильтруем по участникам (пользователь должен быть участником)
            query.append("filters[participants][id][$eq]", userId);
        }

        return api.get(`/api/conversations?${query}`);
    },

    getOne: (id) =>
        api.get(
            `/api/conversations/${id}?populate[participants][populate]=*&populate[messages][populate]=*`
        ),

    create: (participantIds) =>
        api.post("/api/conversations", {
            data: { participants: participantIds },
        }),

    update: (id, data) => api.put(`/api/conversations/${id}`, { data }),
};

// ===========================================
// API для сообщений
// ===========================================

export const messagesAPI = {
    getByConversation: (conversationId) => {
        const query = new URLSearchParams();
        query.append("filters[conversation][id][$eq]", conversationId);
        query.append("populate", "*");
        query.append("sort", "createdAt:asc");

        return api.get(`/api/messages?${query}`);
    },

    create: (data) => api.post("/api/messages", { data }),

    markAsRead: (id) =>
        api.put(`/api/messages/${id}`, {
            data: { isRead: true, readAt: new Date().toISOString() },
        }),
};

// ===========================================
// API для медицинских документов (MedicalDocument)
// ===========================================

export const documentsAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams();
        query.append("populate", "*");
        query.append("sort", "createdAt:desc");

        if (params.userId) {
            query.append("filters[user][id][$eq]", params.userId);
        }
        if (params.type) {
            query.append("filters[type][$eq]", params.type);
        }

        // Используем medical-documents (Strapi генерирует URL по pluralName)
        return api.get(`/api/medical-documents?${query}`);
    },

    getOne: (id) => api.get(`/api/medical-documents/${id}?populate=*`),

    create: (data) => api.post("/api/medical-documents", { data }),

    update: (id, data) => api.put(`/api/medical-documents/${id}`, { data }),

    delete: (id) => api.delete(`/api/medical-documents/${id}`),
};

// ===========================================
// API для отзывов
// ===========================================

export const reviewsAPI = {
    getByDoctor: (doctorId) => {
        const query = new URLSearchParams();
        query.append("filters[doctor][id][$eq]", doctorId);
        query.append("filters[isPublished][$eq]", "true");
        query.append("populate", "*");
        query.append("sort", "createdAt:desc");

        return api.get(`/api/reviews?${query}`);
    },

    create: (data) => api.post("/api/reviews", { data }),
};

// ===========================================
// API для уведомлений
// ===========================================

let notificationsDisabled = false;

export const notificationsAPI = {
    getAll: async (userId) => {
        if (!userId || notificationsDisabled) {
            return { data: { data: [] } };
        }
        const query = new URLSearchParams();
        query.append("filters[user][id][$eq]", userId);
        query.append("sort", "createdAt:desc");
        query.append("populate", "*");
        try {
            return await api.get(`/api/notifications?${query}`);
        } catch (error) {
            if (error?.response?.status === 404) {
                notificationsDisabled = true;
                return { data: { data: [] } };
            }
            throw error;
        }
    },

    markAsRead: async (id) => {
        if (!id || notificationsDisabled) {
            return { data: { data: null } };
        }
        try {
            return await api.put(`/api/notifications/${id}`, { data: { isRead: true } });
        } catch (error) {
            if (error?.response?.status === 404) {
                notificationsDisabled = true;
                return { data: { data: null } };
            }
            throw error;
        }
    },

    markAllAsRead: async (userId) => {
        if (!userId || notificationsDisabled) {
            return { data: { data: null } };
        }
        try {
            return await api.put("/api/notifications/mark-all-read", { userId });
        } catch (error) {
            if (error?.response?.status === 404) {
                notificationsDisabled = true;
                return { data: { data: null } };
            }
            throw error;
        }
    },
};
