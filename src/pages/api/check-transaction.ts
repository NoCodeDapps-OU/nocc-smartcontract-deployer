import type { NextApiRequest, NextApiResponse } from 'next';

// Define the TransactionStatus type at the top
type TransactionStatus = 'success' | 'pending' | 'failed' | 'dropped' | 'not_found';

const CACHE_TTL = 30000;
const REQUEST_TIMEOUT = 8000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

// Add global request tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

const requestCounts = new Map<string, { count: number; timestamp: number }>();

const cache = new Map<string, {
  data: any;
  timestamp: number;
  status: TransactionStatus;
}>();

const CACHE_DURATION = {
  SUCCESS: 24 * 60 * 60 * 1000, // 24 hours for successful transactions
  FAILED: 12 * 60 * 60 * 1000,  // 12 hours for failed transactions
  DROPPED: 6 * 60 * 60 * 1000,  // 6 hours for dropped transactions
  PENDING: 30 * 1000            // 30 seconds for pending transactions
};

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchTransaction(txId: string, attempt = 0): Promise<Response> {
  try {
    const response = await fetchWithTimeout(
      `https://api.mainnet.hiro.so/extended/v1/tx/${txId}`,
      REQUEST_TIMEOUT
    );

    if (response.ok) return response;

    if (response.status === 404) {
      return response;
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryAfter * 1000);
      });
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempt);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
      return fetchTransaction(txId, attempt + 1);
    }

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
    }
    throw error;
  }
}

interface ApiError extends Error {
  status?: number;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { txId } = req.query;

    if (!txId || typeof txId !== 'string') {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    // Implement request throttling
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const normalizedTxId = txId.startsWith('0x') ? txId.slice(2) : txId;

    // Enhanced cache check
    const cached = cache.get(normalizedTxId);
    if (cached) {
      const cacheAge = now - cached.timestamp;
      // Use longer TTL for completed transactions
      const shouldUseCache = ['success', 'failed', 'dropped'].includes(cached.status) || 
                           cacheAge < CACHE_TTL;

      if (shouldUseCache) {
        return res.status(200).json(cached.data);
      }
    }

    try {
      const response = await fetchTransaction(normalizedTxId);

      if (response.status === 404) {
        const mempoolResponse = await fetch(
          `https://api.mainnet.hiro.so/extended/v1/tx/mempool/${normalizedTxId}`
        );
        
        if (mempoolResponse.status === 404) {
          const data = { tx_status: 'dropped' as TransactionStatus };
          cache.set(normalizedTxId, { data, timestamp: now, status: 'dropped' });
          return res.status(200).json(data);
        }
        
        const data = { tx_status: 'not_found' as TransactionStatus };
        cache.set(normalizedTxId, { data, timestamp: now, status: 'not_found' });
        return res.status(200).json(data);
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      let status: TransactionStatus = 'pending';
      if (data.tx_status === 'success') status = 'success';
      else if (data.tx_status?.startsWith('abort')) status = 'failed';
      else if (data.tx_status === 'dropped' || 
               data.tx_status === 'dropped_replace_by_fee' || 
               data.tx_status === 'dropped_replace_across_fork' ||
               data.tx_status === 'dropped_stale_garbage_collect') {
        status = 'dropped';
      }

      cache.set(normalizedTxId, { data, timestamp: now, status });
      return res.status(200).json(data);

    } catch (error) {
      if (error instanceof Error && error.message === 'TIMEOUT') {
        return res.status(200).json({ tx_status: 'pending' });
      }
      throw error;
    }

  } catch (error) {
    console.error('Transaction check error:', error);
    return res.status(200).json({ tx_status: 'pending' });
  }
}

// Update the cache cleanup interval
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Run cleanup every 5 minutes

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    const duration = value.status === 'success' ? CACHE_DURATION.SUCCESS :
                    value.status === 'failed' ? CACHE_DURATION.FAILED :
                    value.status === 'dropped' ? CACHE_DURATION.DROPPED :
                    CACHE_DURATION.PENDING;
                    
    if (now - value.timestamp > duration) {
      cache.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
}; 