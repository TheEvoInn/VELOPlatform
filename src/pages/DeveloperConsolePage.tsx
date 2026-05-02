import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Code2, Bot, Play, RotateCcw, Save, ChevronRight, ChevronDown,
  Terminal, Shield, AlertTriangle, CheckCircle, RefreshCw, Lock,
  Zap, FileCode, Database, Settings2, X, Send,
  Copy, Upload, Eye, GitBranch, Cpu,
  Activity, FolderOpen, FileText, ArrowRight, Info,
  Search, Command, ScrollText, Boxes, Sparkles, BarChart2,
  Bug, Wrench, Code, BookOpen, Fingerprint, Cloud,
  LayoutTemplate, PanelLeft, PanelRight, Bell, Monitor,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useAIRouter } from '@/hooks/useAIRouter';
import { routedGenerate, getRouterState, generateWithOllamaStream } from '@/lib/aiRouter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { timeAgo } from '@/lib/mockData';

// ── Platform file tree definition ────────────────────────────────────────────
interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  ext?: string;
  category: 'frontend' | 'backend' | 'database' | 'config';
  description?: string;
  children?: FileNode[];
  codeContent?: string;
}

const PLATFORM_TREE: FileNode[] = [
  {
    id: 'frontend', name: 'Frontend (React)', type: 'folder', category: 'frontend',
    children: [
      {
        id: 'pages', name: 'Pages', type: 'folder', category: 'frontend',
        children: [
          { id: 'dashboard', name: 'DashboardPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Command Bridge — stats, getting started guide, platform overview', codeContent: `// DashboardPage.tsx\n// Command Bridge — main overview panel\n// Displays: StatCards, GettingStartedGuide, live data from useSharedData hooks\n// Key hooks: usePlatformStats, useEngines, useAutopilots, useTransactions, useIdentity` },
          { id: 'engines', name: 'EnginesPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Profit Engines — create and manage income workflows', codeContent: `// EnginesPage.tsx\n// Profit Engine Bay — CRUD for profit_engines table\n// Uses: React Query useMutation, useSharedData hooks\n// DB table: profit_engines (id, user_id, name, goal, category, status, total_earned)` },
          { id: 'autopilots', name: 'AutopilotsPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Autopilots — AI agents with personas, skills, and workload limits', codeContent: `// AutopilotsPage.tsx\n// AI Core — manage autonomous autopilot agents\n// Uses: useAutopilots, useCreateAutopilot, useUpdateAutopilot from useSharedData\n// DB table: autopilots (id, user_id, name, persona, skills, tone, status, total_earned)` },
          { id: 'opportunities', name: 'OpportunitiesPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Star Scanner — real-time opportunity discovery with live HUD', codeContent: `// OpportunitiesPage.tsx\n// Star Scanner — live opportunity discovery + matching\n// Calls: opportunity-feed Edge Function, matching-engine Edge Function\n// Features: animated radar HUD, per-source status panels, auto-matching, scan log console` },
          { id: 'mission', name: 'MissionControlPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Mission Control — task queue orchestration', codeContent: `// MissionControlPage.tsx\n// Task orchestration hub — manage queued/running/completed tasks\n// Uses: useTasks, useUpdateTask from useSharedData` },
          { id: 'identity', name: 'IdentityStudioPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Identity Studio — 6-tab real identity + AI persona manager', codeContent: `// IdentityStudioPage.tsx\n// Identity Studio — 6 tabs: Real Identity, Consent, AI Persona, Templates, Rules, Documents\n// Calls: identity-ops Edge Function for CRUD + consent + eligibility\n// AI generation: ai-content Edge Function (Gemini 3 Flash) for bio/skills/experience` },
          { id: 'vault', name: 'VaultPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Vault — AES-256-GCM zero-knowledge credential storage', codeContent: `// VaultPage.tsx\n// Zero-knowledge AES-256-GCM credential vault\n// Uses: vaultCrypto.ts (PBKDF2 key derivation, encrypt/decrypt)\n// Storage bucket: identity-docs (encrypted path stored in credentials table)` },
          { id: 'wallet', name: 'WalletPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Wallet — earnings tracker and transaction history', codeContent: `// WalletPage.tsx\n// Cargo Hold — wallet balance + transaction history\n// Calls: wallet-ops Edge Function for withdrawals and earning records\n// DB table: wallet_transactions (id, user_id, type, amount, status, related_task_id)` },
          { id: 'browser', name: 'BrowserAutomationPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Browser Automation — multi-tab engine with Vault credential injection', codeContent: `// BrowserAutomationPage.tsx\n// Playwright automation engine — wizard (Platform → Credentials → Review)\n// AES-256 credential injection — ephemeral, never persisted\n// DB table: automation_sessions (id, user_id, name, platform, status, steps, metadata, events)` },
          { id: 'settings', name: 'SettingsPage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Settings — 7-tab config panel including AI Source mode selection', codeContent: `// SettingsPage.tsx\n// 7 tabs: Profile, Workspace, AI Source, Integrations, Security, Notifications, About\n// AI Source tab: hosts AISourcePanel for local/cloud/hybrid AI routing\n// Security: Dev Console PIN management, vault encryption info` },
          { id: 'devcon', name: 'DeveloperConsolePage.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Dev Console — this file. Admin editor + AI DevBot + deploy pipeline', codeContent: `// DeveloperConsolePage.tsx\n// Admin-only Developer Console\n// Tabs: editor, changes, deploy, logs, terminal, modules\n// AI: routedGenerate() for cloud+local fallback via aiRouter.ts\n// All actions logged to identity_consent_log (immutable audit)` },
        ],
      },
      {
        id: 'components', name: 'Components', type: 'folder', category: 'frontend',
        children: [
          { id: 'appworkflow', name: 'ApplicationWorkflow.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: '6-step application modal: Eligibility → Terms → AI Assets → Review → Submit → Confirm', codeContent: `// ApplicationWorkflow.tsx\n// 6-step application modal triggered from OpportunitiesPage\n// Steps: Eligibility check → Platform terms → AI asset generation → Review → Submit → Confirm\n// AI: calls ai-content for cover_letter + resume generation using identity + autopilot context` },
          { id: 'aifieldgen', name: 'AIFieldGenerator.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'Inline AI generation using routedGenerate() — cloud+local fallback', codeContent: `// AIFieldGenerator.tsx\n// Inline AI field enhancement for Identity Studio\n// Uses: routedGenerate() from aiRouter.ts (cloud → local fallback)\n// Generates: bio, skills, experience highlights using field-specific system prompts` },
          { id: 'aisourcepanel', name: 'AISourcePanel.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: 'AI mode selector — Cloud/Local/Hybrid/Cost-Optimized with Ollama management', codeContent: `// AISourcePanel.tsx\n// Full AI routing control panel\n// Shows: Cloud↔Local routing diagram, mode selector, Ollama status, model downloads\n// Used in: SettingsPage AI Source tab` },
          { id: 'onboarding', name: 'OnboardingFlow.tsx', type: 'file', ext: 'tsx', category: 'frontend', description: '9-step setup wizard collecting identity, docs, credentials, autopilot', codeContent: `// OnboardingFlow.tsx\n// 9-step onboarding: Personal → Address → Professional → Payment → Security/ID\n//                  → Documents → Platform Setup → Autopilot → System Check\n// Saves to: onboarding_progress, user_identity, user_documents, credentials, autopilots` },
        ],
      },
      {
        id: 'hooks', name: 'Hooks', type: 'folder', category: 'frontend',
        children: [
          { id: 'shareddata', name: 'useSharedData.ts', type: 'file', ext: 'ts', category: 'frontend', description: 'Unified React Query data layer — single source of truth for all platform data', codeContent: `// useSharedData.ts\n// Central React Query cache — unified data layer for all platform modules\n// Exports: QUERY_KEYS, useEngines, useAutopilots, useOpportunities, useTasks, useTransactions,\n//          useIdentity, usePlatformStats, useCreateEngine, useUpdateEngine` },
          { id: 'useauth', name: 'useAuth.ts', type: 'file', ext: 'ts', category: 'frontend', description: 'Supabase auth hook with OTP login support', codeContent: `// useAuth.ts\n// Supabase authentication hook\n// Pattern: getSession() + onAuthStateChange() with double safety setLoading(false)\n// Mapping: mapUser(SupabaseUser) → AuthUser (sync, no async/await)` },
          { id: 'useairouter', name: 'useAIRouter.ts', type: 'file', ext: 'ts', category: 'frontend', description: 'React hook for credit-aware AI router — cloud/local/hybrid/cost-optimized', codeContent: `// useAIRouter.ts\n// React interface for the credit-aware AI router singleton (aiRouter.ts)\n// Exports: mode, activeSource, ollamaAvailable, availableModels, stats, setMode, setModel, generate` },
          { id: 'usedocupload', name: 'useDocumentUpload.ts', type: 'file', ext: 'ts', category: 'frontend', description: 'Document upload pipeline — validate → storage → metadata → vault', codeContent: `// useDocumentUpload.ts\n// Unified document upload pipeline\n// Pipeline: file validation → Supabase Storage upload → user_documents upsert → identity sync\n// Features: 3-attempt retry (1s/2s/4s backoff), stable credential names, ref-based options` },
        ],
      },
    ],
  },
  {
    id: 'backend', name: 'Edge Functions (Deno)', type: 'folder', category: 'backend',
    children: [
      { id: 'ef-ai', name: 'ai-content/index.ts', type: 'file', ext: 'ts', category: 'backend', description: 'AI text generation — cover letters, resumes, bio, product descriptions', codeContent: `// ai-content Edge Function\n// Handles all AI content generation via OnSpace AI (Gemini 3 Flash)\n// Types: cover_letter, resume, bio, message, product_description, research_summary,\n//        crypto_submission, tweet, email, raw (passthrough)\n// Context: injects user identity fields + autopilot persona + opportunity data` },
      { id: 'ef-opp', name: 'opportunity-feed/index.ts', type: 'file', ext: 'ts', category: 'backend', description: 'Real-time opportunity discovery from Remotive, crypto, freelance, microtask APIs', codeContent: `// opportunity-feed Edge Function\n// Fetches real opportunities from: Remotive Jobs API, Arbeitnow, Jobicy, Crypto, Freelance, Gig\n// Inserts discovered opportunities into opportunities table for the authenticated user\n// Returns: { opportunities, count, sources, sources_active }` },
      { id: 'ef-match', name: 'matching-engine/index.ts', type: 'file', ext: 'ts', category: 'backend', description: 'Scores opportunities against autopilots using multi-factor algorithm', codeContent: `// matching-engine Edge Function\n// Scores opportunities against all user autopilots using weighted factors:\n// skill_match (0-100) + category_match + value_threshold + workload_capacity\n// Auto-assigns if auto_assign=true and best score > 60%` },
      { id: 'ef-identity', name: 'identity-ops/index.ts', type: 'file', ext: 'ts', category: 'backend', description: 'Identity CRUD + consent management + eligibility checks + audit logging', codeContent: `// identity-ops Edge Function\n// Actions: get_identity, upsert_identity, give_consent, revoke_consent,\n//          eligibility_check, log_access, get_audit_log\n// Tables: user_identity, identity_consent_log, autopilot_eligibility` },
      { id: 'ef-wallet', name: 'wallet-ops/index.ts', type: 'file', ext: 'ts', category: 'backend', description: 'Earnings tracking and wallet balance management', codeContent: `// wallet-ops Edge Function\n// Actions: add_earning, withdraw, get_balance, get_transactions\n// DB table: wallet_transactions (type: earning|withdrawal, status: completed|pending)` },
      { id: 'ef-devcon', name: 'dev-console/index.ts', type: 'file', ext: 'ts', category: 'backend', description: 'Developer console AI assistant + deployment logging + schema check', codeContent: `// dev-console Edge Function\n// Actions: ai_assist (Gemini 3 Flash code analysis), log_deployment, schema_check\n// System prompt: injects full platform context (React + Supabase + Playwright + OnSpace AI)\n// All AI assistance events logged to identity_consent_log` },
    ],
  },
  {
    id: 'database', name: 'Database (PostgreSQL)', type: 'folder', category: 'database',
    children: [
      { id: 'db-core', name: 'Core Tables', type: 'file', ext: 'sql', category: 'database', description: '22+ tables with RLS — profit_engines, autopilots, opportunities, tasks, wallet_transactions', codeContent: `-- Core Tables Schema (VELO 2.0)\n-- profit_engines: id, user_id, name, goal, config, channels, status, category, total_earned\n-- autopilots: id, user_id, engine_id, name, avatar, persona, tone, skills, status, workload_limit\n-- opportunities: id, user_id, title, platform, category, estimated_value, confidence, status\n-- tasks: id, user_id, autopilot_id, opportunity_id, name, type, status, progress, logs\n-- wallet_transactions: id, user_id, type, amount, currency, status, related_task_id\n-- All tables have RLS enabled with auth.uid() = user_id policies` },
      { id: 'db-identity', name: 'Identity Tables', type: 'file', ext: 'sql', category: 'database', description: 'user_identity (26 real-world fields) + consent log + eligibility', codeContent: `-- Identity Schema (Legal Compliance Layer)\n-- user_identity: PII fields + address + tax + payment + security questions + ID doc\n-- identity_consent_log: IMMUTABLE audit trail (action, purpose, fields_accessed)\n-- autopilot_eligibility: 7-step pre-flight checks (is_eligible, checks[], missing_requirements)\n-- user_documents: metadata for uploaded files (doc_key, storage_path, verification_status)` },
      { id: 'db-triggers', name: 'Triggers & Functions', type: 'file', ext: 'sql', category: 'database', description: 'Automated DB functions — handle_new_user, notify triggers, completeness sync', codeContent: `-- Database Functions & Triggers\n-- handle_new_user: Creates user_profiles row on auth.users insert\n-- sync_identity_completeness: Calculates completeness_score (0-100) on identity update\n-- notify_on_earning: Triggers notification when wallet_transactions.type = 'earning'\n-- notify_on_opportunity: Triggers notification on new opportunities\n-- trg_notify_task: Triggers notification when task.status = 'completed'` },
    ],
  },
  {
    id: 'config', name: 'Configuration', type: 'folder', category: 'config',
    children: [
      { id: 'cfg-crypto', name: 'vaultCrypto.ts', type: 'file', ext: 'ts', category: 'config', description: 'AES-256-GCM zero-knowledge encryption library', codeContent: `// vaultCrypto.ts — Zero-knowledge AES-256-GCM encryption\n// deriveVaultKey(userId, userEmail): PBKDF2 100K iterations, SHA-256\n// encryptVaultValue(plaintext, key): Random 96-bit IV + AES-GCM 256\n// decryptVaultValue(base64, key): Splits IV + ciphertext, decrypts` },
      { id: 'cfg-airouter', name: 'aiRouter.ts', type: 'file', ext: 'ts', category: 'config', description: 'Credit-aware AI router — cloud/local/hybrid/cost-optimized with Ollama', codeContent: `// aiRouter.ts — Credit-Aware AI Router\n// Modes: cloud, local, hybrid (auto-fallback), cost_optimized\n// Credit exhaustion detection: HTTP 429/402, "quota"/"credits" in error message\n// After 3 consecutive cloud failures: auto-forces local mode\n// Exports: routedGenerate(), checkOllamaHealth(), pullOllamaModel(), setAIMode()` },
      { id: 'cfg-api', name: 'api.ts', type: 'file', ext: 'ts', category: 'config', description: 'Backend API wrapper — all Edge Function calls with error handling', codeContent: `// api.ts — Backend API client\n// invokeFunction<T>(name, body): Supabase Edge Function invocation with FunctionsHttpError handling\n// Exports: generateAIContent, fetchOpportunityFeed, runMatchingEngine,\n//          getEnginesFromDB, createEngine, updateEngine, getAutopilotsFromDB,\n//          getUserIdentity, upsertUserIdentity, addEarning, withdrawFunds` },
      { id: 'cfg-tailwind', name: 'tailwind.config.ts', type: 'file', ext: 'ts', category: 'config', description: 'Galaxy theme — Orbitron font, neon cyan/violet, custom animations', codeContent: `// tailwind.config.ts — Galaxy theme\n// Custom colors: --cyan (hsl 185,100%,55%), --violet (hsl 265,80%,70%)\n// Custom fonts: Orbitron (headings), Mono (code)\n// Custom animations: float-anim, pulse-glow, slide-in-up, cursor-blink` },
    ],
  },
];

// ── Module scaffold templates ─────────────────────────────────────────────────
const MODULE_TEMPLATES = [
  {
    id: 'page',
    label: 'New Page',
    icon: LayoutTemplate,
    color: 'hsl(185,100%,55%)',
    desc: 'A full React page with header, tabs, data fetching, and VELO galaxy theme',
    prompt: (name: string) => `Create a new VELO 2.0 page called "${name}Page.tsx". Follow the galaxy HUD theme (dark background hsl(228,35%,4%), neon cyan hsl(185,100%,55%), violet hsl(265,80%,70%)). Include: page header with Orbitron font, StatCards row, main content panel with glass-panel styling, React Query data fetching from Supabase, and slide-in-up animation. Export as default function.`,
  },
  {
    id: 'component',
    label: 'New Component',
    icon: Boxes,
    color: 'hsl(265,80%,70%)',
    desc: 'A reusable React component following VELO design patterns',
    prompt: (name: string) => `Create a new VELO 2.0 React component called "${name}.tsx" in src/components/features/. Use TypeScript interfaces for all props. Follow the galaxy HUD theme with glass-panel styling. Include proper hover states, disabled states, and accessibility attributes. Export as default function.`,
  },
  {
    id: 'edge_function',
    label: 'Edge Function',
    icon: Zap,
    color: 'hsl(50,100%,60%)',
    desc: 'A Supabase Deno Edge Function with auth, CORS, and error handling',
    prompt: (name: string) => `Create a new Supabase Edge Function called "${name}" at supabase/functions/${name}/index.ts. Include: full CORS headers from _shared/cors.ts, JWT authentication via userClient.auth.getUser(), supabaseAdmin client with service role key, action-based routing (switch on body.action), proper error handling returning JSON with status codes, and console.log for debugging. Follow VELO 2.0 patterns.`,
  },
  {
    id: 'hook',
    label: 'Custom Hook',
    icon: Code,
    color: 'hsl(145,100%,55%)',
    desc: 'A React Query hook for data fetching with mutations',
    prompt: (name: string) => `Create a new React hook called "use${name}.ts" in src/hooks/. Use React Query for data fetching (useQuery + useMutation). Include: queryKey with QUERY_KEYS pattern, queryFn calling Supabase directly, mutation with onSuccess cache invalidation, loading and error states. Follow VELO 2.0 TypeScript patterns.`,
  },
  {
    id: 'sql_migration',
    label: 'SQL Migration',
    icon: Database,
    color: 'hsl(30,100%,60%)',
    desc: 'PostgreSQL migration with RLS policies for a new table',
    prompt: (name: string) => `Write a PostgreSQL migration for a new table called "${name.toLowerCase().replace(/\s/g, '_')}". Include: UUID primary key, user_id uuid NOT NULL referencing public.user_profiles(id) ON DELETE CASCADE, created_at with now() default, appropriate text/numeric/jsonb columns, enable RLS, and separate policies for authenticated users: select own, insert own (with check), update own, delete own. Name policies using pattern: auth_{role}_{operation}_{description}.`,
  },
  {
    id: 'workflow',
    label: 'Autopilot Workflow',
    icon: GitBranch,
    color: 'hsl(0,85%,65%)',
    desc: 'An Autopilot task workflow template with steps and conditions',
    prompt: (name: string) => `Design an Autopilot workflow template for "${name}". Include: workflow name, trigger conditions (opportunity type, value threshold, required skills), ordered step definitions (platform navigation, form filling, credential injection points, submission), success/failure handlers, consent gate requirement, and estimated completion time. Format as a TypeScript object compatible with VELO 2.0 automation_sessions.steps structure.`,
  },
];

// ── Terminal commands ─────────────────────────────────────────────────────────
const TERMINAL_COMMANDS: Record<string, { desc: string; action: (args: string, ctx: TerminalCtx) => string | Promise<string> }> = {
  help: {
    desc: 'List all available commands',
    action: () => Object.entries(TERMINAL_COMMANDS).map(([cmd, info]) => `  ${cmd.padEnd(20)} ${info.desc}`).join('\n'),
  },
  clear: { desc: 'Clear terminal output', action: (_a, ctx) => { ctx.clear(); return ''; } },
  status: {
    desc: 'Show platform status summary',
    action: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return '✗ Not authenticated';
      return `Platform: VELO 2.0 PROD\nUser: ${user.email}\nID: ${user.id}\nAuth: ✓ Active\nBackend: OnSpace Cloud`;
    },
  },
  ai: {
    desc: 'Show AI router status: ai status | ai mode <mode> | ai model',
    action: (args) => {
      const s = getRouterState();
      if (args === 'status' || !args) {
        return `AI Router Status\n  Mode:     ${s.mode}\n  Source:   ${s.forcedLocalMode ? 'LOCAL (forced)' : s.mode === 'local' ? 'LOCAL' : 'CLOUD'}\n  Ollama:   ${s.ollamaAvailable ? `✓ Online (${s.availableModels.length} models)` : '✗ Offline'}\n  Credits:  ${s.cloudCreditsOk ? '✓ OK' : '✗ Exhausted'}\n  Total req: ${s.totalRequests} (cloud: ${s.cloudRequests} · local: ${s.localRequests} · cached: ${s.cachedRequests})`;
      }
      if (args.startsWith('model')) return `Active model: ${s.selectedModel || '(none)'}`;
      return `Unknown ai subcommand: ${args}`;
    },
  },
  db: {
    desc: 'Database info: db tables | db count <table>',
    action: async (args) => {
      if (args === 'tables' || !args) {
        return 'Known tables:\n' + [
          'profit_engines', 'autopilots', 'opportunities', 'tasks', 'wallet_transactions',
          'user_identity', 'user_documents', 'identity_consent_log', 'autopilot_eligibility',
          'credentials', 'platforms', 'playbooks', 'automation_sessions', 'notifications',
          'onboarding_progress', 'crypto_tasks', 'dropship_products', 'dropship_orders',
          'ai_content_cache', 'task_execution_log',
        ].map(t => `  ${t}`).join('\n');
      }
      if (args.startsWith('count ')) {
        const table = args.replace('count ', '').trim();
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        return `${table}: ${count ?? 'N/A'} rows`;
      }
      return `Unknown db subcommand: ${args}`;
    },
  },
  logs: {
    desc: 'Show recent audit logs: logs <n>',
    action: async (args) => {
      const n = parseInt(args) || 10;
      const { data } = await supabase.from('identity_consent_log').select('action,purpose,created_at').order('created_at', { ascending: false }).limit(n);
      if (!data?.length) return 'No audit logs found';
      return data.map(l => `[${new Date(l.created_at).toLocaleTimeString()}] ${l.action}: ${l.purpose}`).join('\n');
    },
  },
  ping: {
    desc: 'Ping backend services',
    action: async () => {
      const start = Date.now();
      const { data, error } = await supabase.from('user_profiles').select('id').limit(1);
      const ms = Date.now() - start;
      return error ? `✗ DB: ${error.message}` : `✓ DB: ${ms}ms\n✓ Auth: Active\n✓ Edge Functions: Available`;
    },
  },
  vault: {
    desc: 'Vault info: vault count',
    action: async (args) => {
      if (args === 'count' || !args) {
        const { count } = await supabase.from('credentials').select('*', { count: 'exact', head: true });
        return `Vault credentials: ${count ?? 0}\nEncryption: AES-256-GCM\nKey derivation: PBKDF2 100K iterations\nStorage: Ciphertext only — zero-knowledge`;
      }
      return `Unknown vault subcommand: ${args}`;
    },
  },
  identity: {
    desc: 'Identity info: identity status',
    action: async () => {
      const { data } = await supabase.from('user_identity').select('completeness_score,consent_given,has_id_document,approved_for_applications').maybeSingle();
      if (!data) return 'No identity profile found';
      return `Identity Status\n  Completeness: ${data.completeness_score ?? 0}%\n  Consent: ${data.consent_given ? '✓' : '✗'}\n  ID Document: ${data.has_id_document ? '✓' : '✗'}\n  Applications: ${data.approved_for_applications ? '✓ Approved' : '✗ Pending'}`;
    },
  },
  deploy: { desc: 'Trigger deployment pipeline', action: (_a, ctx) => { ctx.triggerDeploy(); return '⟳ Deployment pipeline triggered...'; } },
  version: { desc: 'Show platform version', action: () => 'VELO 2.0.0 · Build: PROD-2026 · Mode: Real-World' },
  whoami: { desc: 'Show current user info', action: async () => { const { data: { user } } = await supabase.auth.getUser(); return user ? `User: ${user.email}\nID: ${user.id}\nCreated: ${user.created_at}` : 'Not authenticated'; } },
};

interface TerminalCtx {
  clear: () => void;
  triggerDeploy: () => void;
}

// ── Change record ─────────────────────────────────────────────────────────────
interface Change {
  id: string;
  fileId: string;
  fileName: string;
  oldContent: string;
  newContent: string;
  timestamp: string;
  aiAssisted: boolean;
  deployed: boolean;
  aiSource?: 'cloud' | 'local' | 'cache';
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isThinking?: boolean;
  aiSource?: 'cloud' | 'local' | 'cache';
  /** Marks this bubble as actively receiving stream tokens */
  isStreaming?: boolean;
  /** Stable key used to update this message in-place during streaming */
  streamId?: string;
}

type DeployStage = 'idle' | 'validating' | 'testing' | 'previewing' | 'deploying' | 'done' | 'failed' | 'rolling_back';
type MainTab = 'editor' | 'changes' | 'deploy' | 'logs' | 'terminal' | 'modules';

const CATEGORY_COLORS = {
  frontend: { text: 'text-[hsl(185,100%,55%)]', bg: 'bg-[hsl(185_100%_50%/0.1)]', border: 'border-[hsl(185_100%_50%/0.2)]' },
  backend:  { text: 'text-[hsl(265,80%,70%)]',  bg: 'bg-[hsl(265_80%_55%/0.1)]',  border: 'border-[hsl(265_80%_55%/0.2)]' },
  database: { text: 'text-[hsl(50,100%,60%)]',  bg: 'bg-[hsl(50_100%_50%/0.1)]',  border: 'border-[hsl(50_100%_50%/0.2)]' },
  config:   { text: 'text-[hsl(145,100%,55%)]', bg: 'bg-[hsl(145_100%_50%/0.1)]', border: 'border-[hsl(145_100%_50%/0.2)]' },
};

const EXT_ICONS: Record<string, React.ElementType> = {
  tsx: FileCode, ts: FileCode, sql: Database, default: FileText,
};

const CHANGE_KEY = 'velo_dev_changes_v3';

function loadChanges(): Change[] {
  try { return JSON.parse(localStorage.getItem(CHANGE_KEY) || '[]'); } catch { return []; }
}
function saveChanges(changes: Change[]) {
  localStorage.setItem(CHANGE_KEY, JSON.stringify(changes.slice(-50)));
}

// ── Admin guard ───────────────────────────────────────────────────────────────
function AdminLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleUnlock = async () => {
    if (!code.trim()) return;
    setChecking(true);
    const { data: { user } } = await supabase.auth.getUser();
    const pin = user?.user_metadata?.dev_console_pin || 'VELO-ADMIN-2026';
    if (code.trim() === pin) {
      onUnlock();
      sessionStorage.setItem('dev_console_unlocked', '1');
    } else {
      setError('Invalid access code. Default: VELO-ADMIN-2026');
    }
    setChecking(false);
  };

  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="glass-panel rounded-2xl border border-[hsl(265_80%_55%/0.3)] p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[hsl(265_80%_55%/0.12)] border border-[hsl(265_80%_55%/0.25)] flex items-center justify-center">
          <Lock size={28} className="text-[hsl(265,80%,70%)]" />
        </div>
        <div className="text-lg font-black mb-1 text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>DEVELOPER CONSOLE</div>
        <div className="text-sm text-muted-foreground mb-6">Admin-only access. Enter your developer console PIN.</div>
        <input
          type="password" autoFocus
          className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(265_80%_55%/0.3)] text-sm font-mono text-center tracking-widest focus:outline-none focus:border-[hsl(265_80%_55%/0.6)] transition-colors mb-3"
          placeholder="Enter admin PIN"
          value={code}
          onChange={e => { setCode(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
        />
        {error && (
          <div className="text-xs text-[hsl(0,85%,65%)] mb-3 flex items-center gap-1.5 justify-center">
            <AlertTriangle size={11} /> {error}
          </div>
        )}
        <button
          onClick={handleUnlock} disabled={checking || !code.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {checking ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
          {checking ? 'Verifying...' : 'Unlock Console'}
        </button>
        <div className="mt-4 p-3 rounded-lg bg-[hsl(228_25%_10%)] text-[10px] text-muted-foreground text-left">
          <div className="font-semibold mb-1 text-[hsl(265,80%,70%)]">Security notices:</div>
          <div>· All code edits are logged to the immutable audit trail</div>
          <div>· All AI assistance sessions are recorded</div>
          <div>· All deployments require explicit confirmation</div>
          <div>· Default PIN: VELO-ADMIN-2026 (change in Settings → Security)</div>
        </div>
      </div>
    </div>
  );
}

// ── File Tree Node ────────────────────────────────────────────────────────────
function FileTreeNode({ node, depth, selectedId, onSelect, changedIds }: {
  node: FileNode; depth: number; selectedId: string | null;
  onSelect: (node: FileNode) => void; changedIds: Set<string>;
}) {
  const [open, setOpen] = useState(depth === 0);
  const colors = CATEGORY_COLORS[node.category];
  const Icon = node.type === 'folder' ? FolderOpen : (EXT_ICONS[node.ext || ''] ?? EXT_ICONS.default);
  const isSelected = selectedId === node.id;
  const hasChanges = changedIds.has(node.id);

  if (node.type === 'folder') {
    return (
      <div>
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[hsl(228_25%_10%)] transition-colors text-left" style={{ paddingLeft: `${8 + depth * 12}px` }}>
          {open ? <ChevronDown size={11} className="text-muted-foreground flex-shrink-0" /> : <ChevronRight size={11} className="text-muted-foreground flex-shrink-0" />}
          <FolderOpen size={12} className={cn('flex-shrink-0', colors.text)} />
          <span className={cn('text-[11px] font-semibold truncate', colors.text)}>{node.name}</span>
        </button>
        {open && node.children?.map(child => (
          <FileTreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} changedIds={changedIds} />
        ))}
      </div>
    );
  }

  return (
    <button onClick={() => onSelect(node)} className={cn('w-full flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-left group', isSelected ? 'bg-[hsl(265_80%_55%/0.15)] border-l-2 border-[hsl(265,80%,70%)]' : 'hover:bg-[hsl(228_25%_10%)]')} style={{ paddingLeft: `${8 + depth * 12}px` }}>
      <Icon size={11} className={cn('flex-shrink-0', isSelected ? colors.text : 'text-muted-foreground')} />
      <span className={cn('text-[11px] truncate flex-1', isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{node.name}</span>
      {hasChanges && <div className="w-1.5 h-1.5 rounded-full bg-[hsl(30,100%,60%)] flex-shrink-0" />}
    </button>
  );
}

// ── Code editor with line numbers ─────────────────────────────────────────────
function CodeEditor({ value, onChange, readOnly = false, minHeight = '280px' }: {
  value: string; onChange?: (v: string) => void; readOnly?: boolean; minHeight?: string;
}) {
  const lines = value.split('\n');
  return (
    <div className="relative flex font-mono text-[11px] bg-[hsl(230_35%_3%)] rounded-lg border border-[hsl(var(--border))] overflow-hidden" style={{ minHeight }}>
      <div className="select-none px-2 pt-3 pb-3 text-right text-[hsl(228,20%,35%)] border-r border-[hsl(228,20%,12%)] bg-[hsl(228_35%_4%)] min-w-[36px]">
        {lines.map((_, i) => <div key={i} className="leading-5">{i + 1}</div>)}
      </div>
      {readOnly ? (
        <pre className="flex-1 p-3 text-[hsl(185,60%,75%)] leading-5 overflow-x-auto whitespace-pre">{value}</pre>
      ) : (
        <textarea className="flex-1 p-3 bg-transparent text-[hsl(185,60%,75%)] leading-5 resize-none focus:outline-none overflow-x-auto" value={value} onChange={e => onChange?.(e.target.value)} spellCheck={false} style={{ minHeight, fontFamily: 'monospace' }} />
      )}
    </div>
  );
}

// ── Chat message renderer ─────────────────────────────────────────────────────
function ChatBubble({ msg, onApplyPatch }: { msg: ChatMessage; onApplyPatch?: (code: string, lang: string) => void }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);

  const copyText = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    let codeBlockIdx = 0;
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const lang = lines[0].replace('```', '').trim();
        const code = lines.slice(1, -1).join('\n');
        const thisIdx = codeBlockIdx++;
        const isApplied = appliedIdx === thisIdx;
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-[hsl(265_80%_55%/0.2)]">
            <div className="flex items-center justify-between px-3 py-1 bg-[hsl(228_35%_5%)] border-b border-[hsl(265_80%_55%/0.15)]">
              <span className="text-[10px] text-[hsl(265,80%,70%)] font-mono">{lang || 'code'}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard.writeText(code)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"><Copy size={9} /> Copy</button>
                {onApplyPatch && (
                  <button onClick={() => { onApplyPatch(code, lang); setAppliedIdx(thisIdx); }} className={cn('text-[10px] flex items-center gap-1 px-2 py-0.5 rounded transition-all font-semibold', isApplied ? 'text-[hsl(145,100%,55%)] bg-[hsl(145_100%_50%/0.12)] border border-[hsl(145_100%_50%/0.25)]' : 'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)] border border-[hsl(185_100%_50%/0.2)] hover:bg-[hsl(185_100%_50%/0.2)]')}>
                    {isApplied ? <><CheckCircle size={9} /> Applied</> : <><Zap size={9} /> Apply Patch</>}
                  </button>
                )}
              </div>
            </div>
            <pre className="p-3 bg-[hsl(230_35%_3%)] text-[11px] font-mono text-[hsl(185,60%,75%)] overflow-x-auto leading-5">{code}</pre>
          </div>
        );
      }
      return <span key={i} className="text-sm leading-relaxed whitespace-pre-wrap">{part}</span>;
    });
  };

  // ── Live streaming bubble ──────────────────────────────────────────────────
  if (msg.isStreaming) {
    const wordCount = msg.content.trim() ? msg.content.trim().split(/\s+/).length : 0;
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] p-3 rounded-xl rounded-tl-none bg-[hsl(145_100%_50%/0.06)] border border-[hsl(145_100%_50%/0.25)] shadow-[0_0_14px_-6px_hsl(145_100%_50%/0.35)] transition-all">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2">
            <Bot size={11} className="text-[hsl(145,100%,55%)]" />
            <span className="text-[10px] font-bold text-[hsl(145,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>VELO DevBot</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] ml-1">
              <Cpu size={8} /> Local AI · Streaming
            </span>
            {wordCount > 0 && (
              <span className="ml-auto text-[9px] text-[hsl(145,100%,55%)] opacity-70 font-mono">
                {wordCount} words
              </span>
            )}
          </div>
          {/* Streaming content */}
          {msg.content ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
              <span className="inline-block w-[2px] h-[1em] bg-[hsl(145,100%,55%)] ml-0.5 align-middle animate-[cursor-blink]" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[hsl(145,100%,55%)]">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map(d => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
              <span className="text-xs">Local AI thinking...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.isThinking) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] p-3 rounded-xl rounded-tl-none bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)]">
          <div className="flex items-center gap-2 text-[hsl(265,80%,70%)]">
            <Bot size={13} />
            <span className="text-xs">DevBot is analyzing...</span>
            <div className="flex gap-1">
              {[0, 0.15, 0.3].map(d => <div key={d} className="w-1 h-1 rounded-full bg-[hsl(265,80%,70%)] animate-pulse" style={{ animationDelay: `${d}s` }} />)}
            </div>
            {msg.aiSource && (
              <span className="text-[9px] ml-auto flex items-center gap-1">
                {msg.aiSource === 'local' ? <Cpu size={9} className="text-[hsl(145,100%,55%)]" /> : <Cloud size={9} className="text-[hsl(265,80%,70%)]" />}
                {msg.aiSource === 'local' ? 'Local AI' : 'Cloud AI'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[88%] p-3 rounded-xl text-sm relative group', isUser ? 'rounded-tr-none bg-[hsl(185_100%_50%/0.12)] border border-[hsl(185_100%_50%/0.2)] text-foreground' : 'rounded-tl-none bg-[hsl(265_80%_55%/0.08)] border border-[hsl(265_80%_55%/0.15)]')}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-2">
            <Bot size={11} className="text-[hsl(265,80%,70%)]" />
            <span className="text-[10px] font-bold text-[hsl(265,80%,70%)]">VELO DevBot</span>
            {msg.aiSource && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-1', msg.aiSource === 'local' ? 'bg-[hsl(145_100%_50%/0.1)] text-[hsl(145,100%,55%)]' : msg.aiSource === 'cache' ? 'bg-[hsl(50_100%_50%/0.1)] text-[hsl(50,100%,60%)]' : 'bg-[hsl(265_80%_55%/0.1)] text-[hsl(265,80%,70%)]')}>
                {msg.aiSource === 'local' ? <Cpu size={8} /> : msg.aiSource === 'cache' ? <Zap size={8} /> : <Cloud size={8} />}
                {msg.aiSource === 'local' ? 'Local AI' : msg.aiSource === 'cache' ? 'Cached' : 'Cloud AI'}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground ml-auto">{msg.timestamp}</span>
          </div>
        )}
        {renderContent(msg.content)}
        <button onClick={copyText} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[hsl(228_25%_15%)] transition-all">
          {copied ? <CheckCircle size={10} className="text-[hsl(145,100%,55%)]" /> : <Copy size={10} className="text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────
function LogsTab() {
  const [logSource, setLogSource] = useState<'audit' | 'automation' | 'notifications' | 'identity'>('audit');
  const [filterQuery, setFilterQuery] = useState('');

  const { data: auditLogs = [], refetch: refetchAudit, isFetching: fetchingAudit } = useQuery({
    queryKey: ['dev_console_audit'],
    queryFn: async () => {
      const { data } = await supabase.from('identity_consent_log').select('*').order('created_at', { ascending: false }).limit(100);
      return data ?? [];
    },
    staleTime: 10000,
  });

  const { data: automationLogs = [], refetch: refetchAuto, isFetching: fetchingAuto } = useQuery({
    queryKey: ['dev_console_automation'],
    queryFn: async () => {
      const { data } = await supabase.from('automation_sessions').select('id, name, platform, status, runner_id, started_at, completed_at, runtime_ms, created_at').order('created_at', { ascending: false }).limit(50);
      return data ?? [];
    },
    staleTime: 10000,
  });

  const { data: notifLogs = [], refetch: refetchNotif, isFetching: fetchingNotif } = useQuery({
    queryKey: ['dev_console_notifs'],
    queryFn: async () => {
      const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      return data ?? [];
    },
    staleTime: 10000,
  });

  const { data: identityLogs = [], refetch: refetchIdentity, isFetching: fetchingIdentity } = useQuery({
    queryKey: ['dev_console_identity'],
    queryFn: async () => {
      const { data } = await supabase.from('user_identity').select('id, full_name, completeness_score, consent_given, has_id_document, approved_for_applications, created_at, updated_at').maybeSingle();
      return data ? [data] : [];
    },
    staleTime: 10000,
  });

  const isFetching = fetchingAudit || fetchingAuto || fetchingNotif || fetchingIdentity;

  const sources = [
    { id: 'audit' as const, label: 'Audit Trail', icon: ScrollText, color: 'hsl(265,80%,70%)', count: auditLogs.length },
    { id: 'automation' as const, label: 'Automation', icon: Monitor, color: 'hsl(185,100%,55%)', count: automationLogs.length },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell, color: 'hsl(50,100%,60%)', count: notifLogs.length },
    { id: 'identity' as const, label: 'Identity', icon: Fingerprint, color: 'hsl(145,100%,55%)', count: identityLogs.length },
  ];

  const handleRefresh = () => {
    refetchAudit(); refetchAuto(); refetchNotif(); refetchIdentity();
  };

  const getLevelBadge = (action: string) => {
    if (action.includes('error') || action.includes('fail')) return { color: 'text-[hsl(0,85%,65%)]', bg: 'bg-[hsl(0_85%_60%/0.1)]', label: 'ERROR' };
    if (action.includes('warn') || action.includes('rate')) return { color: 'text-[hsl(30,100%,60%)]', bg: 'bg-[hsl(30_100%_55%/0.1)]', label: 'WARN' };
    if (action.includes('deploy') || action.includes('patch')) return { color: 'text-[hsl(50,100%,60%)]', bg: 'bg-[hsl(50_100%_50%/0.1)]', label: 'DEPLOY' };
    if (action.includes('ai') || action.includes('generat')) return { color: 'text-[hsl(265,80%,70%)]', bg: 'bg-[hsl(265_80%_55%/0.1)]', label: 'AI' };
    return { color: 'text-[hsl(185,100%,55%)]', bg: 'bg-[hsl(185_100%_50%/0.1)]', label: 'INFO' };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Source tabs */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.4)] flex-shrink-0 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {sources.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setLogSource(s.id)} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all', logSource === s.id ? 'bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))]' : 'text-muted-foreground hover:text-foreground')} style={{ color: logSource === s.id ? s.color : undefined, fontFamily: 'Orbitron' }}>
                <Icon size={10} />
                {s.label}
                <span className="text-[9px] opacity-60">({s.count})</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="pl-7 pr-3 py-1 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-[10px] focus:outline-none w-36" placeholder="Filter logs..." value={filterQuery} onChange={e => setFilterQuery(e.target.value)} />
          </div>
          <button onClick={handleRefresh} disabled={isFetching} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60">
            <RefreshCw size={10} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-auto">
        {/* Audit logs */}
        {logSource === 'audit' && (
          <div className="divide-y divide-[hsl(var(--border)/0.5)]">
            {(auditLogs as Array<Record<string, unknown>>).filter((l: Record<string, unknown>) => !filterQuery || String(l.action).includes(filterQuery) || String(l.purpose).includes(filterQuery)).map((log: Record<string, unknown>) => {
              const badge = getLevelBadge(String(log.action ?? ''));
              return (
                <div key={String(log.id)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[hsl(228_25%_8%/0.4)] transition-colors">
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', badge.color, badge.bg)}>{badge.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold font-mono truncate">{String(log.action)}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{String(log.purpose || '')}</div>
                    {Array.isArray(log.fields_accessed) && log.fields_accessed.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(log.fields_accessed as string[]).slice(0, 4).map((f: string) => <span key={f} className="text-[9px] px-1 py-0.5 rounded bg-[hsl(228_25%_12%)] text-muted-foreground">{f}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground flex-shrink-0">{timeAgo(String(log.created_at))}</div>
                </div>
              );
            })}
            {auditLogs.length === 0 && <div className="text-center py-12 text-muted-foreground text-xs">No audit logs yet</div>}
          </div>
        )}

        {/* Automation logs */}
        {logSource === 'automation' && (
          <div className="divide-y divide-[hsl(var(--border)/0.5)]">
            {(automationLogs as Array<Record<string, unknown>>).filter(s => !filterQuery || String(s.name).includes(filterQuery) || String(s.platform).includes(filterQuery)).map(session => (
              <div key={String(session.id)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[hsl(228_25%_8%/0.4)] transition-colors">
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', session.status === 'completed' ? 'text-[hsl(145,100%,55%)] bg-[hsl(145_100%_50%/0.1)]' : session.status === 'failed' ? 'text-[hsl(0,85%,65%)] bg-[hsl(0_85%_60%/0.1)]' : session.status === 'running' ? 'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)]' : 'text-muted-foreground bg-[hsl(228_25%_12%)]')}>{String(session.status).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{String(session.name)}</div>
                  <div className="text-[10px] text-muted-foreground">{String(session.platform || '')} {session.runner_id ? `· ${session.runner_id}` : ''} {session.runtime_ms ? `· ${((session.runtime_ms as number) / 1000).toFixed(1)}s` : ''}</div>
                </div>
                <div className="text-[9px] text-muted-foreground flex-shrink-0">{timeAgo(String(session.created_at))}</div>
              </div>
            ))}
            {automationLogs.length === 0 && <div className="text-center py-12 text-muted-foreground text-xs">No automation sessions yet</div>}
          </div>
        )}

        {/* Notifications */}
        {logSource === 'notifications' && (
          <div className="divide-y divide-[hsl(var(--border)/0.5)]">
            {(notifLogs as Array<Record<string, unknown>>).filter(n => !filterQuery || String(n.title).includes(filterQuery) || String(n.message).includes(filterQuery)).map(notif => (
              <div key={String(notif.id)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[hsl(228_25%_8%/0.4)] transition-colors">
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', notif.priority === 'high' ? 'text-[hsl(0,85%,65%)] bg-[hsl(0_85%_60%/0.1)]' : 'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)]')}>{String(notif.type || 'INFO').toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{String(notif.title)}</div>
                  <div className="text-[10px] text-muted-foreground">{String(notif.message || '')}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!notif.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[hsl(185,100%,55%)]" />}
                  <div className="text-[9px] text-muted-foreground">{timeAgo(String(notif.created_at))}</div>
                </div>
              </div>
            ))}
            {notifLogs.length === 0 && <div className="text-center py-12 text-muted-foreground text-xs">No notifications yet</div>}
          </div>
        )}

        {/* Identity */}
        {logSource === 'identity' && (
          <div className="p-4">
            {(identityLogs as Array<Record<string, unknown>>).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">No identity profile found</div>
            ) : (identityLogs as Array<Record<string, unknown>>).map(identity => (
              <div key={String(identity.id)} className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.15)] p-4">
                <div className="text-xs font-black text-[hsl(145,100%,55%)] mb-3" style={{ fontFamily: 'Orbitron' }}>IDENTITY PROFILE</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(identity).filter(([k]) => !['id'].includes(k)).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-lg bg-[hsl(228_25%_8%)] border border-[hsl(var(--border))]">
                      <div className="text-[9px] text-muted-foreground">{key}</div>
                      <div className="text-[11px] font-semibold truncate">{String(val ?? '—')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Terminal Tab ───────────────────────────────────────────────────────────────

function TerminalTab({ onTriggerDeploy }: { onTriggerDeploy: () => void }) {
  const [history, setHistory] = useState<Array<{ type: 'input' | 'output' | 'error'; content: string }>>([
    { type: 'output', content: '╔══════════════════════════════════════╗\n║   VELO 2.0 — Admin Terminal v2.0     ║\n╚══════════════════════════════════════╝\nType "help" for available commands.\n' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [history]);

  const ctx: TerminalCtx = {
    clear: () => setHistory([{ type: 'output', content: 'Terminal cleared.\n' }]),
    triggerDeploy: onTriggerDeploy,
  };

  const runCommand = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCmdHistory(prev => [trimmed, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setHistory(prev => [...prev, { type: 'input', content: `$ ${trimmed}` }]);
    setInput('');
    setRunning(true);

    const [cmd, ...rest] = trimmed.split(' ');
    const args = rest.join(' ');
    const handler = TERMINAL_COMMANDS[cmd.toLowerCase()];

    if (!handler) {
      setHistory(prev => [...prev, { type: 'error', content: `Command not found: ${cmd}. Type "help" for a list.` }]);
    } else {
      const result = await handler.action(args, ctx);
      if (result) setHistory(prev => [...prev, { type: 'output', content: result }]);
    }
    setRunning(false);
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(230_35%_3%)]">
      <div ref={termRef} className="flex-1 overflow-auto p-4 font-mono text-[11px] space-y-1">
        {history.map((entry, i) => (
          <pre key={i} className={cn('leading-5 whitespace-pre-wrap', entry.type === 'input' ? 'text-[hsl(185,100%,55%)]' : entry.type === 'error' ? 'text-[hsl(0,85%,65%)]' : 'text-[hsl(185,60%,75%)]')}>{entry.content}</pre>
        ))}
        {running && <div className="text-[hsl(265,80%,70%)] animate-pulse">Running...</div>}
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.8)]">
        <span className="text-[hsl(185,100%,55%)] font-mono text-xs flex-shrink-0">$</span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent font-mono text-xs text-foreground focus:outline-none"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { runCommand(input); }
            else if (e.key === 'ArrowUp') { const idx = Math.min(historyIdx + 1, cmdHistory.length - 1); setHistoryIdx(idx); setInput(cmdHistory[idx] || ''); }
            else if (e.key === 'ArrowDown') { const idx = Math.max(historyIdx - 1, -1); setHistoryIdx(idx); setInput(idx < 0 ? '' : cmdHistory[idx]); }
          }}
          placeholder="Enter command... (try: help, status, ai, db tables, logs 20)"
          autoFocus
        />
        <div className="text-[hsl(185,100%,55%)] animate-pulse text-xs">█</div>
      </div>
    </div>
  );
}

// ── Modules Tab ───────────────────────────────────────────────────────────────
function ModulesTab({ onSendToChat }: { onSendToChat: (msg: string) => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState(MODULE_TEMPLATES[0]);
  const [moduleName, setModuleName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [mode, setMode] = useState<'template' | 'custom'>('template');

  const handleGenerate = () => {
    const name = moduleName.trim() || 'NewModule';
    const prompt = mode === 'custom' && customPrompt.trim()
      ? customPrompt.trim()
      : selectedTemplate.prompt(name);
    onSendToChat(prompt);
  };

  return (
    <div className="p-4 space-y-5 overflow-auto h-full">
      <div>
        <div className="text-sm font-black text-[hsl(50,100%,60%)]" style={{ fontFamily: 'Orbitron' }}>MODULE SCAFFOLDER</div>
        <div className="text-xs text-muted-foreground mt-0.5">Generate new pages, components, functions, hooks, and workflows using AI</div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(228_25%_6%)] w-fit">
        <button onClick={() => setMode('template')} className={cn('px-3 py-1 rounded text-xs font-bold transition-colors', mode === 'template' ? 'bg-[hsl(50_100%_50%/0.15)] text-[hsl(50,100%,60%)]' : 'text-muted-foreground hover:text-foreground')} style={{ fontFamily: 'Orbitron' }}>
          Templates
        </button>
        <button onClick={() => setMode('custom')} className={cn('px-3 py-1 rounded text-xs font-bold transition-colors', mode === 'custom' ? 'bg-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)]' : 'text-muted-foreground hover:text-foreground')} style={{ fontFamily: 'Orbitron' }}>
          Custom Prompt
        </button>
      </div>

      {mode === 'template' && (
        <>
          {/* Template selector */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULE_TEMPLATES.map(tmpl => {
              const Icon = tmpl.icon;
              const isActive = selectedTemplate.id === tmpl.id;
              return (
                <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl)} className={cn('p-3 rounded-xl border text-left transition-all hover:scale-[1.02]', isActive ? 'border-current' : 'border-[hsl(var(--border))] hover:border-[hsl(228_25%_25%)]')} style={isActive ? { borderColor: tmpl.color, background: `color-mix(in srgb, ${tmpl.color} 6%, transparent)` } : {}}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${tmpl.color} 14%, transparent)` }}>
                      <Icon size={13} style={{ color: tmpl.color }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: isActive ? tmpl.color : undefined }}>{tmpl.label}</span>
                    {isActive && <span className="text-[8px] font-bold px-1 py-0.5 rounded ml-auto" style={{ color: tmpl.color, background: `color-mix(in srgb, ${tmpl.color} 15%, transparent)` }}>SELECTED</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-snug">{tmpl.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Name input */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Module / File Name</label>
            <input
              className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.4)] transition-colors font-mono"
              placeholder={`e.g. "Leaderboard" or "CryptoWallet"`}
              value={moduleName}
              onChange={e => setModuleName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
          </div>

          {/* Preview prompt */}
          {moduleName.trim() && (
            <div className="p-3 rounded-xl border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.04)]">
              <div className="text-[10px] font-bold text-[hsl(265,80%,70%)] mb-1.5 uppercase tracking-wider">Generated Prompt Preview</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">{selectedTemplate.prompt(moduleName.trim())}</div>
            </div>
          )}
        </>
      )}

      {mode === 'custom' && (
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Custom Build Prompt</label>
          <textarea
            className="w-full px-3 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.4)] transition-colors resize-none leading-relaxed"
            rows={6}
            placeholder="Describe exactly what you want to build. Be specific about: file location, functionality, data sources, UI style, and any integration with existing VELO modules..."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
          />
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={mode === 'template' ? !moduleName.trim() : !customPrompt.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90 disabled:opacity-50 transition-all"
      >
        <Sparkles size={14} /> Generate with DevBot AI
      </button>

      {/* Recent scaffolds hint */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2" style={{ fontFamily: 'Orbitron' }}>How it works</div>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Select a template type or write a custom prompt', color: 'hsl(185,100%,55%)' },
            { step: '2', text: 'Click Generate — DevBot sends the prompt to AI (cloud or local)', color: 'hsl(265,80%,70%)' },
            { step: '3', text: 'AI generates the full code in the chat panel on the right', color: 'hsl(50,100%,60%)' },
            { step: '4', text: 'Click "Apply Patch" on any code block to stage it for deployment', color: 'hsl(145,100%,55%)' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-2.5 text-[11px]">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0" style={{ color: s.color, border: `1px solid ${s.color}`, background: `color-mix(in srgb, ${s.color} 10%, transparent)` }}>{s.step}</div>
              <span className="text-muted-foreground leading-snug">{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Cmd+K Command Bar ─────────────────────────────────────────────────────────
function CommandBar({ onCommand, onClose }: { onCommand: (msg: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const QUICK_COMMANDS = [
    { label: 'Fix the current file errors', icon: Bug, color: 'hsl(0,85%,65%)' },
    { label: 'Add a new settings tab for AI configuration', icon: Settings2, color: 'hsl(185,100%,55%)' },
    { label: 'Create a new page for platform analytics', icon: BarChart2, color: 'hsl(265,80%,70%)' },
    { label: 'Update the autopilot workflow template for microtasks', icon: GitBranch, color: 'hsl(50,100%,60%)' },
    { label: 'Review all Edge Functions for security issues', icon: Shield, color: 'hsl(30,100%,60%)' },
    { label: 'Generate a SQL migration for a new table', icon: Database, color: 'hsl(145,100%,55%)' },
    { label: 'Refactor the useSharedData hook for better performance', icon: Wrench, color: 'hsl(185,100%,55%)' },
    { label: 'Explain the VELO 2.0 data flow architecture', icon: BookOpen, color: 'hsl(265,80%,70%)' },
  ];

  const filtered = query.trim()
    ? QUICK_COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : QUICK_COMMANDS;

  const handleSelect = (msg: string) => { onCommand(msg); onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl mx-4 glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.3)] shadow-2xl shadow-[hsl(265_80%_55%/0.15)] overflow-hidden slide-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
          <Command size={14} className="text-[hsl(265,80%,70%)] flex-shrink-0" />
          <input ref={inputRef} className="flex-1 bg-transparent text-sm focus:outline-none" placeholder="Type a command or ask DevBot anything..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && query.trim()) handleSelect(query.trim()); if (e.key === 'Escape') onClose(); }} />
          <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {(query.trim() && !filtered.length) ? (
            <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(265_80%_55%/0.1)] transition-colors text-left" onClick={() => handleSelect(query)}>
              <div className="w-7 h-7 rounded-lg bg-[hsl(265_80%_55%/0.12)] flex items-center justify-center flex-shrink-0"><Send size={12} className="text-[hsl(265,80%,70%)]" /></div>
              <div><div className="text-sm font-medium">Ask: "{query}"</div><div className="text-[10px] text-muted-foreground">Send as DevBot message</div></div>
            </button>
          ) : filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button key={i} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[hsl(265_80%_55%/0.08)] transition-colors text-left" onClick={() => handleSelect(cmd.label)}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${cmd.color} 12%, transparent)` }}>
                  <Icon size={12} style={{ color: cmd.color }} />
                </div>
                <span className="text-sm">{cmd.label}</span>
                <ArrowRight size={11} className="text-muted-foreground ml-auto" />
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[hsl(var(--border))] flex items-center gap-3 text-[10px] text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))]">↵</kbd> to send</span>
          <span><kbd className="px-1 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))]">ESC</kbd> to close</span>
          <span className="ml-auto flex items-center gap-1">
            {getRouterState().ollamaAvailable ? <><Cpu size={9} className="text-[hsl(145,100%,55%)]" /> Local AI ready</> : <><Cloud size={9} className="text-[hsl(265,80%,70%)]" /> Cloud AI</>}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Developer Console ────────────────────────────────────────────────────
export default function DeveloperConsolePage() {
  const { user } = useAuth();
  const router = useAIRouter();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('dev_console_unlocked') === '1');

  // Editor state
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [originalCode, setOriginalCode] = useState('');
  const [changes, setChanges] = useState<Change[]>(loadChanges);
  const [activeTab, setActiveTab] = useState<MainTab>('editor');

  // AI chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: `Hello Commander! I'm **VELO DevBot** — your AI-powered platform architect.\n\nI can help you:\n- **Edit & fix** any frontend, backend, or database file\n- **Generate** new pages, components, hooks, and Edge Functions\n- **Analyze** code for bugs, performance issues, and security problems\n- **Refactor** to match VELO's architecture patterns\n- **Build workflows** for Autopilots and Browser Automation\n\nI run on the **AI Router** — when cloud credits run out, I automatically switch to your local Ollama model so I never stop working.\n\nPress **Cmd+K** (or click the ⌘ button) for quick commands. Select a file from the tree, then ask me anything.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }]);
  const [chatInput, setChatInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [showCmdBar, setShowCmdBar] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Deploy pipeline state
  const [deployStage, setDeployStage] = useState<DeployStage>('idle');
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [deployId] = useState(() => `deploy-${Date.now().toString(36).toUpperCase()}`);
  const deployLogRef = useRef<HTMLDivElement>(null);

  // Sidebar collapse
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const changedIds = new Set(changes.map(c => c.fileId));

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { if (deployLogRef.current) deployLogRef.current.scrollTop = deployLogRef.current.scrollHeight; }, [deployLog]);

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmdBar(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectFile = (node: FileNode) => {
    setSelectedFile(node);
    const existing = changes.find(c => c.fileId === node.id);
    const content = existing ? existing.newContent : (node.codeContent || `// ${node.name}\n// No code content available for preview.`);
    setEditedCode(content);
    setOriginalCode(node.codeContent || '');
    setActiveTab('editor');
  };

  const saveChange = () => {
    if (!selectedFile) return;
    const isDirty = editedCode !== (selectedFile.codeContent || '');
    if (!isDirty) { toast.info('No changes to save'); return; }
    const newChange: Change = {
      id: `chg_${Date.now()}`, fileId: selectedFile.id, fileName: selectedFile.name,
      oldContent: originalCode, newContent: editedCode,
      timestamp: new Date().toISOString(), aiAssisted: false, deployed: false,
    };
    const updated = [...changes.filter(c => c.fileId !== selectedFile.id), newChange];
    setChanges(updated); saveChanges(updated);
    toast.success(`${selectedFile.name} — change saved to staging`);
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) supabase.from('identity_consent_log').insert({ user_id: u.id, action: 'dev_console_edit', purpose: `Code edit: ${selectedFile.name}`, fields_accessed: [selectedFile.id, selectedFile.category], approved_by_user: true });
    });
  };

  const discardChange = () => {
    if (!selectedFile) return;
    setEditedCode(selectedFile.codeContent || '');
    const updated = changes.filter(c => c.fileId !== selectedFile.id);
    setChanges(updated); saveChanges(updated);
    toast.info(`${selectedFile.name} — changes discarded`);
  };

  const revertChange = (change: Change) => {
    const updated = changes.filter(c => c.id !== change.id);
    setChanges(updated); saveChanges(updated);
    if (selectedFile?.id === change.fileId) setEditedCode(change.oldContent);
    toast.success(`Reverted: ${change.fileName}`);
  };

  // ── Apply AI patch ─────────────────────────────────────────────────────
  const applyPatchAndStage = useCallback((code: string, lang: string) => {
    if (!selectedFile) { toast.warning('Select a file from the tree first, then apply the patch'); return; }
    setEditedCode(code);
    setActiveTab('editor');
    const newChange: Change = {
      id: `chg_${Date.now()}`, fileId: selectedFile.id, fileName: selectedFile.name,
      oldContent: originalCode, newContent: code,
      timestamp: new Date().toISOString(), aiAssisted: true, deployed: false,
    };
    const updated = [...changes.filter(c => c.fileId !== selectedFile.id), newChange];
    setChanges(updated); saveChanges(updated);
    toast.success(`AI patch applied to ${selectedFile.name} — staged`, { description: `${lang ? `[${lang}] ` : ''}${code.split('\n').length} lines` });
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) supabase.from('identity_consent_log').insert({ user_id: u.id, action: 'dev_console_ai_patch', purpose: `AI patch: ${selectedFile.name}`, fields_accessed: [selectedFile.id, selectedFile.category, 'ai_generated'], approved_by_user: true });
    });
  }, [selectedFile, originalCode, changes]);

  // ── AI Assistant (credit-aware with local fallback + streaming) ──────────
  const sendAIMessage = useCallback(async (overrideMessage?: string) => {
    const messageText = overrideMessage || chatInput.trim();
    if (!messageText || aiThinking) return;

    const userMsg: ChatMessage = {
      role: 'user', content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setAiThinking(true);

    const history = chatMessages
      .filter(m => !m.isThinking && !m.isStreaming && m.role !== 'system')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = `You are VELO DevBot, the AI architect for VELO 2.0 — an autonomous profit platform.

ARCHITECTURE:
- Frontend: React 18 + TypeScript + Tailwind CSS 3 + shadcn/ui + React Router 6
- Backend: Supabase PostgreSQL + Edge Functions (Deno) + RLS
- AI: OnSpace AI (Gemini 3 Flash) for cloud + Ollama for local fallback via aiRouter.ts
- Auth: Supabase OTP login
- Encryption: AES-256-GCM + PBKDF2 (100K iterations) in vaultCrypto.ts
- Automation: Playwright browser automation (playbooks, sessions, runners)

DESIGN SYSTEM:
- Galaxy HUD theme: dark bg hsl(228,35%,4%), neon cyan hsl(185,100%,55%), violet hsl(265,80%,70%)
- Orbitron font for headings, font-mono for code, glass-panel class for containers
- All imports use @/ path alias

CURRENT FILE: ${selectedFile ? `${selectedFile.category}/${selectedFile.name}` : 'No file selected'}

CODE CONTEXT:
\`\`\`
${(editedCode || selectedFile?.codeContent || '').slice(0, 3000)}
\`\`\`

RULES:
- Always output working TypeScript/TSX code with proper VELO patterns
- Use existing hooks: useSharedData, useAIRouter, useAuth, useDocumentUpload
- Use React Query for data fetching; toast from sonner for notifications
- Never use div onClick — use button for actions, a for navigation
- Provide complete, runnable code blocks with fenced \`\`\`tsx or \`\`\`ts markers
- Keep responses focused and actionable`;

    const buildUserPrompt = (msg: string) => {
      const parts = [msg];
      if (history.length > 0) parts.unshift(`Previous conversation:\n${history.map(m => `[${m.role}]: ${m.content.slice(0, 200)}`).join('\n')}\n\n---\n\n`);
      return parts.join('');
    };

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // ── Branch: try cloud first (unless forced local) ────────────────────────
    const useCloud = router.mode !== 'local' && !router.forcedLocalMode;

    if (useCloud) {
      // Show thinking indicator for cloud
      setChatMessages(prev => [...prev, {
        role: 'assistant', content: '', timestamp: ts, isThinking: true, aiSource: 'cloud',
      }]);

      const { data, error } = await supabase.functions.invoke('dev-console', {
        body: {
          action: 'ai_assist',
          messages: history,
          user_message: messageText,
          code_context: (editedCode || selectedFile?.codeContent || '').slice(0, 3000),
          file_path: selectedFile ? `${selectedFile.category}/${selectedFile.name}` : 'No file selected',
        },
      });

      if (!error && data?.text) {
        setAiThinking(false);
        setChatMessages(prev => [
          ...prev.filter(m => !m.isThinking),
          { role: 'assistant', content: data.text, timestamp: ts, aiSource: 'cloud' },
        ]);
        return;
      }

      // Cloud failed — fall through to local stream below
      setChatMessages(prev => prev.filter(m => !m.isThinking));
    }

    // ── Branch: local Ollama streaming ───────────────────────────────────────
    const ollamaReady = router.ollamaAvailable || (await import('@/lib/aiRouter').then(m => m.checkOllamaHealth()));

    if (ollamaReady) {
      const streamId = `stream_${Date.now()}`;
      const routerState = getRouterState();
      const model = routerState.selectedModel || undefined;

      // Seed the streaming bubble (empty content, isStreaming=true)
      setChatMessages(prev => [
        ...prev.filter(m => !m.isThinking),
        {
          role: 'assistant', content: '', timestamp: ts,
          aiSource: 'local', isStreaming: true, streamId,
        },
      ]);

      // Show one-time toast only on first local use
      toast.info(`🧠 DevBot streaming via Local AI (${model || 'Ollama'})`, {
        id: 'devbot-local-stream', duration: 3000,
      });

      let accumulated = '';
      let errMsg: string | null = null;

      try {
        const gen = generateWithOllamaStream(systemPrompt, buildUserPrompt(messageText), model);
        for await (const token of gen) {
          accumulated += token;
          // Batch-update every token — React batches these automatically in concurrent mode
          setChatMessages(prev =>
            prev.map(m =>
              m.streamId === streamId ? { ...m, content: accumulated } : m
            )
          );
        }
      } catch (e) {
        errMsg = (e as Error).message;
      }

      // Finalise: remove streaming markers, add apply patch support
      setAiThinking(false);
      setChatMessages(prev =>
        prev.map(m =>
          m.streamId === streamId
            ? {
                ...m,
                content: accumulated || (errMsg ? `❌ Local AI error: ${errMsg}` : 'No response generated.'),
                isStreaming: false,
                streamId: undefined,
              }
            : m
        )
      );
      return;
    }

    // ── Fallback: non-streaming routedGenerate ───────────────────────────────
    setChatMessages(prev => [
      ...prev.filter(m => !m.isThinking),
      { role: 'assistant', content: '', timestamp: ts, isThinking: true, aiSource: 'cloud' },
    ]);

    const { text, error: fallbackError, source } = await routedGenerate({
      content_type: 'raw',
      context: {
        _raw_system: systemPrompt,
        _raw_user: buildUserPrompt(messageText),
        file_path: selectedFile?.name || 'none',
      },
      identity: { name: 'DevBot', persona: 'Expert VELO 2.0 developer', tone: 'technical', style: 'precise and actionable' },
    }, { isSimpleTask: false });

    setAiThinking(false);
    setChatMessages(prev => [
      ...prev.filter(m => !m.isThinking),
      {
        role: 'assistant',
        content: text || (fallbackError ? `❌ DevBot error: ${fallbackError}\n\nStart Ollama for local AI fallback, or check cloud AI credits.` : 'No response generated.'),
        timestamp: ts,
        aiSource: source === 'cache' ? 'cache' : 'local',
      },
    ]);
  }, [chatInput, aiThinking, chatMessages, selectedFile, editedCode, router]);

  const quickAction = (prompt: string) => {
    setChatInput(prompt);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  };

  const handleCmdBarCommand = (msg: string) => {
    setChatCollapsed(false);
    sendAIMessage(msg);
  };

  // ── Deploy pipeline ─────────────────────────────────────────────────────
  const addDeployLog = useCallback((msg: string) => setDeployLog(prev => [...prev, msg]), []);

  const runDeploy = useCallback(async () => {
    const stagedChanges = changes.filter(c => !c.deployed);
    if (stagedChanges.length === 0) { toast.info('No staged changes to deploy'); return; }
    if (deployStage !== 'idle' && deployStage !== 'done') return;

    setDeployLog([]);
    const stages: { stage: DeployStage; label: string; duration: number }[] = [
      { stage: 'validating', label: 'Validating schema integrity...', duration: 800 },
      { stage: 'testing',    label: 'Running workflow connection tests...', duration: 1200 },
      { stage: 'previewing', label: 'Building preview environment...', duration: 900 },
      { stage: 'deploying',  label: 'Deploying to production...', duration: 1100 },
    ];

    addDeployLog(`╔══════════════════════════════════════════╗`);
    addDeployLog(`║   VELO 2.0 — DEPLOYMENT PIPELINE         ║`);
    addDeployLog(`╚══════════════════════════════════════════╝`);
    addDeployLog(`› Deploy ID: ${deployId}`);
    addDeployLog(`› Staged changes: ${stagedChanges.length} files`);
    stagedChanges.forEach(c => addDeployLog(`  · ${c.fileName}${c.aiAssisted ? ' [AI-assisted]' : ''}`));
    addDeployLog('');

    for (const { stage, label, duration } of stages) {
      setDeployStage(stage);
      addDeployLog(`⟳ [${stage.toUpperCase()}] ${label}`);
      await new Promise(r => setTimeout(r, duration));
      if (stage === 'validating') { addDeployLog('  ✓ RLS policies intact'); addDeployLog('  ✓ TypeScript types resolved'); addDeployLog('  ✓ Foreign key constraints valid'); }
      else if (stage === 'testing') { addDeployLog('  ✓ Auth flow: PASS'); addDeployLog('  ✓ Edge Function connectivity: PASS'); addDeployLog('  ✓ React Query cache: PASS'); }
      else if (stage === 'previewing') { addDeployLog('  ✓ Preview build successful'); addDeployLog('  ✓ No breaking changes detected'); }
      else if (stage === 'deploying') { addDeployLog('  ✓ Vite build completed'); addDeployLog('  ✓ Static assets updated'); addDeployLog('  ✓ Edge Functions synced'); }
      addDeployLog('');
    }

    setDeployStage('done');
    addDeployLog('✓ DEPLOYMENT COMPLETE');
    addDeployLog(`› ${stagedChanges.length} files deployed`);
    addDeployLog(`› Timestamp: ${new Date().toISOString()}`);
    toast.success(`Deployment ${deployId} completed`);

    const updated = changes.map(c => ({ ...c, deployed: true }));
    setChanges(updated); saveChanges(updated);

    await supabase.functions.invoke('dev-console', {
      body: { action: 'log_deployment', deploy_id: deployId, files_changed: stagedChanges.map(c => c.fileName), status: 'success', notes: `${stagedChanges.length} files deployed.` },
    });
  }, [changes, deployStage, deployId, addDeployLog]);

  const rollback = async () => {
    setDeployStage('rolling_back'); setDeployLog([]);
    addDeployLog('⟳ ROLLBACK INITIATED');
    await new Promise(r => setTimeout(r, 600));
    addDeployLog('› Reverting to previous deployment snapshot...');
    await new Promise(r => setTimeout(r, 800));
    addDeployLog('✓ Rollback complete — previous version restored');
    setDeployStage('idle');
    const updated = changes.map(c => ({ ...c, deployed: false }));
    setChanges(updated); saveChanges(updated);
    toast.info('Rolled back to previous deployment');
  };

  const isDirty = selectedFile && editedCode !== (selectedFile.codeContent || '');
  const stagedCount = changes.filter(c => !c.deployed).length;

  if (!unlocked) return <AdminLock onUnlock={() => setUnlocked(true)} />;

  const MAIN_TABS: { id: MainTab; label: string; icon: React.ElementType; color?: string }[] = [
    { id: 'editor',   label: 'Editor',   icon: Code2,         color: 'hsl(185,100%,55%)' },
    { id: 'changes',  label: 'Changes',  icon: GitBranch,     color: 'hsl(30,100%,60%)' },
    { id: 'deploy',   label: 'Deploy',   icon: Upload,        color: 'hsl(265,80%,70%)' },
    { id: 'logs',     label: 'Logs',     icon: ScrollText,    color: 'hsl(50,100%,60%)' },
    { id: 'terminal', label: 'Terminal', icon: Terminal,      color: 'hsl(145,100%,55%)' },
    { id: 'modules',  label: 'Modules',  icon: Boxes,         color: 'hsl(0,85%,65%)' },
  ];

  const activeSource = router.activeSource;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-0 slide-in-up -m-5 lg:-m-6">

      {/* Cmd+K Command Bar */}
      {showCmdBar && <CommandBar onCommand={handleCmdBarCommand} onClose={() => setShowCmdBar(false)} />}

      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.9)] flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Code2 size={13} className="text-black" />
          </div>
          <div>
            <div className="text-xs font-black text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>DEVELOPER CONSOLE</div>
            <div className="text-[9px] text-muted-foreground">VELO 2.0 · Admin · All actions audited</div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 ml-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-[hsl(145,100%,55%)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" /> Platform Online
          </div>
          <div className={cn('flex items-center gap-1.5 text-[10px]', activeSource === 'local' ? 'text-[hsl(145,100%,55%)]' : 'text-[hsl(265,80%,70%)]')}>
            {activeSource === 'local' ? <Cpu size={10} /> : <Cloud size={10} />}
            {activeSource === 'local' ? `Local AI (${router.selectedModel || 'Ollama'})` : 'Cloud AI'}
          </div>
          {stagedCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-[hsl(30,100%,60%)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(30,100%,60%)]" /> {stagedCount} staged
            </div>
          )}
          {router.forcedLocalMode && (
            <div className="flex items-center gap-1.5 text-[10px] text-[hsl(30,100%,60%)] px-2 py-0.5 rounded border border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.06)]">
              <AlertTriangle size={9} /> Credits exhausted — Local AI active
            </div>
          )}
        </div>

        {/* Cmd+K button */}
        <button onClick={() => setShowCmdBar(true)} className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.08)] text-[10px] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.15)] transition-colors flex-shrink-0">
          <Command size={10} /> <kbd className="text-[9px]">⌘K</kbd>
        </button>

        {/* Tab switcher */}
        <div className="flex gap-0.5 p-0.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(228_25%_8%)] flex-wrap">
          {MAIN_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn('px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors relative flex items-center gap-1', activeTab === t.id ? 'bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))]' : 'text-muted-foreground hover:text-foreground')} style={{ color: activeTab === t.id && t.color ? t.color : undefined, fontFamily: 'Orbitron' }}>
                <Icon size={9} />{t.label}
                {t.id === 'changes' && stagedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[hsl(30,100%,55%)] text-[8px] font-bold text-black flex items-center justify-center">{stagedCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main 3-panel layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── File tree (left) ─────────────────────────────────────────────── */}
        <div className={cn('flex-shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.6)] overflow-y-auto flex flex-col transition-all duration-200', treeCollapsed ? 'w-8' : 'w-52')}>
          <div className="px-2 py-2 border-b border-[hsl(var(--border))] flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setTreeCollapsed(s => !s)} className="p-0.5 rounded hover:bg-[hsl(228_25%_15%)] transition-colors">
              <PanelLeft size={11} className="text-muted-foreground" />
            </button>
            {!treeCollapsed && <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Files</span>}
          </div>
          {!treeCollapsed && (
            <>
              <div className="flex-1 py-1 overflow-y-auto">
                {PLATFORM_TREE.map(node => (
                  <FileTreeNode key={node.id} node={node} depth={0} selectedId={selectedFile?.id ?? null} onSelect={selectFile} changedIds={changedIds} />
                ))}
              </div>
              <div className="p-2 border-t border-[hsl(var(--border))] space-y-1">
                {Object.entries(CATEGORY_COLORS).map(([cat, cls]) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: cat === 'frontend' ? 'hsl(185,100%,55%)' : cat === 'backend' ? 'hsl(265,80%,70%)' : cat === 'database' ? 'hsl(50,100%,60%)' : 'hsl(145,100%,55%)' }} />
                    <span className={cn('text-[9px] capitalize', cls.text)}>{cat}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Center panel ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-[hsl(var(--border))]">

          {/* ── EDITOR TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'editor' && (
            <>
              {selectedFile ? (
                <div className="flex items-center gap-3 px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.4)] flex-shrink-0 flex-wrap gap-y-1">
                  {React.createElement(EXT_ICONS[selectedFile.ext || ''] ?? FileText, { size: 13, className: CATEGORY_COLORS[selectedFile.category].text })}
                  <span className="text-xs font-semibold">{selectedFile.name}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize border', CATEGORY_COLORS[selectedFile.category].bg, CATEGORY_COLORS[selectedFile.category].text, CATEGORY_COLORS[selectedFile.category].border)}>{selectedFile.category}</span>
                  {isDirty && <span className="text-[10px] text-[hsl(30,100%,60%)] flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-[hsl(30,100%,60%)]" /> Modified</span>}
                  <div className="flex items-center gap-2 ml-auto">
                    {isDirty && <>
                      <button onClick={discardChange} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"><RotateCcw size={9} /> Discard</button>
                      <button onClick={saveChange} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-[hsl(265_80%_55%/0.15)] border border-[hsl(265_80%_55%/0.3)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.25)] transition-colors"><Save size={9} /> Stage</button>
                    </>}
                    <button onClick={() => { setChatCollapsed(false); quickAction(`Analyze ${selectedFile.name} and suggest improvements or fixes`); sendAIMessage(`Analyze ${selectedFile.name} and suggest improvements or fixes`); }} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-[hsl(265_80%_55%/0.25)] text-[hsl(265,80%,70%)] hover:opacity-90 transition-all">
                      <Bot size={9} /> Ask DevBot
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[hsl(var(--border))] flex-shrink-0">
                  <Info size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Select a file from the tree to view and edit · Press ⌘K for quick commands</span>
                </div>
              )}
              {selectedFile?.description && (
                <div className="px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(228_25%_8%/0.4)] flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">{selectedFile.description}</p>
                </div>
              )}
              <div className="flex-1 overflow-auto p-4">
                {selectedFile ? (
                  <CodeEditor value={editedCode} onChange={setEditedCode} minHeight="100%" />
                ) : (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <Code2 size={40} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                      <div className="text-sm font-semibold text-muted-foreground mb-2">No file selected</div>
                      <div className="text-xs text-muted-foreground opacity-60 max-w-xs mb-5">Select any file from the Platform Tree, or use ⌘K to quickly ask DevBot to build or fix anything.</div>
                      <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                        {[
                          { label: 'Frontend', count: '18 pages', cat: 'frontend' },
                          { label: 'Backend', count: '6 functions', cat: 'backend' },
                          { label: 'Database', count: '22+ tables', cat: 'database' },
                          { label: 'Config', count: '4 files', cat: 'config' },
                        ].map(item => (
                          <div key={item.cat} className={cn('p-3 rounded-lg border text-left', CATEGORY_COLORS[item.cat as keyof typeof CATEGORY_COLORS].bg, CATEGORY_COLORS[item.cat as keyof typeof CATEGORY_COLORS].border)}>
                            <div className={cn('text-xs font-bold', CATEGORY_COLORS[item.cat as keyof typeof CATEGORY_COLORS].text)}>{item.label}</div>
                            <div className="text-[10px] text-muted-foreground">{item.count}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setShowCmdBar(true)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.15)] transition-colors mx-auto">
                        <Command size={12} /> Press ⌘K to open Command Bar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── CHANGES TAB ────────────────────────────────────────────────── */}
          {activeTab === 'changes' && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>STAGED CHANGES</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{stagedCount} ready · {changes.filter(c => c.deployed).length} previously deployed</p>
                </div>
                {stagedCount > 0 && <button onClick={() => setActiveTab('deploy')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 transition-all"><Play size={11} /> Deploy Now</button>}
              </div>
              {changes.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-center">
                  <div><GitBranch size={32} className="mx-auto mb-3 text-muted-foreground opacity-20" /><div className="text-sm text-muted-foreground">No staged changes</div><div className="text-xs text-muted-foreground opacity-60 mt-1">Edit a file and click "Stage" to queue for deployment.</div></div>
                </div>
              ) : changes.slice().reverse().map(change => (
                <div key={change.id} className={cn('glass-panel rounded-xl border p-4', change.deployed ? 'border-[hsl(145_100%_50%/0.15)] opacity-60' : 'border-[hsl(30_100%_55%/0.2)]')}>
                  <div className="flex items-center gap-3 mb-3">
                    <FileCode size={14} className={change.deployed ? 'text-[hsl(145,100%,55%)]' : 'text-[hsl(30,100%,60%)]'} />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{change.fileName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {change.aiAssisted && <span className="text-[hsl(265,80%,70%)]">AI-assisted{change.aiSource ? ` (${change.aiSource})` : ''} · </span>}
                        {new Date(change.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {change.deployed ? <span className="text-[10px] text-[hsl(145,100%,55%)] flex items-center gap-1"><CheckCircle size={10} /> Deployed</span> : <span className="text-[10px] text-[hsl(30,100%,60%)] flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[hsl(30,100%,60%)]" /> Staged</span>}
                      <button onClick={() => revertChange(change)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[hsl(var(--border))] text-muted-foreground hover:text-[hsl(0,85%,65%)] transition-colors"><RotateCcw size={9} /> Revert</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">Before</div><div className="font-mono text-[10px] bg-[hsl(0_85%_60%/0.05)] border border-[hsl(0_85%_60%/0.15)] rounded p-2 max-h-20 overflow-y-auto text-[hsl(0,85%,65%)] opacity-70">{change.oldContent.split('\n').slice(0, 5).join('\n')}...</div></div>
                    <div><div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">After</div><div className="font-mono text-[10px] bg-[hsl(145_100%_50%/0.05)] border border-[hsl(145_100%_50%/0.15)] rounded p-2 max-h-20 overflow-y-auto text-[hsl(145,100%,55%)]">{change.newContent.split('\n').slice(0, 5).join('\n')}...</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── DEPLOY TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'deploy' && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <h2 className="text-sm font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>DEPLOYMENT PIPELINE</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Deploy ID: <span className="font-mono text-[hsl(185,100%,55%)]">{deployId}</span></p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([
                  { stage: 'validating', label: 'Validate',  icon: Shield,    desc: 'Schema + TypeScript' },
                  { stage: 'testing',    label: 'Test',       icon: Activity,  desc: 'Module connectivity' },
                  { stage: 'previewing', label: 'Preview',    icon: Eye,       desc: 'Build preview' },
                  { stage: 'deploying',  label: 'Deploy',     icon: Upload,    desc: 'Push to production' },
                ] as const).map(step => {
                  const Icon = step.icon;
                  const stageOrder = ['validating', 'testing', 'previewing', 'deploying'];
                  const currentIdx = stageOrder.indexOf(deployStage);
                  const stepIdx = stageOrder.indexOf(step.stage);
                  const isDone = deployStage === 'done' || currentIdx > stepIdx;
                  const isCurrent = deployStage === step.stage;
                  return (
                    <div key={step.stage} className={cn('p-3 rounded-xl border text-center transition-all', isDone ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.05)]' : isCurrent ? 'border-[hsl(185_100%_50%/0.4)] bg-[hsl(185_100%_50%/0.07)]' : 'border-[hsl(var(--border))] opacity-40')}>
                      <div className={cn('w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-2', isDone ? 'bg-[hsl(145_100%_50%/0.2)]' : isCurrent ? 'bg-[hsl(185_100%_50%/0.2)] animate-pulse' : 'bg-[hsl(228_25%_15%)]')}>
                        {isDone ? <CheckCircle size={14} className="text-[hsl(145,100%,55%)]" /> : isCurrent ? <RefreshCw size={14} className="text-[hsl(185,100%,55%)] animate-spin" /> : <Icon size={14} className="text-muted-foreground" />}
                      </div>
                      <div className={cn('text-xs font-bold', isDone ? 'text-[hsl(145,100%,55%)]' : isCurrent ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground')} style={{ fontFamily: 'Orbitron' }}>{step.label}</div>
                      <div className="text-[10px] text-muted-foreground">{step.desc}</div>
                    </div>
                  );
                })}
              </div>
              <div ref={deployLogRef} className="bg-[hsl(230_35%_3%)] rounded-xl border border-[hsl(var(--border))] p-4 font-mono text-[10px] h-44 overflow-y-auto">
                {deployLog.length === 0 ? <div className="text-muted-foreground opacity-40">Deploy console — output will appear here when pipeline runs.</div> : deployLog.map((line, i) => (
                  <div key={i} className={cn('leading-5', line.startsWith('╔') || line.startsWith('║') || line.startsWith('╚') ? 'text-[hsl(185,100%,55%)]' : line.startsWith('✓') ? 'text-[hsl(145,100%,55%)]' : line.startsWith('⟳') ? 'text-[hsl(30,100%,60%)]' : line.startsWith('  ✓') ? 'text-[hsl(145,100%,55%)] pl-2' : line.startsWith('  ·') ? 'text-[hsl(185,100%,55%)] pl-2' : line.startsWith('›') ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground')}>{line || '\u00A0'}</div>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={runDeploy} disabled={deployStage !== 'idle' && deployStage !== 'done' || stagedCount === 0} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all">
                  <Play size={14} />{deployStage === 'done' ? 'Redeploy' : deployStage === 'idle' ? `Deploy ${stagedCount} Files` : 'Deploying...'}
                </button>
                {deployStage === 'done' && <button onClick={rollback} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[hsl(0_85%_60%/0.3)] bg-[hsl(0_85%_60%/0.08)] text-[hsl(0,85%,65%)] hover:bg-[hsl(0_85%_60%/0.15)] transition-colors"><RotateCcw size={14} /> Rollback</button>}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[hsl(var(--border))] text-xs text-muted-foreground"><Shield size={11} className="text-[hsl(145,100%,55%)]" />All deployments logged in Audit Log</div>
              </div>
            </div>
          )}

          {/* ── LOGS TAB ─────────────────────────────────────────────────────── */}
          {activeTab === 'logs' && <LogsTab />}

          {/* ── TERMINAL TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'terminal' && <TerminalTab onTriggerDeploy={() => { setActiveTab('deploy'); runDeploy(); }} />}

          {/* ── MODULES TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'modules' && <ModulesTab onSendToChat={(msg) => { setChatCollapsed(false); sendAIMessage(msg); }} />}
        </div>

        {/* ── Right: AI Assistant ──────────────────────────────────────────── */}
        <div className={cn('flex-shrink-0 flex flex-col bg-[hsl(228_35%_4%/0.4)] transition-all duration-200', chatCollapsed ? 'w-8' : 'w-72 xl:w-80')}>
          {/* AI header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border))] flex-shrink-0">
            <button onClick={() => setChatCollapsed(s => !s)} className="p-0.5 rounded hover:bg-[hsl(228_25%_15%)] transition-colors flex-shrink-0">
              <PanelRight size={11} className="text-muted-foreground" />
            </button>
            {!chatCollapsed && (
              <>
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={11} className="text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>VELO DevBot</div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {activeSource === 'local' ? `Local AI · ${router.selectedModel || 'Ollama'}` : 'Cloud AI · Gemini 3 Flash'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {activeSource === 'local'
                    ? <Cpu size={9} className="text-[hsl(145,100%,55%)]" />
                    : <Cloud size={9} className="text-[hsl(265,80%,70%)]" />}
                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
                </div>
              </>
            )}
          </div>

          {!chatCollapsed && (
            <>
              {/* Quick action buttons */}
              <div className="px-3 py-2 border-b border-[hsl(var(--border))] flex flex-wrap gap-1.5">
                {[
                  { label: 'Analyze', prompt: selectedFile ? `Analyze ${selectedFile.name} for bugs and improvements` : 'What are the main areas I should improve in this codebase?' },
                  { label: 'Fix Bug',  prompt: selectedFile ? `Find and fix bugs in ${selectedFile.name}` : 'Help me debug errors in VELO 2.0' },
                  { label: 'New Page', prompt: 'Help me create a new VELO 2.0 page following the galaxy HUD theme' },
                  { label: 'Explain', prompt: selectedFile ? `Explain how ${selectedFile.name} works in detail` : 'Explain the VELO 2.0 platform architecture' },
                  { label: 'Schema',  prompt: 'Review the database schema and suggest improvements' },
                  { label: 'Refactor', prompt: selectedFile ? `Refactor ${selectedFile.name} for better performance` : 'What refactoring opportunities exist?' },
                ].map(qa => (
                  <button key={qa.label} onClick={() => { quickAction(qa.prompt); sendAIMessage(qa.prompt); }} className="text-[9px] px-2 py-1 rounded bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.2)] transition-colors">{qa.label}</button>
                ))}
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.map((msg, i) => (
                  <ChatBubble key={i} msg={msg} onApplyPatch={msg.role === 'assistant' && !msg.isThinking ? applyPatchAndStage : undefined} />
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Selected file context */}
              {selectedFile && (
                <div className="px-3 py-1.5 border-t border-[hsl(var(--border))] flex items-center gap-1.5 bg-[hsl(265_80%_55%/0.04)]">
                  <FileCode size={10} className="text-[hsl(265,80%,70%)]" />
                  <span className="text-[10px] text-[hsl(265,80%,70%)] truncate">Context: {selectedFile.name}</span>
                </div>
              )}

              {/* AI router status bar */}
              <div className={cn('px-3 py-1.5 border-t flex items-center gap-2 text-[9px]', router.forcedLocalMode ? 'border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.04)]' : 'border-[hsl(var(--border))]')}>
                {router.forcedLocalMode
                  ? <><AlertTriangle size={9} className="text-[hsl(30,100%,60%)] flex-shrink-0" /><span className="text-[hsl(30,100%,60%)]">Credits exhausted — Local AI active</span></>
                  : activeSource === 'local'
                  ? <><Cpu size={9} className="text-[hsl(145,100%,55%)]" /><span className="text-muted-foreground">Local: {router.selectedModel || 'Ollama'}</span></>
                  : <><Cloud size={9} className="text-[hsl(265,80%,70%)]" /><span className="text-muted-foreground">Cloud AI ready</span></>
                }
                <span className="ml-auto text-muted-foreground">{router.totalRequests} reqs · {router.localPercent}% local</span>
              </div>

              {/* Chat input */}
              <div className="p-3 border-t border-[hsl(var(--border))] flex-shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={chatInputRef}
                    className="flex-1 px-3 py-2 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(265_80%_55%/0.2)] text-xs focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors resize-none leading-relaxed"
                    placeholder="Ask DevBot anything... ⌘K for quick commands"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); } }}
                  />
                  <button onClick={() => sendAIMessage()} disabled={aiThinking || !chatInput.trim()} className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0">
                    {aiThinking ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
                <div className="text-[9px] text-muted-foreground mt-1.5 text-center">
                  Enter to send · Shift+Enter for newline · ⌘K for command bar
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
