/**
 * Shared data hooks using React Query for cross-module sync.
 * All modules use these hooks to ensure consistent, cached, real-time data.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEnginesFromDB, createEngine, updateEngine,
  getAutopilotsFromDB, createAutopilot, updateAutopilot,
  getOpportunitiesFromDB, getTasksFromDB, updateTask,
  getTransactionsFromDB, getUserIdentity, upsertUserIdentity,
  getCredentialsFromDB
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  engines:      ['engines'] as const,
  autopilots:   ['autopilots'] as const,
  opportunities:['opportunities'] as const,
  tasks:        ['tasks'] as const,
  transactions: ['transactions'] as const,
  identity:     ['identity'] as const,
  credentials:  ['credentials'] as const,
};

// ─── Engines ──────────────────────────────────────────────────────────────────
export function useEngines() {
  return useQuery({
    queryKey: QUERY_KEYS.engines,
    queryFn: async () => {
      const { data, error } = await getEnginesFromDB();
      if (error) throw new Error(error.message ?? 'Engine fetch failed');
      return data ?? [];
    },
    staleTime: 30000,
  });
}

export function useUpdateEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateEngine(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.engines }),
    onError: (e: Error) => toast.error('Engine update failed: ' + e.message),
  });
}

export function useCreateEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (engine: Record<string, unknown>) => createEngine(engine),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.engines }),
    onError: (e: Error) => toast.error('Engine creation failed: ' + e.message),
  });
}

// ─── Autopilots ───────────────────────────────────────────────────────────────
export function useAutopilots() {
  return useQuery({
    queryKey: QUERY_KEYS.autopilots,
    queryFn: async () => {
      const { data, error } = await getAutopilotsFromDB();
      if (error) throw new Error(error.message ?? 'Autopilot fetch failed');
      return data ?? [];
    },
    staleTime: 30000,
  });
}

export function useUpdateAutopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateAutopilot(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.autopilots });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.engines });
    },
    onError: (e: Error) => toast.error('Autopilot update failed: ' + e.message),
  });
}

export function useCreateAutopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ap: Record<string, unknown>) => createAutopilot(ap),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.autopilots }),
    onError: (e: Error) => toast.error('Autopilot creation failed: ' + e.message),
  });
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export function useOpportunities(filters?: { category?: string; status?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.opportunities, filters],
    queryFn: async () => {
      const { data, error } = await getOpportunitiesFromDB(filters);
      if (error) throw new Error(error.message ?? 'Opportunities fetch failed');
      return data ?? [];
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export function useTasks() {
  return useQuery({
    queryKey: QUERY_KEYS.tasks,
    queryFn: async () => {
      const { data, error } = await getTasksFromDB();
      if (error) throw new Error(error.message ?? 'Tasks fetch failed');
      return data ?? [];
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateTask(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tasks });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
    },
    onError: (e: Error) => toast.error('Task update failed: ' + e.message),
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export function useTransactions() {
  return useQuery({
    queryKey: QUERY_KEYS.transactions,
    queryFn: async () => {
      const { data, error } = await getTransactionsFromDB();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30000,
  });
}

// ─── Identity ─────────────────────────────────────────────────────────────────
export function useIdentity() {
  return useQuery({
    queryKey: QUERY_KEYS.identity,
    queryFn: async () => {
      const { data, error } = await getUserIdentity();
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 60000,
  });
}

export function useUpdateIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertUserIdentity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.identity });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.autopilots });
    },
    onError: (e: Error) => toast.error('Identity update failed: ' + e.message),
  });
}

// ─── Credentials ──────────────────────────────────────────────────────────────
export function useCredentials() {
  return useQuery({
    queryKey: QUERY_KEYS.credentials,
    queryFn: async () => {
      const { data, error } = await getCredentialsFromDB();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60000,
  });
}

// ─── Tasks (create mutation) ──────────────────────────────────────────────────
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...task, user_id: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tasks });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
    },
    onError: (e: Error) => toast.error('Task creation failed: ' + e.message),
  });
}

// ─── Platform-wide stats (for Dashboard) ──────────────────────────────────────
export function usePlatformStats() {
  const engines = useEngines();
  const autopilots = useAutopilots();
  const tasks = useTasks();
  const transactions = useTransactions();
  const identity = useIdentity();

  const confirmed = (transactions.data ?? []) as { type: string; amount: number; status: string }[];
  const totalEarned = confirmed
    .filter(t => t.status === 'confirmed' && ['earning', 'bonus'].includes(t.type))
    .reduce((s, t) => s + t.amount, 0);

  const activeEngines = ((engines.data ?? []) as { status: string }[])
    .filter(e => ['active', 'running'].includes(e.status)).length;

  const runningTasks = ((tasks.data ?? []) as { status: string }[])
    .filter(t => ['running', 'queued'].includes(t.status)).length;

  const identityReady = (identity.data?.consent_given && (identity.data?.completeness_score ?? 0) >= 50) ?? false;

  return {
    totalEarned,
    activeEngines,
    autopilotCount: (autopilots.data ?? []).length,
    runningTasks,
    identityReady,
    isLoading: engines.isLoading || autopilots.isLoading || tasks.isLoading,
    engines: engines.data ?? [],
    autopilots: autopilots.data ?? [],
    tasks: tasks.data ?? [],
    transactions: transactions.data ?? [],
    identity: identity.data,
  };
}
