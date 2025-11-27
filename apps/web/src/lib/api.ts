/**
 * Centralized API URL configuration
 * 
 * This module provides a single source of truth for the API base URL.
 * 
 * Environment configuration:
 * - Development: http://localhost:3001/api/v1
 * - Production: https://api.superselleria.com.br/api/v1
 * 
 * The NEXT_PUBLIC_API_URL environment variable can override these defaults.
 * For production builds, this variable should be set at build time since
 * Next.js inlines NEXT_PUBLIC_* variables into the client bundle.
 */

const DEV_DEFAULT = 'http://localhost:3001/api/v1';
const PROD_DEFAULT = 'https://api.superselleria.com.br/api/v1';

/**
 * Get the API base URL based on environment configuration.
 * 
 * Priority:
 * 1. NEXT_PUBLIC_API_URL environment variable (if set)
 * 2. Production default (if NODE_ENV is 'production')
 * 3. Development default (localhost)
 * 
 * @returns The API base URL without trailing slash
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  
  if (envUrl) {
    // Remove trailing slash if present
    return envUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return PROD_DEFAULT;
  }

  return DEV_DEFAULT;
}

/**
 * Pre-computed API base URL for use in modules.
 * This is evaluated at build time for client components.
 */
export const API_BASE_URL = getApiBaseUrl();
