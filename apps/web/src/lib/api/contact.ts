import { apiClient } from './client';

export interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Send a contact message to the backend.
 * Uses the public POST /contact endpoint.
 */
export async function sendContactMessage(body: ContactRequest): Promise<void> {
  await apiClient.post<void>('/contact', body);
}

