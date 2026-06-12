/**
 * Realtime-шина на socket.io, привязанная к HTTP-серверу Strapi.
 *
 * Аутентификация: JWT users-permissions в handshake.auth.token.
 * Комнаты:
 *  - user:{id}            — личная комната пользователя
 *  - support:staff        — все менеджеры/админы (инбокс поддержки)
 *  - conversation:{docId} — подписка на конкретную беседу (с проверкой доступа)
 *
 * События сервер → клиент:
 *  - message:new          — новое сообщение в беседе
 *  - conversation:status  — смена статуса support-обращения
 *  - support:inbox        — инбокс поддержки изменился (новое сообщение/статус)
 */
import { Server } from 'socket.io';
import type { Core } from '@strapi/strapi';

let io: Server | null = null;

const isStaff = (userRole?: string) => userRole === 'admin' || userRole === 'manager';

const buildAllowedOrigins = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction
    ? [
        'https://medconnect.nnmc.kz',
        'https://www.medconnect.nnmc.kz',
        'https://localhost',
        'http://localhost',
        'capacitor://localhost',
        'ionic://localhost',
      ]
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:1342',
        'http://localhost:1343',
      ];
};

export function initRealtime(strapi: Core.Strapi) {
  if (io) return io;

  io = new Server(strapi.server.httpServer, {
    cors: {
      origin: buildAllowedOrigins(),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Аутентификация сокета по JWT
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Unauthorized'));

      const payload = await strapi
        .plugin('users-permissions')
        .service('jwt')
        .verify(token);
      if (!payload?.id) return next(new Error('Unauthorized'));

      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: payload.id },
        select: ['id', 'userRole', 'blocked'],
      });
      if (!user || user.blocked) return next(new Error('Unauthorized'));

      socket.data.user = { id: user.id, userRole: user.userRole };
      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { id: number; userRole: string };
    socket.join(`user:${user.id}`);
    if (isStaff(user.userRole)) {
      socket.join('support:staff');
    }

    // Подписка на беседу — только участник или staff (manager — support-чаты)
    socket.on('conversation:join', async (documentId: string) => {
      try {
        if (!documentId || typeof documentId !== 'string') return;
        const conversation = await strapi.documents('api::conversation.conversation').findOne({
          documentId,
          status: 'published',
          fields: ['id', 'documentId', 'type'],
          populate: { users_permissions_users: { fields: ['id'] } },
        });
        if (!conversation) return;

        const members: any[] = (conversation as any).users_permissions_users || [];
        const isMember = members.some((m) => m.id === user.id);
        const allowed =
          isMember ||
          user.userRole === 'admin' ||
          (user.userRole === 'manager' && (conversation as any).type === 'support');
        if (allowed) {
          socket.join(`conversation:${documentId}`);
        }
      } catch (e) {
        strapi.log.error('realtime conversation:join error:', e);
      }
    });

    socket.on('conversation:leave', (documentId: string) => {
      if (documentId && typeof documentId === 'string') {
        socket.leave(`conversation:${documentId}`);
      }
    });
  });

  strapi.log.info('Realtime (socket.io) attached to Strapi HTTP server');
  return io;
}

export function emitToConversation(documentId: string, event: string, payload: any) {
  io?.to(`conversation:${documentId}`).emit(event, payload);
}

export function emitToUser(userId: number, event: string, payload: any) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToSupportStaff(event: string, payload: any) {
  io?.to('support:staff').emit(event, payload);
}
