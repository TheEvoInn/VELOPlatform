/**
 * VELO 2.0 — useAIRouter hook
 * React interface for the credit-aware AI router singleton.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getRouterState, subscribeToRouterState, checkOllamaHealth,
  setAIMode, setSelectedModel, resetCloudStatus, pullOllamaModel,
  clearAICache, routedGenerate,
  type AIRouterState, type AIMode, type AIRouterOptions,
} from '@/lib/aiRouter';
import type { GenerateContentParams } from '@/lib/api';

export function useAIRouter() {
  const [state, setState] = useState<AIRouterState>(getRouterState());

  useEffect(() => {
    const unsub = subscribeToRouterState(s => setState({ ...s }));
    return unsub;
  }, []);

  const refreshOllamaStatus = useCallback(async () => {
    await checkOllamaHealth();
  }, []);

  const generate = useCallback(async (
    params: GenerateContentParams,
    options?: AIRouterOptions,
  ) => {
    return routedGenerate(params, options);
  }, []);

  const pullModel = useCallback(async (
    modelName: string,
    onProgress?: (status: string, percent?: number) => void,
  ) => {
    return pullOllamaModel(modelName, onProgress);
  }, []);

  return {
    // State
    mode:                    state.mode as AIMode,
    ollamaAvailable:         state.ollamaAvailable,
    ollamaChecked:           state.ollamaChecked,
    availableModels:         state.availableModels,
    selectedModel:           state.selectedModel,
    cloudCreditsOk:          state.cloudCreditsOk,
    consecutiveCloudFailures: state.consecutiveCloudFailures,
    forcedLocalMode:         state.forcedLocalMode,
    // Stats
    totalRequests:   state.totalRequests,
    cloudRequests:   state.cloudRequests,
    localRequests:   state.localRequests,
    cachedRequests:  state.cachedRequests,
    // Derived
    activeSource: (
      state.forcedLocalMode || state.mode === 'local'
        ? 'local'
        : state.mode === 'cloud'
        ? 'cloud'
        : state.ollamaAvailable && !state.cloudCreditsOk
        ? 'local'
        : 'cloud'
    ) as 'cloud' | 'local',
    localPercent: state.totalRequests > 0
      ? Math.round((state.localRequests / state.totalRequests) * 100)
      : 0,
    // Actions
    setMode:              setAIMode,
    setModel:             setSelectedModel,
    resetCloud:           resetCloudStatus,
    clearCache:           clearAICache,
    refreshOllama:        refreshOllamaStatus,
    generate,
    pullModel,
  };
}
