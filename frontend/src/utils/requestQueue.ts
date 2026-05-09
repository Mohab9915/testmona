/**
 * Request Queue System for Offline Operations
 * Stores failed requests in localStorage and retries them when connection is restored
 */

export interface QueuedRequest {
  id: string;
  timestamp: number;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  retries: number;
  maxRetries: number;
}

const QUEUE_KEY = 'offline_request_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 5;

/**
 * Get all queued requests
 */
export const getQueuedRequests = (): QueuedRequest[] => {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Failed to get queued requests:', error);
    return [];
  }
};

/**
 * Add a request to the queue
 */
export const queueRequest = (
  method: QueuedRequest['method'],
  url: string,
  data?: any,
  headers?: Record<string, string>
): void => {
  try {
    const queue = getQueuedRequests();
    
    // Check queue size limit
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn('Request queue is full, removing oldest request');
      queue.shift();
    }
    
    const request: QueuedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      method,
      url,
      data,
      headers,
      retries: 0,
      maxRetries: MAX_RETRIES,
    };
    
    queue.push(request);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to queue request:', error);
  }
};

/**
 * Remove a request from the queue
 */
export const dequeueRequest = (requestId: string): void => {
  try {
    const queue = getQueuedRequests();
    const filteredQueue = queue.filter(req => req.id !== requestId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filteredQueue));
  } catch (error) {
    console.error('Failed to dequeue request:', error);
  }
};

/**
 * Clear all queued requests
 */
export const clearQueue = (): void => {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (error) {
    console.error('Failed to clear queue:', error);
  }
};

/**
 * Update request retry count
 */
export const updateRequestRetry = (requestId: string, retries: number): void => {
  try {
    const queue = getQueuedRequests();
    const updatedQueue = queue.map(req => 
      req.id === requestId ? { ...req, retries } : req
    );
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('Failed to update request retry:', error);
  }
};

/**
 * Get queue size
 */
export const getQueueSize = (): number => {
  return getQueuedRequests().length;
};

/**
 * Remove expired requests (older than 24 hours)
 */
export const removeExpiredRequests = (): void => {
  try {
    const queue = getQueuedRequests();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    const validQueue = queue.filter(req => now - req.timestamp < maxAge);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(validQueue));
  } catch (error) {
    console.error('Failed to remove expired requests:', error);
  }
};
