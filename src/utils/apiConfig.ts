/**
 * API Configuration Utility
 * 
 * This utility standardizes how API URLs are constructed across the application,
 * ensuring consistent behavior between development and production environments.
 */

// Base URL from environment or fallback to localhost
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5176';

// Add debug logging for environment variable
console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);

/**
 * Gets the correct API URL for the current environment
 * 
 * In production: 
 *   - If VITE_API_URL already includes '/api', use it directly
 *   - Otherwise, add '/api' prefix to the URL
 * 
 * In development:
 *   - Use the base URL without '/api' prefix since the server handles both paths
 * 
 * @param endpoint API endpoint path (with or without leading slash)
 * @returns Full API URL
 */
export function getApiUrl(endpoint: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const needsApiPrefix = isProduction && !BASE_URL.includes('/api');
  const apiPrefix = needsApiPrefix ? '/api' : '';
  
  // Clean the endpoint (remove leading slash if needed)
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  const fullUrl = `${BASE_URL}${apiPrefix}/${cleanEndpoint}`;
  console.log(`🔗 API URL for ${endpoint}:`, fullUrl);
  return fullUrl;
}

/**
 * Logs the API configuration for debugging purposes
 */
export function logApiConfig(): void {
  console.log('[API Config]', {
    environment: process.env.NODE_ENV || 'development',
    baseUrl: BASE_URL,
    sampleUrl: getApiUrl('transactions')
  });
} 