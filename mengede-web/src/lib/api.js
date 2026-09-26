import { getDeviceId } from './device.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function call(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': getDeviceId()
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({
      ok: false,
      error: 'Unexpected response from the server.'
    }));

    if (!res.ok && data.ok !== false) {
      return {
        ok: false,
        error: `Request failed with HTTP ${res.status}.`
      };
    }

    return data;
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Network error'
    };
  }
}

export const verifyReceipt = (mentorId, slot, reference) =>
  call('/api/verify-receipt', {
    method: 'POST',
    body: { mentorId, slot, reference }
  });

export const createBooking = (mentorId, slot) =>
  call('/api/bookings', {
    method: 'POST',
    body: { mentorId, slot }
  });

export const listBookings = () => call('/api/bookings');

export const clearBookings = () =>
  call('/api/bookings', { method: 'DELETE' });

export const getMentorPayment = (id) =>
  call('/api/mentors/' + encodeURIComponent(id) + '/payment');

export const getMentorTakenSlots = (id) =>
  call('/api/mentors/' + encodeURIComponent(id) + '/slots');

export const askMengede = (text, conversationId) =>
  call('/api/assistant', {
    method: 'POST',
    body: { text, conversationId }
  });

export const getRecommendations = () => call('/api/recommendations');

export const getUniversities = () => call('/api/universities');

export const getUniversity = (slug) =>
  call('/api/universities/' + encodeURIComponent(slug));

export const getPathways = () => call('/api/pathways');

export const getPathway = (slug) =>
  call('/api/pathways/' + encodeURIComponent(slug));

export const getResources = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  return call('/api/resources' + (query.toString() ? '?' + query : ''));
};

export const discoverResources = (query) =>
  call('/api/resources/discover?q=' + encodeURIComponent(query));

export const recordInteraction = (
  type,
  entityType,
  entityId,
  metadata = {}
) =>
  call('/api/interactions', {
    method: 'POST',
    body: { type, entityType, entityId, metadata }
  });

export const getUserIntelligence = () =>
  call('/api/interactions/intelligence');

export const getStudentProfile = () =>
  call('/api/data/profile/' + encodeURIComponent(getDeviceId()));

export const saveStudentProfile = (profile) =>
  call('/api/data/profile/' + encodeURIComponent(getDeviceId()), {
    method: 'PUT',
    body: profile
  });
