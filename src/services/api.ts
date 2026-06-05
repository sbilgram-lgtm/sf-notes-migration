import { AuthStatus, NotesAssessment, AttachmentsAssessment, FilesAssessment, LimitsAssessment, CreationControlsAssessment } from '../types/assessment';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const getAuthStatus = () => get<AuthStatus>('/auth/status');
export const assessNotes = () => get<NotesAssessment>('/api/assess/notes');
export const assessAttachments = () => get<AttachmentsAssessment>('/api/assess/attachments');
export const assessFiles = () => get<FilesAssessment>('/api/assess/files');
export const assessLimits = () => get<LimitsAssessment>('/api/assess/limits');
export const assessCreationControls = () => get<CreationControlsAssessment>('/api/assess/creation-controls');

export async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
}
