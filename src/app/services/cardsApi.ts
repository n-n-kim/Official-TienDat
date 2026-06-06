import type { SaveWeddingCardInput, WeddingCardDesign } from '../types/weddingCard';
import {
  clearStoredUser,
  getGoogleSessionErrorMessage,
  getStoredUser,
} from './googleSession';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE = `${API_BASE_URL}/api/cards`;

export async function listWeddingCardDesigns(): Promise<WeddingCardDesign[]> {
  const response = await fetch(API_BASE, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to load saved designs.');
  }

  return (await response.json()) as WeddingCardDesign[];
}

export async function createWeddingCardDesign(
  payload: SaveWeddingCardInput,
): Promise<WeddingCardDesign> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to save design.');
  }

  return (await response.json()) as WeddingCardDesign;
}

export async function updateWeddingCardDesign(
  id: string,
  payload: SaveWeddingCardInput,
): Promise<WeddingCardDesign> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to update design.');
  }

  return (await response.json()) as WeddingCardDesign;
}

export async function deleteWeddingCardDesign(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await buildApiError(response, 'Failed to delete design.');
  }
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
