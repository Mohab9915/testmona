/**
 * Enhanced API Call Hook with Retry Logic and Partial Failure Handling
 * Provides automatic retry, request queuing, and graceful degradation
 */

import { useState, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { queueRequest, getQueuedRequests, dequeueRequest, updateRequestRetry, clearQueue, removeExpiredRequests } from '@/utils/requestQueue';

export interface ApiCallOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  queueOffline?: boolean;
  onPartialSuccess?: (successCount: number, totalCount: number) => void;
  onRetry?: (attempt: number, error: any) => void;
}

export interface ApiCallResult<T> {
  data: T | null;
  error: any;
  isLoading: boolean;
  isRetrying: boolean;
  retryCount: number;
  isQueued: boolean;
}

export const useEnhancedApiCall = () => {
  const { isOnline, checkBackendConnectivity } = useNetworkStatus();
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const processingQueueRef = useRef(false);

  /**
   * Sleep function for retry delays
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Check if error is retryable
   */
  const isRetryableError = (error: any): boolean => {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const retryableErrors = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENETDOWN'];
    
    return (
      retryableStatuses.includes(error.response?.status) ||
      retryableErrors.includes(error.code) ||
      error.message?.includes('timeout') ||
      error.message?.includes('network') ||
      error.message?.includes('fetch failed')
    );
  };

  /**
   * Process queued requests when connection is restored
   */
  const processQueuedRequests = useCallback(async () => {
    if (processingQueueRef.current || !isOnline) {
      return;
    }

    processingQueueRef.current = true;
    setIsProcessingQueue(true);

    try {
      removeExpiredRequests();
      const queue = getQueuedRequests();
      
      if (queue.length === 0) {
        return;
      }


      for (const request of queue) {
        if (request.retries >= request.maxRetries) {
          dequeueRequest(request.id);
          continue;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(request.url, {
            method: request.method,
            headers: {
              'Content-Type': 'application/json',
              ...request.headers,
            },
            body: request.data ? JSON.stringify(request.data) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            dequeueRequest(request.id);
          } else {
            throw new Error(`Request failed with status ${response.status}`);
          }
        } catch (error) {
          console.error(`Failed to process queued request ${request.id}:`, error);
          updateRequestRetry(request.id, request.retries + 1);
          
          // Wait before next retry
          await sleep(1000 * (request.retries + 1));
        }
      }
    } catch (error) {
      console.error('Error processing queued requests:', error);
    } finally {
      processingQueueRef.current = false;
      setIsProcessingQueue(false);
    }
  }, [isOnline]);

  /**
   * Make an enhanced API call with retry and queuing
   */
  const enhancedApiCall = useCallback(async <T>(
    apiMethod: () => Promise<T>,
    options: ApiCallOptions = {}
  ): Promise<ApiCallResult<T>> => {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      timeout = 30000,
      queueOffline = true,
      onRetry,
    } = options;

    let lastError: any;
    let retryCount = 0;

    // Check if offline and queue the request
    if (!isOnline && queueOffline) {
      try {
        // Cannot extract URL/method from the API function for offline queuing
        // This is a limitation of the current architecture where API methods are closures
        // To enable offline queuing, API methods would need to be refactored to accept
        // explicit URL/method/data parameters or use a different queuing strategy
        console.warn('Offline queuing not available: Cannot extract request details from API function');
        return {
          data: null,
          error: new Error('You are offline. Please check your connection and try again.'),
          isLoading: false,
          isRetrying: false,
          retryCount: 0,
          isQueued: false,
        };
      } catch (error) {
        console.error('Failed to handle offline request:', error);
      }
    }

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        const result = await Promise.race([
          apiMethod(),
          timeoutPromise,
        ]);

        // If successful and we were offline, process queued requests
        if (isOnline && getQueuedRequests().length > 0 && !processingQueueRef.current) {
          processQueuedRequests();
        }

        return {
          data: result,
          error: null,
          isLoading: false,
          isRetrying: false,
          retryCount,
          isQueued: false,
        };
      } catch (error: any) {
        lastError = error;
        retryCount = attempt;

        if (!isRetryableError(error) || attempt === maxRetries) {
          break;
        }

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    return {
      data: null,
      error: lastError,
      isLoading: false,
      isRetrying: false,
      retryCount,
      isQueued: false,
    };
  }, [isOnline, processQueuedRequests]);

  /**
   * Make bulk API calls with partial failure handling
   */
  const enhancedBulkApiCall = useCallback(async <T>(
    apiMethods: Array<() => Promise<T>>,
    options: ApiCallOptions = {}
  ): Promise<{ results: ApiCallResult<T>[]; successCount: number; failureCount: number }> => {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      onPartialSuccess,
    } = options;

    const results = await Promise.allSettled(
      apiMethods.map(method => enhancedApiCall(method, { maxRetries, retryDelay }))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.data !== null).length;
    const failureCount = results.length - successCount;

    if (onPartialSuccess && successCount > 0) {
      onPartialSuccess(successCount, results.length);
    }

    return {
      results: results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            data: null,
            error: result.reason,
            isLoading: false,
            isRetrying: false,
            retryCount: maxRetries,
            isQueued: false,
          };
        }
      }),
      successCount,
      failureCount,
    };
  }, [enhancedApiCall]);

  /**
   * Get queue status
   */
  const getQueueStatus = useCallback(() => {
    const queue = getQueuedRequests();
    return {
      size: queue.length,
      requests: queue,
      isProcessing: isProcessingQueue,
    };
  }, [isProcessingQueue]);

  /**
   * Clear the queue
   */
  const clearRequestQueue = useCallback(() => {
    clearQueue();
  }, []);

  return {
    enhancedApiCall,
    enhancedBulkApiCall,
    getQueueStatus,
    clearRequestQueue,
    isProcessingQueue,
    processQueuedRequests,
  };
};
