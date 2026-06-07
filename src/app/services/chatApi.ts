import type {
  ChatConversation,
  ChatMessage,
  ConversationStatus,
  CreateConversationInput,
  SendChatMessageInput,
} from '../types/chat';
import {
  clearStoredUser,
  getGoogleSessionErrorMessage,
  getStoredUser,
} from './googleSession';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE = `${API_BASE_URL}/api/chat/conversations`;

export async function listChatConversations(): Promise<ChatConversation[]> {
  const response = await fetch(API_BASE, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to load conversations.');
  }

  return readJsonResponse<ChatConversation[]>(
    response,
    'Chat API returned a non-JSON response while loading conversations.',
  );
}

export async function createChatConversation(
  payload: CreateConversationInput,
): Promise<ChatConversation> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to create conversation.');
  }

  return readJsonResponse<ChatConversation>(
    response,
    'Chat API returned a non-JSON response while creating a conversation.',
  );
}

export async function listConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(conversationId)}/messages`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to load messages.');
  }

  return readJsonResponse<ChatMessage[]>(
    response,
    'Chat API returned a non-JSON response while loading messages.',
  );
}

export async function sendChatMessage(
  conversationId: string,
  payload: SendChatMessageInput,
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to send message.');
  }

  return readJsonResponse<ChatMessage>(
    response,
    'Chat API returned a non-JSON response while sending a message.',
  );
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<ChatConversation> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(conversationId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to update conversation status.');
  }

  return readJsonResponse<ChatConversation>(
    response,
    'Chat API returned a non-JSON response while updating conversation status.',
  );
}

async function buildApiError(response: Response, fallbackMessage: string): Promise<Error> {
  const responseMessage = await readApiErrorMessage(response);

  if (response.status === 401) {
    clearStoredUser();
    return new Error(responseMessage ?? getGoogleSessionErrorMessage());
  }

  return new Error(responseMessage ?? fallbackMessage);
}

function getAuthHeaders(): Record<string, string> {
  const user = getStoredUser();

  if (!user?.idToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${user.idToken}`,
    'X-Google-Id-Token': user.idToken,
  };
}

async function readApiErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { message?: string };

    return data.message || null;
  } catch {
    return null;
  }
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const rawBody = await response.text();
    const preview = rawBody.trim().slice(0, 120);

    throw new Error(preview.startsWith('<') ? fallbackMessage : preview || fallbackMessage);
  }

  return (await response.json()) as T;
}
