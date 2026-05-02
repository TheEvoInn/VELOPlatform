import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ─── Helper ───────────────────────────────────────────────────────────────────
async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const code = error.context?.status ?? 500;
        const text = await error.context?.text();
        msg = `[${code}] ${text || error.message}`;
      } catch { /* fallback to original */ }
    }
    return { data: null, error: msg };
  }
  return { data: data as T, error: null };
}

// ─── AI Content ───────────────────────────────────────────────────────────────
export interface GenerateContentParams {
  content_type: 'cover_letter' | 'resume' | 'bio' | 'message' | 'product_description' | 'research_summary' | 'crypto_submission' | 'tweet' | 'email' | 'raw';
  context: Record<string, unknown>;
  identity?: {
    name: string;
    persona: string;
    tone: string;
    style: string;
    rules?: string[];
    coverLetterTemplate?: string;
  };
  autopilot_id?: string;
  opportunity_id?: string;
}

export async function generateAIContent(params: GenerateContentParams): Promise<{ text: string | null; error: string | null }> {
  const { data, error } = await invokeFunction<{ text: string }>('ai-content', params);
  return { text: data?.text ?? null, error };
}

// ─── Opportunity Feed ─────────────────────────────────────────────────────────
export async function fetchOpportunityFeed(categories: string[] = [], limit = 20) {
  return invokeFunction<{ opportunities: unknown[]; count: number; sources: string[] }>(
    'opportunity-feed',
    { categories, limit }
  );
}

// ─── Matching Engine ──────────────────────────────────────────────────────────
export async function runMatchingEngine(opportunityId: string, autoAssign = false) {
  return invokeFunction<{ matches: unknown[]; opportunity: unknown }>(
    'matching-engine',
    { opportunity_id: opportunityId, auto_assign: autoAssign }
  );
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  return { data, error };
}

export async function markNotificationsRead(ids: string[]) {
  return supabase.from('notifications').update({ is_read: true }).in('id', ids);
}

export async function markAllNotificationsRead() {
  return supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
}

export async function createNotification(params: {
  type: string; title: string; message: string;
  data?: Record<string, unknown>; priority?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  return supabase.from('notifications').insert({ user_id: user.id, ...params }).select().single();
}

// ─── Profit Engines ───────────────────────────────────────────────────────────
export async function getEnginesFromDB() {
  return supabase.from('profit_engines').select('*').order('created_at', { ascending: false });
}

export async function createEngine(engine: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  return supabase.from('profit_engines').insert({ ...engine, user_id: user.id }).select().single();
}

export async function updateEngine(id: string, updates: Record<string, unknown>) {
  return supabase.from('profit_engines').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
}

// ─── Autopilots ───────────────────────────────────────────────────────────────
export async function getAutopilotsFromDB() {
  return supabase.from('autopilots').select('*').order('created_at', { ascending: false });
}

export async function createAutopilot(ap: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  return supabase.from('autopilots').insert({ ...ap, user_id: user.id }).select().single();
}

export async function updateAutopilot(id: string, updates: Record<string, unknown>) {
  return supabase.from('autopilots').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export async function getOpportunitiesFromDB(filters?: { category?: string; status?: string }) {
  let query = supabase.from('opportunities').select('*').order('scanned_at', { ascending: false });
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.status) query = query.eq('status', filters.status);
  return query.limit(100);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasksFromDB() {
  return supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(50);
}

export async function updateTask(id: string, updates: Record<string, unknown>) {
  return supabase.from('tasks').update(updates).eq('id', id).select().single();
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
export async function getTransactionsFromDB() {
  return supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(100);
}

export async function withdrawFunds(amount: number, description = 'Manual withdrawal') {
  return invokeFunction('wallet-ops', { action: 'withdraw', amount, description });
}

export async function addEarning(amount: number, currency: string, description: string, taskId?: string) {
  return invokeFunction('wallet-ops', { action: 'add_earning', amount, currency, description, task_id: taskId });
}

// ─── Credentials ──────────────────────────────────────────────────────────────
export async function getCredentialsFromDB() {
  return supabase.from('credentials').select('id, name, type, platform, is_encrypted, last_accessed, created_at').order('created_at', { ascending: false });
}

export async function addCredential(cred: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  return supabase.from('credentials').insert({ ...cred, user_id: user.id }).select().single();
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
export async function getOnboardingProgress() {
  return supabase.from('onboarding_progress').select('*').maybeSingle();
}

export async function upsertOnboardingProgress(updates: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  return supabase.from('onboarding_progress').upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' }).select().single();
}

// ─── Crypto Tasks ─────────────────────────────────────────────────────────────
export async function getCryptoTasksFromDB() {
  return supabase.from('crypto_tasks').select('*').order('created_at', { ascending: false });
}

// ─── Dropship ─────────────────────────────────────────────────────────────────
export async function getDropshipProductsFromDB() {
  return supabase.from('dropship_products').select('*').order('created_at', { ascending: false });
}

export async function getDropshipOrdersFromDB() {
  return supabase.from('dropship_orders').select('*').order('created_at', { ascending: false });
}

// ─── User Identity ────────────────────────────────────────────────────────────
export interface UserIdentity {
  id?: string;
  user_id?: string;
  full_name?: string;
  display_name?: string;
  date_of_birth?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  location_country?: string;
  location_city?: string;
  timezone?: string;
  headline?: string;
  bio?: string;
  years_experience?: number;
  skills?: string[];
  languages?: string[];
  hourly_rate_min?: number;
  hourly_rate_currency?: string;
  has_id_document?: boolean;
  has_portfolio?: boolean;
  portfolio_url?: string;
  linkedin_url?: string;
  github_url?: string;
  consent_given?: boolean;
  consent_timestamp?: string;
  consent_scope?: string[];
  approved_for_applications?: boolean;
  approved_for_registration?: boolean;
  approved_for_communication?: boolean;
  completeness_score?: number;
  missing_fields?: string[];
  created_at?: string;
  updated_at?: string;
  // Extended real-world fields
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  tax_id?: string;
  tax_country?: string;
  payment_paypal?: string;
  payment_bank_account?: string;
  payment_wise?: string;
  payment_crypto_address?: string;
  security_question_1?: string;
  security_answer_1?: string;
  security_question_2?: string;
  security_answer_2?: string;
  id_document_type?: string;
  id_document_number?: string;
  id_document_expiry?: string;
  professional_title?: string;
  employer?: string;
  work_authorization?: string;
}

export async function getUserIdentity(): Promise<{ data: UserIdentity | null; error: string | null }> {
  const { data, error } = await supabase.from('user_identity').select('*').maybeSingle();
  return { data: data as UserIdentity | null, error: error?.message ?? null };
}

export async function upsertUserIdentity(identity: Partial<UserIdentity>): Promise<{ data: UserIdentity | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('user_identity')
    .upsert({ ...identity, user_id: user.id }, { onConflict: 'user_id' })
    .select()
    .single();
  return { data: data as UserIdentity | null, error: error?.message ?? null };
}

export async function giveIdentityConsent(scope: string[]): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase
    .from('user_identity')
    .upsert({
      user_id: user.id,
      consent_given: true,
      consent_timestamp: new Date().toISOString(),
      consent_scope: scope,
      approved_for_applications: true,
      approved_for_registration: true,
      approved_for_communication: true,
    }, { onConflict: 'user_id' });
  // Log it
  await supabase.from('identity_consent_log').insert({
    user_id: user.id,
    action: 'consent_given',
    purpose: 'User granted consent for identity use in applications',
    fields_accessed: scope,
    approved_by_user: true,
  });
  return { error: error?.message ?? null };
}

export async function revokeIdentityConsent(): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase
    .from('user_identity')
    .update({
      consent_given: false,
      consent_timestamp: null,
      approved_for_applications: false,
      approved_for_registration: false,
      approved_for_communication: false,
    })
    .eq('user_id', user.id);
  await supabase.from('identity_consent_log').insert({
    user_id: user.id,
    action: 'consent_revoked',
    purpose: 'User revoked identity consent',
    fields_accessed: [],
    approved_by_user: false,
  });
  return { error: error?.message ?? null };
}

export async function getIdentityConsentLog() {
  return supabase
    .from('identity_consent_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
}

export async function logIdentityAccess(params: {
  action: string;
  purpose: string;
  fields_accessed: string[];
  platform?: string;
  autopilot_id?: string;
  opportunity_id?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('identity_consent_log').insert({
    user_id: user.id,
    ...params,
    approved_by_user: true,
  });
}

export async function runEligibilityCheck(autopilotId: string, opportunityId?: string) {
  return invokeFunction<{
    is_eligible: boolean;
    checks: Array<{ check: string; passed: boolean; message: string }>;
    missing_requirements: string[];
    requires_approval: boolean;
    eligibility_id: string;
  }>('identity-ops', {
    action: 'eligibility_check',
    autopilot_id: autopilotId,
    opportunity_id: opportunityId,
  });
}

export async function getAutopilotEligibilityHistory(autopilotId: string) {
  return supabase
    .from('autopilot_eligibility')
    .select('*')
    .eq('autopilot_id', autopilotId)
    .order('created_at', { ascending: false })
    .limit(10);
}
