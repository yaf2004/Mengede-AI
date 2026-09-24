import { useSyncExternalStore } from 'react';
import { getInitState, subscribeInit } from '../lib/voxide.js';

// { status: 'idle' | 'loading' | 'ready' | 'error', error }
export function useVoxideInit() {
  return useSyncExternalStore(subscribeInit, getInitState);
}
