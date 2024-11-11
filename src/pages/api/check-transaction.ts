import type { NextApiRequest, NextApiResponse } from 'next';

const CACHE_TTL = 30000;
const HIRO_API_TIMEOUT = 8000;
const MAX_RETRIES = 2;
const BASE_DELAY = 1000;

const cache = new Map<string, {data: any, timestamp: number}>();

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
      HIRO_API_TIMEOUT
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

// Add new status type
type TransactionStatus = 'success' | 'pending' | 'dropped' | 'not_found';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { txId } = req.query;

    if (!txId || typeof txId !== 'string') {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    const normalizedTxId = txId.startsWith('0x') ? txId.slice(2) : txId;

    // Check cache
    const cached = cache.get(normalizedTxId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json(cached.data);
    }

    try {
      const response = await fetchTransaction(normalizedTxId);

      if (response.status === 404) {
        // Check if transaction is dropped
        const mempoolResponse = await fetch(
          `https://api.mainnet.hiro.so/extended/v1/tx/mempool/${normalizedTxId}`
        );
        
        if (mempoolResponse.status === 404) {
          const data = { tx_status: 'dropped' as TransactionStatus };
          cache.set(normalizedTxId, { data, timestamp: Date.now() });
          return res.status(200).json(data);
        }
        
        const data = { tx_status: 'not_found' as TransactionStatus };
        cache.set(normalizedTxId, { data, timestamp: Date.now() });
        return res.status(200).json(data);
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if transaction is dropped due to timeout
      if (data.tx_status === 'dropped_replace_by_fee' || 
          data.tx_status === 'dropped_replace_across_fork' ||
          data.tx_status === 'dropped_stale_garbage_collect') {
        data.tx_status = 'dropped';
      }
      
      cache.set(normalizedTxId, { data, timestamp: Date.now() });
      return res.status(200).json(data);

    } catch (error) {
      if (error instanceof Error && error.message === 'TIMEOUT') {
        return res.status(200).json({ tx_status: 'pending' });
      }
      throw error;
    }

  } catch (error) {
    const apiError = error as ApiError;
    console.error('Transaction check error:', apiError.message);
    return res.status(200).json({ tx_status: 'pending' });
  }
}

// Clean up cache periodically
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, CACHE_TTL);

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
}; 