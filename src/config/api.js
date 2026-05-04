import axios from 'axios';
import { io } from 'socket.io-client';

// Determine base URL for API.
// Priority: REACT_APP_BACKEND_URL -> REACT_APP_API_URL -> auto-detect -> fallback.
// REACT_APP_BACKEND_URL is preferred because it cannot be overridden by stale Vercel dashboard vars.
function resolveApiBase() {
  // Highest precedence: new canonical env var (set in .env.production, not Vercel dashboard).
  if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
  // Fallback: legacy env var (may be overridden by Vercel dashboard — avoid relying on this).
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // If not already on backend port 5000, assume this is a dev front-end port (e.g. 3000, 5050, 5173, etc.)
    // and point to backend port 5000.
    if (port && port !== '5000') {
      return `${protocol}//${hostname}:5000`;
    }
    // Otherwise use current origin (could be production where backend serves frontend).
    return window.location.origin;
  }

  // Fallback (SSR or no window): assume localhost backend.
  return 'http://localhost:5000';
}

export const API_BASE = resolveApiBase();

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

export const socket = io(API_BASE, {
  transports: ['websocket', 'polling'],
});

// Debug: log API base once so we can confirm in browser console
// (Remove this line after connectivity is confirmed.)
/* eslint-disable no-console */
console.log('[API] Using base URL:', API_BASE);
/* eslint-enable no-console */

