import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  ADMIN_EMAILS?: string;
  CORS_ORIGIN?: string;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

interface ChatConversation {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar: string;
  contactPhone: string;
  status: 'open' | 'closed';
  lastMessage: string;
  lastSenderRole: 'user' | 'admin' | '';
  unreadForAdmin: number;
  unreadForUser: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  content: string;
  createdAt: string;
}

interface ConversationRow {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_avatar: string;
  contact_phone: string;
  status: 'open' | 'closed';
  last_message: string;
  last_sender_role: 'user' | 'admin' | '';
  unread_for_admin: number;
  unread_for_user: number;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'user' | 'admin';
  content: string;
  created_at: string;
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, '') || '/';

      if (path === '/health') {
        return json({ ok: true }, 200, corsHeaders);
      }

      if (path === '/api/chat/conversations') {
        return handleConversationsCollection(request, env, corsHeaders);
      }

      const conversationMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)$/);
      if (conversationMatch) {
        return handleConversationItem(
          request,
          env,
          corsHeaders,
          decodeURIComponent(conversationMatch[1]),
        );
      }

      const messagesMatch = path.match(/^\/api\/chat\/conversations\/([^/]+)\/messages$/);
      if (messagesMatch) {
        return handleMessagesCollection(
          request,
          env,
          corsHeaders,
          decodeURIComponent(messagesMatch[1]),
        );
      }

      return json({ message: 'Not found.' }, 404, corsHeaders);
    } catch (error) {
      console.error('Worker request failed', error);
      return json(
        { message: error instanceof Error ? error.message : 'Internal server error.' },
        500,
        corsHeaders,
      );
    }
  },
};

async function handleConversationsCollection(
  request: Request,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const auth = await requireAuthenticatedUser(request, env, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  if (request.method === 'GET') {
    const conversations = await listConversations(env, auth);
    return json(conversations, 200, corsHeaders);
  }

  if (request.method === 'POST') {
    const payload = await readJsonBody<Record<string, unknown>>(request);
    const validationError = validateCreateConversationPayload(payload);

    if (validationError) {
      return json({ message: validationError }, 400, corsHeaders);
    }

    const conversation = await createConversation(env, auth, {
      contactPhone: normalizeString(payload.contactPhone),
      initialMessage: normalizeString(payload.initialMessage),
    });

    return json(conversation, 201, corsHeaders);
  }

  return json({ message: 'Method not allowed.' }, 405, corsHeaders);
}

async function handleConversationItem(
  request: Request,
  env: Env,
  corsHeaders: Headers,
  conversationId: string,
): Promise<Response> {
  const auth = await requireAuthenticatedUser(request, env, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  const conversation = await getConversation(env, conversationId);
  if (!conversation) {
    return json({ message: 'Conversation not found.' }, 404, corsHeaders);
  }

  const isAdmin = isAdminUser(auth, env);
  if (!isAdmin && conversation.userId !== auth.id) {
    return json({ message: 'You do not have access to this conversation.' }, 403, corsHeaders);
  }

  if (request.method === 'GET') {
    return json(conversation, 200, corsHeaders);
  }

  if (request.method === 'PUT') {
    if (!isAdmin) {
      return json({ message: 'Admin access is required.' }, 403, corsHeaders);
    }

    const payload = await readJsonBody<Record<string, unknown>>(request);
    const validationError = validateConversationUpdatePayload(payload);
    if (validationError) {
      return json({ message: validationError }, 400, corsHeaders);
    }

    const updated = await updateConversationStatus(
      env,
      conversationId,
      payload.status as 'open' | 'closed',
    );

    return json(updated, 200, corsHeaders);
  }

  return json({ message: 'Method not allowed.' }, 405, corsHeaders);
}

async function handleMessagesCollection(
  request: Request,
  env: Env,
  corsHeaders: Headers,
  conversationId: string,
): Promise<Response> {
  const auth = await requireAuthenticatedUser(request, env, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  const conversation = await getConversation(env, conversationId);
  if (!conversation) {
    return json({ message: 'Conversation not found.' }, 404, corsHeaders);
  }

  const isAdmin = isAdminUser(auth, env);
  if (!isAdmin && conversation.userId !== auth.id) {
    return json({ message: 'You do not have access to this conversation.' }, 403, corsHeaders);
  }

  if (request.method === 'GET') {
    const messages = await listMessages(env, conversationId);
    await clearUnreadCount(env, conversation, isAdmin ? 'admin' : 'user');
    return json(messages, 200, corsHeaders);
  }

  if (request.method === 'POST') {
    const payload = await readJsonBody<Record<string, unknown>>(request);
    const validationError = validateSendMessagePayload(payload);

    if (validationError) {
      return json({ message: validationError }, 400, corsHeaders);
    }

    const result = await addMessage(env, conversation, {
      senderId: auth.id,
      senderName: auth.name,
      senderRole: isAdmin ? 'admin' : 'user',
      content: normalizeString(payload.content),
    });

    return json(result.message, 201, corsHeaders);
  }

  return json({ message: 'Method not allowed.' }, 405, corsHeaders);
}

async function requireAuthenticatedUser(
  request: Request,
  env: Env,
  corsHeaders: Headers,
): Promise<AuthenticatedUser | Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return json({ message: 'Missing Firebase ID token.' }, 401, corsHeaders);
  }

  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is not configured.');
  }

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const user = mapPayloadToUser(payload);
    if (!user) {
      return json({ message: 'Invalid Firebase ID token payload.' }, 401, corsHeaders);
    }

    return user;
  } catch (error) {
    console.warn('Firebase token verification failed', error);
    return json({ message: 'Invalid or expired Firebase ID token.' }, 401, corsHeaders);
  }
}

function mapPayloadToUser(payload: JWTPayload): AuthenticatedUser | null {
  const id = stringClaim(payload.user_id) || stringClaim(payload.sub);
  const email = stringClaim(payload.email);

  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    name: stringClaim(payload.name) || email,
    avatar: stringClaim(payload.picture) || '',
  };
}

function isAdminUser(user: AuthenticatedUser, env: Env): boolean {
  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(user.email.toLowerCase());
}

async function listConversations(env: Env, user: AuthenticatedUser): Promise<ChatConversation[]> {
  const isAdmin = isAdminUser(user, env);
  const statement = isAdmin
    ? env.DB.prepare(
        'SELECT * FROM chat_conversations ORDER BY datetime(updated_at) DESC, id DESC',
      )
    : env.DB.prepare(
        'SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY datetime(updated_at) DESC, id DESC',
      ).bind(user.id);

  const { results } = await statement.all<ConversationRow>();
  return (results || []).map(mapConversationRow);
}

async function getConversation(env: Env, conversationId: string): Promise<ChatConversation | null> {
  const row = await env.DB.prepare('SELECT * FROM chat_conversations WHERE id = ?')
    .bind(conversationId)
    .first<ConversationRow>();

  return row ? mapConversationRow(row) : null;
}

async function createConversation(
  env: Env,
  user: AuthenticatedUser,
  payload: { contactPhone: string; initialMessage: string },
): Promise<ChatConversation> {
  const now = new Date().toISOString();
  const conversation: ChatConversation = {
    id: crypto.randomUUID(),
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userAvatar: user.avatar,
    contactPhone: payload.contactPhone,
    status: 'open',
    lastMessage: buildPreview(payload.initialMessage),
    lastSenderRole: 'user',
    unreadForAdmin: 1,
    unreadForUser: 0,
    createdAt: now,
    updatedAt: now,
  };

  const message: ChatMessage = {
    id: createMessageId(),
    conversationId: conversation.id,
    senderId: user.id,
    senderName: user.name,
    senderRole: 'user',
    content: payload.initialMessage,
    createdAt: now,
  };

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO chat_conversations (
        id, user_id, user_email, user_name, user_avatar, contact_phone, status,
        last_message, last_sender_role, unread_for_admin, unread_for_user, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      conversation.id,
      conversation.userId,
      conversation.userEmail,
      conversation.userName,
      conversation.userAvatar,
      conversation.contactPhone,
      conversation.status,
      conversation.lastMessage,
      conversation.lastSenderRole,
      conversation.unreadForAdmin,
      conversation.unreadForUser,
      conversation.createdAt,
      conversation.updatedAt,
    ),
    env.DB.prepare(
      `INSERT INTO chat_messages (
        id, conversation_id, sender_id, sender_name, sender_role, content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      message.id,
      message.conversationId,
      message.senderId,
      message.senderName,
      message.senderRole,
      message.content,
      message.createdAt,
    ),
  ]);

  return conversation;
}

async function listMessages(env: Env, conversationId: string): Promise<ChatMessage[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY datetime(created_at) ASC, id ASC',
  )
    .bind(conversationId)
    .all<MessageRow>();

  return (results || []).map(mapMessageRow);
}

async function addMessage(
  env: Env,
  conversation: ChatConversation,
  payload: {
    senderId: string;
    senderName: string;
    senderRole: 'user' | 'admin';
    content: string;
  },
): Promise<{ conversation: ChatConversation; message: ChatMessage }> {
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: createMessageId(),
    conversationId: conversation.id,
    senderId: payload.senderId,
    senderName: payload.senderName,
    senderRole: payload.senderRole,
    content: payload.content,
    createdAt: now,
  };

  const updatedConversation: ChatConversation = {
    ...conversation,
    status: conversation.status === 'closed' && payload.senderRole === 'user' ? 'open' : conversation.status,
    lastMessage: buildPreview(payload.content),
    lastSenderRole: payload.senderRole,
    unreadForAdmin:
      payload.senderRole === 'user' ? conversation.unreadForAdmin + 1 : 0,
    unreadForUser:
      payload.senderRole === 'admin' ? conversation.unreadForUser + 1 : 0,
    updatedAt: now,
  };

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO chat_messages (
        id, conversation_id, sender_id, sender_name, sender_role, content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      message.id,
      message.conversationId,
      message.senderId,
      message.senderName,
      message.senderRole,
      message.content,
      message.createdAt,
    ),
    env.DB.prepare(
      `UPDATE chat_conversations
      SET status = ?, last_message = ?, last_sender_role = ?, unread_for_admin = ?,
          unread_for_user = ?, updated_at = ?
      WHERE id = ?`,
    ).bind(
      updatedConversation.status,
      updatedConversation.lastMessage,
      updatedConversation.lastSenderRole,
      updatedConversation.unreadForAdmin,
      updatedConversation.unreadForUser,
      updatedConversation.updatedAt,
      updatedConversation.id,
    ),
  ]);

  return {
    conversation: updatedConversation,
    message,
  };
}

async function clearUnreadCount(
  env: Env,
  conversation: ChatConversation,
  viewerRole: 'admin' | 'user',
): Promise<void> {
  const unreadForAdmin = viewerRole === 'admin' ? 0 : conversation.unreadForAdmin;
  const unreadForUser = viewerRole === 'user' ? 0 : conversation.unreadForUser;

  if (
    unreadForAdmin === conversation.unreadForAdmin &&
    unreadForUser === conversation.unreadForUser
  ) {
    return;
  }

  await env.DB.prepare(
    'UPDATE chat_conversations SET unread_for_admin = ?, unread_for_user = ? WHERE id = ?',
  )
    .bind(unreadForAdmin, unreadForUser, conversation.id)
    .run();
}

async function updateConversationStatus(
  env: Env,
  conversationId: string,
  status: 'open' | 'closed',
): Promise<ChatConversation> {
  const existing = await getConversation(env, conversationId);
  if (!existing) {
    throw new Error('Conversation not found.');
  }

  const updated: ChatConversation = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  await env.DB.prepare(
    'UPDATE chat_conversations SET status = ?, updated_at = ? WHERE id = ?',
  )
    .bind(updated.status, updated.updatedAt, updated.id)
    .run();

  return updated;
}

function mapConversationRow(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    userAvatar: row.user_avatar || '',
    contactPhone: row.contact_phone || '',
    status: row.status || 'open',
    lastMessage: row.last_message || '',
    lastSenderRole: row.last_sender_role || '',
    unreadForAdmin: Number(row.unread_for_admin || 0),
    unreadForUser: Number(row.unread_for_user || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function validateCreateConversationPayload(payload: Record<string, unknown>): string | null {
  const initialMessage = normalizeString(payload.initialMessage);
  const contactPhone = normalizeString(payload.contactPhone);

  if (!contactPhone) {
    return 'contactPhone is required.';
  }

  if (!initialMessage) {
    return 'initialMessage is required.';
  }

  if (contactPhone.length > 32) {
    return 'contactPhone must be 32 characters or fewer.';
  }

  if (initialMessage.length > 2000) {
    return 'initialMessage must be 2000 characters or fewer.';
  }

  return null;
}

function validateSendMessagePayload(payload: Record<string, unknown>): string | null {
  const content = normalizeString(payload.content);

  if (!content) {
    return 'content is required.';
  }

  if (content.length > 2000) {
    return 'content must be 2000 characters or fewer.';
  }

  return null;
}

function validateConversationUpdatePayload(payload: Record<string, unknown>): string | null {
  if (!['open', 'closed'].includes(String(payload.status || ''))) {
    return 'status must be either open or closed.';
  }

  return null;
}

async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildPreview(content: string): string {
  const normalized = normalizeString(content).replace(/\s+/g, ' ');
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}...`;
}

function createMessageId(): string {
  return `${Date.now().toString().padStart(13, '0')}_${crypto.randomUUID()}`;
}

function extractBearerToken(request: Request): string | null {
  const directToken = request.headers.get('x-google-id-token');
  if (directToken?.trim()) {
    return directToken.trim();
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}

function getCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const requestOrigin = request.headers.get('origin') || '';
  const configuredOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowOrigin =
    configuredOrigins.length === 0
      ? requestOrigin || '*'
      : configuredOrigins.includes(requestOrigin)
        ? requestOrigin
        : configuredOrigins[0];

  headers.set('Access-Control-Allow-Origin', allowOrigin || '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Google-Id-Token');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Content-Type', 'application/json');
  headers.set('Vary', 'Origin');
  return headers;
}

function json(body: unknown, status: number, headers: Headers): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function stringClaim(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
