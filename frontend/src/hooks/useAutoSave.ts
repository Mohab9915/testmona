import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  /** The current value to persist. A change (by value, not reference) schedules a save. */
  value: T;
  /** Persist `value`. Thrown/rejected errors surface via `error` and set status to 'error'. */
  onSave: (value: T) => Promise<void>;
  /** Debounce window in ms between the last edit and the save call. */
  delay?: number;
  /** Set false to pause entirely - no debounce, no save, no dirty tracking (e.g. while a required field is empty). */
  enabled?: boolean;
  /** Defaults to a deep JSON comparison; pass a cheaper one for simple values. */
  isEqual?: (a: T, b: T) => boolean;
}

const defaultIsEqual = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Debounced auto-save: call once per form with the whole editable value, and
 * it persists itself shortly after the user stops changing it - no Save
 * button, no "unsaved changes" dialog. `status` drives a small inline
 * indicator (see AutoSaveIndicator) instead.
 *
 * A save in flight when another edit lands is not dropped: the newer value is
 * queued and flushed right after the in-flight one resolves, so the debounce
 * window only limits *frequency*, never which value ultimately wins.
 */
export function useAutoSave<T>({ value, onSave, delay = 900, enabled = true, isEqual = defaultIsEqual }: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const savedValueRef = useRef<T>(value);
  const latestValueRef = useRef<T>(value);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  latestValueRef.current = value;

  const runSave = useCallback(async () => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    const toSave = latestValueRef.current;
    if (isEqual(toSave, savedValueRef.current)) return;

    savingRef.current = true;
    setStatus('saving');
    setError(null);
    try {
      await onSaveRef.current(toSave);
      savedValueRef.current = toSave;
      setStatus('saved');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Failed to save');
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        runSave();
      }
    }
  }, [isEqual]);

  useEffect(() => {
    if (!enabled) return;
    if (isEqual(value, savedValueRef.current)) return;
    setStatus('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runSave, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay, enabled]);

  // A save queued right as the component unmounts (e.g. navigating away
  // inside the debounce window) still needs to land - fire it immediately
  // rather than losing the edit.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isEqual(latestValueRef.current, savedValueRef.current)) {
      onSaveRef.current(latestValueRef.current).catch(() => {});
    }
  }, []);

  /** Force an immediate save, bypassing the debounce (e.g. on blur of the last field, or Ctrl+Enter). */
  const flushNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return runSave();
  }, [runSave]);

  /** Adopt `value` as already-saved without calling onSave - use after loading fresh data from the server. */
  const markSaved = useCallback((next: T) => {
    savedValueRef.current = next;
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, flushNow, markSaved };
}
