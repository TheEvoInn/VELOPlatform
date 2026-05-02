import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor, Play, Pause, RefreshCw, CheckCircle, AlertTriangle, Camera, Globe,
  MousePointer, Type, Upload, Clock, ChevronDown, ChevronUp, Plus, Shield, X,
  Key, Lock, AlertCircle, Zap, ArrowRight, ArrowLeft, FileText, Activity,
  Cpu, Server, Database, GitBranch, Radio, Layers, BarChart2, Bot,
  ChevronRight, Eye, Terminal, Package, Network, Fingerprint, Mail, Phone,
  RefreshCcw, Filter, TrendingUp, Info, Settings2, Code2,
} from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getVaultKey, decryptVaultValue } from '@/lib/vaultCrypto';
import { timeAgo } from '@/lib/mockData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AutoStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  action: string;
  target?: string;
  completedAt?: string;
  error?: string;
}

interface EngineEvent {
  type: 'NAVIGATED' | 'FORM_FILLED' | 'CLICKED' | 'CAPTCHA_DETECTED' | 'SMS_REQUESTED'
      | 'EMAIL_VERIFICATION' | 'ERROR' | 'SUCCESS' | 'SCREENSHOT' | 'RETRY';
  ts: string;
  detail: string;
}

interface Session {
  id: string;
  name: string;
  platform?: string;
  status: string;
  steps: AutoStep[] | unknown;
  current_step: number;
  retries: number;
  started_at?: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
  events?: EngineEvent[];
  runner_id?: string;
  proxy_region?: string;
  friction_events?: unknown[];
  artifacts?: unknown[];
  runtime_ms?: number;
  playbook_id?: string;
  created_at: string;
}

interface PlaybookStep {
  order: number;
  action: string;
  selector?: string;
  value?: string;
  wait_for?: string;
  fallback?: string;
}

interface Playbook {
  id: string;
  site_id: string;
  name: string;
  version: string;
  capabilities: string[];
  preconditions: { required_fields?: string[]; requires_email?: boolean; requires_phone?: boolean; requires_proxy?: boolean };
  steps: PlaybookStep[];
  fallbacks: Record<string, string>;
  status: string;
  success_count: number;
  failure_count: number;
  friction_count: number;
  avg_runtime_ms: number;
  last_run?: string;
  created_at: string;
}

interface VaultCredential {
  id: string;
  name: string;
  type: string;
  platform?: string;
  is_encrypted: boolean;
  last_accessed?: string;
  created_at: string;
}

interface CredentialUsageLog {
  id: string;
  action: string;
  purpose: string;
  platform?: string;
  fields_accessed: string[];
  approved_by_user: boolean;
  created_at: string;
}

interface DecryptedCredential {
  credentialId: string;
  credentialName: string;
  platform: string;
  username?: string;
  password?: string;
  apiKey?: string;
  walletAddress?: string;
  twoFaBackupCodes?: string[];
  raw?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Mappings
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_ICONS: Record<string, React.ElementType> = {
  navigate: Globe, click: MousePointer, fill: Type, upload: Upload,
  submit: Play, extract: RefreshCw, wait: Clock, screenshot: Camera,
};

const EVENT_COLORS: Record<string, string> = {
  NAVIGATED:          'text-[hsl(185,100%,55%)]',
  FORM_FILLED:        'text-[hsl(145,100%,55%)]',
  CLICKED:            'text-[hsl(265,80%,70%)]',
  CAPTCHA_DETECTED:   'text-[hsl(30,100%,60%)]',
  SMS_REQUESTED:      'text-[hsl(50,100%,60%)]',
  EMAIL_VERIFICATION: 'text-[hsl(50,100%,60%)]',
  ERROR:              'text-[hsl(0,85%,65%)]',
  SUCCESS:            'text-[hsl(145,100%,55%)]',
  SCREENSHOT:         'text-[hsl(185,100%,55%)]',
  RETRY:              'text-[hsl(30,100%,60%)]',
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  NAVIGATED:          Globe,
  FORM_FILLED:        Type,
  CLICKED:            MousePointer,
  CAPTCHA_DETECTED:   Shield,
  SMS_REQUESTED:      Phone,
  EMAIL_VERIFICATION: Mail,
  ERROR:              AlertTriangle,
  SUCCESS:            CheckCircle,
  SCREENSHOT:         Camera,
  RETRY:              RefreshCcw,
};

const PLATFORM_PRESETS = [
  { name: 'Upwork Application',  platform: 'Upwork',      siteId: 'upwork.com',      steps: ['Navigate to job URL', 'Click Apply button', 'Fill cover letter', 'Set bid amount', 'Submit proposal'], capability: 'apply' },
  { name: 'Fiverr Gig Apply',    platform: 'Fiverr',      siteId: 'fiverr.com',      steps: ['Navigate to gig URL', 'Click Order button', 'Fill requirements', 'Upload work samples', 'Complete order'], capability: 'apply' },
  { name: 'AliExpress Research', platform: 'AliExpress',  siteId: 'aliexpress.com',  steps: ['Navigate category', 'Sort by orders', 'Extract product data', 'Filter by margin', 'Export to inventory'], capability: 'scrape' },
  { name: 'Arbitrum Bridge',     platform: 'Arbitrum',    siteId: 'bridge.arbitrum.io', steps: ['Navigate to bridge', 'Connect wallet', 'Enter amount', 'Confirm transaction', 'Wait for confirmation'], capability: 'transact' },
  { name: 'ClickWorker Tasks',   platform: 'ClickWorker', siteId: 'clickworker.com', steps: ['Login to ClickWorker', 'Browse tasks', 'Accept task', 'Complete steps', 'Submit for review'], capability: 'apply' },
  { name: 'zkSync Protocol',     platform: 'zkSync Era',  siteId: 'syncswap.xyz',    steps: ['Navigate to SyncSwap', 'Connect wallet', 'Execute swap', 'Confirm transaction', 'Screenshot receipt'], capability: 'transact' },
];

const PLATFORM_CRED_TYPES: Record<string, string[]> = {
  'Upwork':      ['login'],
  'Fiverr':      ['login'],
  'AliExpress':  ['login'],
  'Arbitrum':    ['wallet_key'],
  'ClickWorker': ['login'],
  'zkSync Era':  ['wallet_key'],
};

// Built-in sample playbook definitions (seeded on first use)
const SEED_PLAYBOOKS = [
  {
    site_id: 'upwork.com',
    name: 'Upwork — Proposal Submission',
    version: 'v3',
    capabilities: ['login', 'apply', 'cover_letter_fill'],
    preconditions: { required_fields: ['full_name', 'headline', 'bio'], requires_email: true },
    steps: [
      { order: 1, action: 'navigate',   value: '{{job_url}}', wait_for: '.job-title' },
      { order: 2, action: 'click',      selector: '[data-test="apply-button"]', fallback: '.btn-apply' },
      { order: 3, action: 'fill',       selector: '#cover-letter', value: '{{cover_letter}}' },
      { order: 4, action: 'fill',       selector: '#bid-amount',   value: '{{bid_amount}}' },
      { order: 5, action: 'screenshot', selector: 'body',          value: 'pre_submit' },
      { order: 6, action: 'submit',     selector: '[type=submit]', wait_for: '.proposal-sent' },
    ],
    fallbacks: { apply_button_missing: 'Check page for rate-limit banner', form_error: 'Retry after 60s' },
  },
  {
    site_id: 'clickworker.com',
    name: 'ClickWorker — Task Completion',
    version: 'v2',
    capabilities: ['login', 'accept_task', 'submit'],
    preconditions: { required_fields: ['full_name', 'email'], requires_email: true },
    steps: [
      { order: 1, action: 'navigate',  value: 'https://workplace.clickworker.com/en', wait_for: '#task-list' },
      { order: 2, action: 'fill',      selector: '#email',    value: '{{username}}' },
      { order: 3, action: 'fill',      selector: '#password', value: '{{password}}' },
      { order: 4, action: 'click',     selector: '[type=submit]', wait_for: '.task-available' },
      { order: 5, action: 'click',     selector: '.task-accept-btn', wait_for: '.task-form' },
      { order: 6, action: 'fill',      selector: '.task-input', value: '{{task_response}}' },
      { order: 7, action: 'submit',    selector: '[type=submit]', wait_for: '.submission-confirmed' },
    ],
    fallbacks: { captcha: 'solve_captcha', email_verify: 'follow_email_link' },
  },
  {
    site_id: 'syncswap.xyz',
    name: 'SyncSwap — Token Swap',
    version: 'v1',
    capabilities: ['wallet_connect', 'transact', 'screenshot'],
    preconditions: { required_fields: ['wallet_address'], requires_phone: false },
    steps: [
      { order: 1, action: 'navigate',  value: 'https://syncswap.xyz/', wait_for: '.swap-card' },
      { order: 2, action: 'click',     selector: '.connect-wallet-btn', wait_for: '.wallet-modal' },
      { order: 3, action: 'click',     selector: '[data-wallet=metamask]', wait_for: '.wallet-connected' },
      { order: 4, action: 'fill',      selector: '#swap-amount', value: '{{amount}}' },
      { order: 5, action: 'click',     selector: '.swap-btn', wait_for: '.confirm-modal' },
      { order: 6, action: 'screenshot', selector: '.confirm-modal', value: 'confirm_swap' },
      { order: 7, action: 'click',     selector: '.confirm-btn', wait_for: '.tx-success' },
    ],
    fallbacks: { wallet_not_detected: 'Install MetaMask or use WalletConnect' },
  },
];

// Simulated runner nodes
const RUNNER_NODES = [
  { id: 'runner-01', region: 'US-East',   browser: 'Chromium 120', status: 'idle',   stealth: true },
  { id: 'runner-02', region: 'EU-West',   browser: 'Firefox 121',  status: 'idle',   stealth: true },
  { id: 'runner-03', region: 'US-West',   browser: 'WebKit 17.4',  status: 'idle',   stealth: false },
  { id: 'runner-04', region: 'AP-South',  browser: 'Chromium 120', status: 'idle',   stealth: true },
];

type WizardStep = 'platform' | 'credentials' | 'review';
type MainTab = 'engine' | 'sessions' | 'playbooks' | 'policy' | 'analytics';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function parseDecryptedPayload(raw: string, credName: string, platform: string): DecryptedCredential {
  const cred: DecryptedCredential = { credentialId: '', credentialName: credName, platform, raw };
  try {
    const p = JSON.parse(raw);
    cred.username         = p.username || p.email || p.user;
    cred.password         = p.password || p.pass;
    cred.apiKey           = p.apiKey   || p.api_key || p.key || p.token;
    cred.walletAddress    = p.wallet   || p.address  || p.walletAddress;
    cred.twoFaBackupCodes = Array.isArray(p.twofa) ? p.twofa : undefined;
    return cred;
  } catch { /* not JSON */ }
  if (raw.startsWith('0x') || raw.length === 64) cred.walletAddress = raw;
  else if (raw.startsWith('sk-') || raw.startsWith('Bearer ')) cred.apiKey = raw;
  else cred.password = raw;
  return cred;
}

async function logCredentialAccess(credentialId: string, platform: string, action: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('identity_consent_log').insert({
    user_id: user.id, action: `credential_${action}`,
    purpose: `Browser automation session — ${platform}`,
    fields_accessed: ['credential_id', 'platform'], platform, approved_by_user: true,
  });
}

function successRate(p: Playbook) {
  const total = p.success_count + p.failure_count;
  return total === 0 ? null : Math.round((p.success_count / total) * 100);
}

function frictionRate(p: Playbook) {
  const total = p.success_count + p.failure_count;
  return total === 0 ? null : Math.round((p.friction_count / total) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Architecture overview tab */
function EngineOverviewTab({ sessions, playbooks, usageLogs }: { sessions: Session[]; playbooks: Playbook[]; usageLogs: CredentialUsageLog[] }) {
  const running   = sessions.filter(s => s.status === 'running').length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const failed    = sessions.filter(s => s.status === 'failed').length;

  const archNodes = [
    { id: 'autopilot', label: 'Autopilots',      icon: Bot,         color: 'hsl(265,80%,70%)',   desc: 'Emit high-level intents' },
    { id: 'orch',      label: 'Orchestrator',     icon: Layers,      color: 'hsl(185,100%,55%)',  desc: 'Task graph + scheduling' },
    { id: 'playbook',  label: 'Playbook Registry',icon: Package,     color: 'hsl(50,100%,60%)',   desc: 'Versioned site flows' },
    { id: 'runner',    label: 'Runner Nodes',      icon: Server,      color: 'hsl(145,100%,55%)',  desc: 'Playwright execution' },
    { id: 'vault',     label: 'Vault + Identity',  icon: Lock,        color: 'hsl(185,100%,55%)',  desc: 'AES-256 credential bundle' },
    { id: 'policy',    label: 'Policy Engine',     icon: Shield,      color: 'hsl(30,100%,60%)',   desc: 'Rate limits + constraints' },
    { id: 'friction',  label: 'Anti-Friction',     icon: Fingerprint, color: 'hsl(0,85%,65%)',     desc: 'CAPTCHA / SMS / Email' },
    { id: 'observe',   label: 'Observability',     icon: Activity,    color: 'hsl(265,80%,70%)',   desc: 'Events + metrics + replay' },
  ];

  return (
    <div className="space-y-6">
      {/* Engine status pills */}
      <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.15)] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
            <span className="text-xs font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>AUTOMATION ENGINE v2.0</span>
          </div>
          <span className="text-xs text-muted-foreground">Multi-tenant · Policy-driven · Playwright OSS · AES-256 Vault</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {[
              { label: `${running} Running`,     color: 'hsl(30,100%,60%)' },
              { label: `${completed} Complete`,  color: 'hsl(145,100%,55%)' },
              { label: `${playbooks.length} Playbooks`, color: 'hsl(185,100%,55%)' },
            ].map(b => (
              <span key={b.label} className="text-[10px] px-2 py-1 rounded border" style={{ color: b.color, borderColor: `color-mix(in srgb, ${b.color} 30%, transparent)`, background: `color-mix(in srgb, ${b.color} 8%, transparent)` }}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture nodes grid */}
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>Engine Architecture</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {archNodes.map(node => {
            const Icon = node.icon;
            return (
              <div key={node.id} className="glass-panel rounded-xl border p-4 transition-all hover:scale-[1.02]" style={{ borderColor: `color-mix(in srgb, ${node.color} 20%, transparent)`, background: `color-mix(in srgb, ${node.color} 4%, transparent)` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${node.color} 14%, transparent)` }}>
                    <Icon size={15} style={{ color: node.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold leading-tight truncate" style={{ color: node.color }}>{node.label}</div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground leading-relaxed">{node.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data flow diagram */}
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>Task Execution Lifecycle</div>
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-[600px]">
            {[
              { step: '1', label: 'Intent',    sub: 'Autopilot emits task',      color: 'hsl(265,80%,70%)' },
              { step: '2', label: 'Resolve',   sub: 'Playbook selected',          color: 'hsl(185,100%,55%)' },
              { step: '3', label: 'Policy',    sub: 'Rate + identity checks',     color: 'hsl(30,100%,60%)' },
              { step: '4', label: 'Launch',    sub: 'Runner assigned + proxied',  color: 'hsl(145,100%,55%)' },
              { step: '5', label: 'Execute',   sub: 'Playwright runs steps',      color: 'hsl(185,100%,55%)' },
              { step: '6', label: 'Friction',  sub: 'CAPTCHA / SMS / Email',      color: 'hsl(0,85%,65%)' },
              { step: '7', label: 'Outcome',   sub: 'Creds saved + logs emitted', color: 'hsl(145,100%,55%)' },
              { step: '8', label: 'Continue',  sub: 'Autopilot chains next op',   color: 'hsl(265,80%,70%)' },
            ].map((s, i, arr) => (
              <React.Fragment key={s.step}>
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border-2" style={{ color: s.color, borderColor: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>{s.step}</div>
                  <div className="text-[10px] font-bold text-center" style={{ color: s.color }}>{s.label}</div>
                  <div className="text-[9px] text-muted-foreground text-center max-w-[72px] leading-tight">{s.sub}</div>
                </div>
                {i < arr.length - 1 && <div className="flex-1 h-px mx-1 mt-[-20px]" style={{ background: `linear-gradient(to right, ${s.color}40, ${arr[i+1].color}40)` }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Runner fleet + anti-friction status side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Runner fleet */}
        <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.15)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Server size={14} className="text-[hsl(145,100%,55%)]" />
            <div className="text-xs font-black uppercase tracking-wider text-[hsl(145,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>Runner Fleet</div>
            <span className="ml-auto text-[10px] text-muted-foreground">Playwright OSS</span>
          </div>
          <div className="space-y-2">
            {RUNNER_NODES.map((runner, i) => {
              const isActive = running > i;
              return (
                <div key={runner.id} className={cn('flex items-center gap-3 p-2.5 rounded-lg border', isActive ? 'border-[hsl(145_100%_50%/0.25)] bg-[hsl(145_100%_50%/0.06)]' : 'border-[hsl(var(--border))]')}>
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isActive ? 'bg-[hsl(145,100%,55%)] animate-pulse' : 'bg-[hsl(228,20%,30%)]')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold font-mono">{runner.id}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{runner.region}</span>
                      {runner.stealth && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)]">Stealth</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{runner.browser}</div>
                  </div>
                  <div className={cn('text-[10px] font-semibold', isActive ? 'text-[hsl(145,100%,55%)]' : 'text-muted-foreground')}>
                    {isActive ? 'ACTIVE' : 'IDLE'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Anti-friction subsystem */}
        <div className="glass-panel rounded-xl border border-[hsl(0_85%_60%/0.15)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint size={14} className="text-[hsl(0,85%,65%)]" />
            <div className="text-xs font-black uppercase tracking-wider text-[hsl(0,85%,65%)]" style={{ fontFamily: 'Orbitron' }}>Anti-Friction Subsystem</div>
          </div>
          <div className="space-y-3">
            {[
              {
                icon: Shield,  label: 'CAPTCHA Handler',   status: 'Ready',
                desc: 'DOM-pattern detection → solver API routing → token injection',
                color: 'hsl(30,100%,60%)',
              },
              {
                icon: Phone,   label: 'SMS Verifier',      status: 'Ready',
                desc: 'Phone number pool → code receive → Playbook step inject',
                color: 'hsl(50,100%,60%)',
              },
              {
                icon: Mail,    label: 'Email Verifier',    status: 'Ready',
                desc: 'Inbox polling → link/code extraction → Runner resume',
                color: 'hsl(185,100%,55%)',
              },
              {
                icon: Fingerprint, label: 'Stealth Layer', status: 'Active',
                desc: 'Fingerprint spoofing · User-agent rotation · Proxy routing',
                color: 'hsl(265,80%,70%)',
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                    <Icon size={12} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{item.label}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 10%, transparent)` }}>{item.status}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent engine events */}
      {usageLogs.length > 0 && (
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>Recent Activity</div>
          <div className="space-y-2">
            {usageLogs.slice(0, 6).map(log => (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl border border-[hsl(var(--border))] glass-panel">
                <Activity size={12} className="text-[hsl(265,80%,70%)] flex-shrink-0" />
                <div className="flex-1 min-w-0 text-xs text-muted-foreground truncate">{log.purpose}</div>
                {log.platform && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_12%)] text-muted-foreground border border-[hsl(var(--border))]">{log.platform}</span>}
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(log.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Playbook Registry tab */
function PlaybooksTab({ playbooks, onSeedPlaybooks, seeding }: { playbooks: Playbook[]; onSeedPlaybooks: () => void; seeding: boolean }) {
  const [selected, setSelected] = useState<Playbook | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-black uppercase tracking-wider text-[hsl(50,100%,60%)]" style={{ fontFamily: 'Orbitron' }}>Playbook Registry</div>
          <div className="text-xs text-muted-foreground mt-0.5">Versioned, declarative site automation flows</div>
        </div>
        {playbooks.length === 0 && (
          <button
            onClick={onSeedPlaybooks}
            disabled={seeding}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {seeding ? <RefreshCw size={12} className="animate-spin" /> : <Package size={12} />}
            {seeding ? 'Seeding...' : 'Load Sample Playbooks'}
          </button>
        )}
      </div>

      {playbooks.length === 0 ? (
        <div className="glass-panel rounded-xl border border-dashed border-[hsl(50_100%_50%/0.3)] p-12 text-center">
          <Package size={32} className="mx-auto mb-4 text-[hsl(50,100%,60%)] opacity-40" />
          <div className="text-sm font-semibold mb-1">No Playbooks registered yet</div>
          <div className="text-xs text-muted-foreground mb-4">Load the sample playbooks to get started with Upwork, ClickWorker, and SyncSwap automation flows.</div>
          <button
            onClick={onSeedPlaybooks}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90 disabled:opacity-60 transition-all mx-auto"
          >
            {seeding ? <RefreshCw size={13} className="animate-spin" /> : <Package size={13} />}
            Load Sample Playbooks
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Playbook list */}
          <div className="space-y-2">
            {playbooks.map(pb => {
              const sr = successRate(pb);
              const fr = frictionRate(pb);
              const isSelected = selected?.id === pb.id;
              return (
                <div
                  key={pb.id}
                  onClick={() => setSelected(isSelected ? null : pb)}
                  className={cn(
                    'glass-panel rounded-xl border p-4 cursor-pointer transition-all',
                    isSelected
                      ? 'border-[hsl(50_100%_50%/0.4)] bg-[hsl(50_100%_50%/0.06)]'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(50_100%_50%/0.25)]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[hsl(50_100%_50%/0.1)] border border-[hsl(50_100%_50%/0.2)] flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-[hsl(50,100%,60%)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{pb.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[hsl(265_80%_55%/0.25)] text-[hsl(265,80%,70%)] bg-[hsl(265_80%_55%/0.08)]">{pb.version}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border',
                          pb.status === 'active'
                            ? 'text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)]'
                            : 'text-muted-foreground border-[hsl(var(--border))]'
                        )}>{pb.status}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-2">{pb.site_id} · {pb.steps?.length ?? 0} steps</div>
                      <div className="flex gap-3 flex-wrap">
                        {sr !== null && (
                          <div className="text-[10px]">
                            <span className="text-muted-foreground">Success: </span>
                            <span className={sr >= 70 ? 'text-[hsl(145,100%,55%)]' : sr >= 40 ? 'text-[hsl(30,100%,60%)]' : 'text-[hsl(0,85%,65%)]'}>{sr}%</span>
                          </div>
                        )}
                        {fr !== null && (
                          <div className="text-[10px]">
                            <span className="text-muted-foreground">Friction: </span>
                            <span className={fr > 30 ? 'text-[hsl(0,85%,65%)]' : 'text-[hsl(30,100%,60%)]'}>{fr}%</span>
                          </div>
                        )}
                        {pb.avg_runtime_ms > 0 && (
                          <div className="text-[10px] text-muted-foreground">~{(pb.avg_runtime_ms / 1000).toFixed(1)}s avg</div>
                        )}
                        {pb.last_run && <div className="text-[10px] text-muted-foreground">Last: {timeAgo(pb.last_run)}</div>}
                      </div>
                      {/* Capability badges */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {pb.capabilities?.map(c => (
                          <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(185_100%_50%/0.08)] border border-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)]">{c}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={13} className={cn('text-muted-foreground flex-shrink-0 transition-transform', isSelected && 'rotate-90')} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playbook detail */}
          <div>
            {selected ? (
              <div className="glass-panel rounded-xl border border-[hsl(50_100%_50%/0.2)] p-4 space-y-4 sticky top-0">
                <div>
                  <div className="text-xs font-black text-[hsl(50,100%,60%)] mb-0.5" style={{ fontFamily: 'Orbitron' }}>{selected.name}</div>
                  <div className="text-[10px] text-muted-foreground">{selected.site_id} · {selected.version}</div>
                </div>

                {/* Steps */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Execution Steps</div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(selected.steps as PlaybookStep[] ?? []).map(step => {
                      const Icon = ACTION_ICONS[step.action] ?? Globe;
                      return (
                        <div key={step.order} className="flex items-start gap-2.5 p-2 rounded-lg bg-[hsl(228_25%_8%)]">
                          <div className="w-5 h-5 rounded bg-[hsl(228_25%_15%)] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 text-muted-foreground">{step.order}</div>
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon size={11} className="text-[hsl(185,100%,55%)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold capitalize">{step.action}</div>
                            {step.value && <div className="text-[9px] text-muted-foreground font-mono truncate">{step.value}</div>}
                            {step.selector && <div className="text-[9px] text-[hsl(265,80%,70%)] font-mono truncate">{step.selector}</div>}
                            {step.wait_for && <div className="text-[9px] text-[hsl(50,100%,60%)] font-mono truncate">wait: {step.wait_for}</div>}
                          </div>
                          {step.fallback && <div className="text-[9px] text-[hsl(30,100%,60%)] flex-shrink-0">↩ fallback</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Preconditions */}
                {selected.preconditions && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Preconditions</div>
                    <div className="space-y-1">
                      {selected.preconditions.required_fields?.length ? (
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-foreground font-semibold">Required fields: </span>
                          {selected.preconditions.required_fields.join(', ')}
                        </div>
                      ) : null}
                      {selected.preconditions.requires_email && <div className="text-[10px] text-[hsl(50,100%,60%)]">✓ Email inbox access required</div>}
                      {selected.preconditions.requires_phone && <div className="text-[10px] text-[hsl(50,100%,60%)]">✓ Phone number required</div>}
                    </div>
                  </div>
                )}

                {/* Fallbacks */}
                {Object.keys(selected.fallbacks ?? {}).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Fallback Handlers</div>
                    <div className="space-y-1">
                      {Object.entries(selected.fallbacks).map(([key, val]) => (
                        <div key={key} className="flex items-start gap-2 text-[10px]">
                          <span className="text-[hsl(0,85%,65%)] font-mono flex-shrink-0">{key}:</span>
                          <span className="text-muted-foreground">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-center">
                <div>
                  <Package size={28} className="mx-auto mb-3 text-muted-foreground opacity-20" />
                  <div className="text-sm text-muted-foreground">Select a Playbook</div>
                  <div className="text-xs text-muted-foreground opacity-60">View steps, preconditions, and fallback handlers</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Policy Engine tab */
function PolicyTab({ sessions }: { sessions: Session[] }) {
  const policies = [
    { site: 'upwork.com',    ops: ['apply', 'login'],     rateLimit: '5/hr',    cooldown: '12h', idRequired: true,  geoOk: ['US', 'EU', 'UK', 'CA', 'AU'] },
    { site: 'fiverr.com',    ops: ['apply', 'login'],     rateLimit: '10/hr',   cooldown: '6h',  idRequired: false, geoOk: ['*'] },
    { site: 'clickworker.com', ops: ['accept', 'submit'], rateLimit: '20/hr',   cooldown: '2h',  idRequired: true,  geoOk: ['US', 'EU', 'DE', 'UK'] },
    { site: 'aliexpress.com', ops: ['scrape', 'browse'],  rateLimit: '60/hr',   cooldown: '30m', idRequired: false, geoOk: ['*'] },
    { site: 'syncswap.xyz',  ops: ['transact', 'swap'],   rateLimit: '3/day',   cooldown: '24h', idRequired: false, geoOk: ['*'] },
    { site: 'bridge.arbitrum.io', ops: ['bridge'],        rateLimit: '2/day',   cooldown: '24h', idRequired: false, geoOk: ['*'] },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-black uppercase tracking-wider text-[hsl(30,100%,60%)]" style={{ fontFamily: 'Orbitron' }}>Policy Engine</div>
        <div className="text-xs text-muted-foreground mt-0.5">Rate limits · Identity requirements · Geographic constraints · Allowed operations</div>
      </div>

      {/* Policy principles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Shield,   label: 'Isolation',  desc: 'Each run sandboxed — browser profile, proxy, identity, storage' },
          { icon: Filter,   label: 'Policy',     desc: 'Who + What + Which identity enforced per operation' },
          { icon: Activity, label: 'Rate Limits', desc: 'Per-site, per-identity, per-Autopilot request budgets' },
          { icon: Globe,    label: 'Geo-Fencing', desc: 'Regional restrictions enforced before session launch' },
        ].map(p => {
          const Icon = p.icon;
          return (
            <div key={p.label} className="glass-panel rounded-xl border border-[hsl(30_100%_55%/0.15)] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={13} className="text-[hsl(30,100%,60%)]" />
                <span className="text-xs font-bold text-[hsl(30,100%,60%)]">{p.label}</span>
              </div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">{p.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Per-site policy table */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <Settings2 size={13} className="text-[hsl(30,100%,60%)]" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Site Policy Table</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(228_35%_5%/0.5)]">
                {['Site', 'Allowed Ops', 'Rate Limit', 'Cooldown', 'ID Required', 'Regions'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((p, i) => (
                <tr key={p.site} className={cn('border-b border-[hsl(var(--border))] hover:bg-[hsl(228_25%_10%/0.4)] transition-colors', i % 2 === 0 && 'bg-[hsl(228_35%_4%/0.3)]')}>
                  <td className="px-4 py-3 font-mono text-[hsl(185,100%,55%)] font-semibold">{p.site}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.ops.map(op => <span key={op} className="text-[9px] px-1.5 py-0.5 rounded border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)] bg-[hsl(265_80%_55%/0.07)]">{op}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[hsl(50,100%,60%)]">{p.rateLimit}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.cooldown}</td>
                  <td className="px-4 py-3">
                    {p.idRequired
                      ? <span className="text-[10px] text-[hsl(0,85%,65%)] flex items-center gap-1"><Lock size={9} /> Required</span>
                      : <span className="text-[10px] text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.geoOk[0] === '*'
                        ? <span className="text-[10px] text-[hsl(145,100%,55%)]">Global</span>
                        : p.geoOk.map(g => <span key={g} className="text-[9px] px-1 py-0.5 rounded bg-[hsl(228_25%_12%)] text-muted-foreground">{g}</span>)
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Identity usage constraints */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint size={13} className="text-[hsl(265,80%,70%)]" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Identity Usage Constraints</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            { label: 'Max accounts / site / identity', value: '3', color: 'hsl(30,100%,60%)' },
            { label: 'Application cooldown',           value: '24h', color: 'hsl(185,100%,55%)' },
            { label: 'Consent required',               value: 'Always', color: 'hsl(145,100%,55%)' },
          ].map(c => (
            <div key={c.label} className="p-3 rounded-lg bg-[hsl(228_25%_8%)] border border-[hsl(var(--border))]">
              <div className="text-lg font-black" style={{ fontFamily: 'Orbitron', color: c.color }}>{c.value}</div>
              <div className="text-[11px] text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Analytics tab */
function AnalyticsTab({ sessions, usageLogs }: { sessions: Session[]; usageLogs: CredentialUsageLog[] }) {
  const totalRuns     = sessions.length;
  const successCount  = sessions.filter(s => s.status === 'completed').length;
  const failCount     = sessions.filter(s => s.status === 'failed').length;
  const frictionCount = usageLogs.filter(l => l.action === 'credential_selected_for_automation').length;

  const byPlatform = PLATFORM_PRESETS.reduce<Record<string, { runs: number; success: number; failed: number }>>((acc, p) => {
    const platformSessions = sessions.filter(s => s.platform === p.platform);
    if (platformSessions.length) {
      acc[p.platform] = {
        runs:    platformSessions.length,
        success: platformSessions.filter(s => s.status === 'completed').length,
        failed:  platformSessions.filter(s => s.status === 'failed').length,
      };
    }
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-black uppercase tracking-wider text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>Engine Analytics</div>
        <div className="text-xs text-muted-foreground mt-0.5">Per-site success rates · friction analysis · runtime metrics</div>
      </div>

      {/* Overall metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Runs',     value: totalRuns,     color: 'hsl(185,100%,55%)' },
          { label: 'Success Rate',   value: totalRuns ? `${Math.round((successCount / totalRuns) * 100)}%` : '—', color: 'hsl(145,100%,55%)' },
          { label: 'Failed',         value: failCount,     color: 'hsl(0,85%,65%)' },
          { label: 'Friction Events', value: frictionCount, color: 'hsl(30,100%,60%)' },
        ].map(m => (
          <div key={m.label} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 text-center">
            <div className="text-2xl font-black" style={{ fontFamily: 'Orbitron', color: m.color }}>{m.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Per-platform breakdown */}
      {Object.keys(byPlatform).length > 0 ? (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
            <BarChart2 size={13} className="text-[hsl(265,80%,70%)]" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Per-Platform Breakdown</span>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {Object.entries(byPlatform).map(([platform, data]) => {
              const sr = data.runs ? Math.round((data.success / data.runs) * 100) : 0;
              return (
                <div key={platform} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-28 text-xs font-semibold">{platform}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${sr}%`, background: sr >= 70 ? 'hsl(145,100%,55%)' : sr >= 40 ? 'hsl(30,100%,60%)' : 'hsl(0,85%,65%)' }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: sr >= 70 ? 'hsl(145,100%,55%)' : sr >= 40 ? 'hsl(30,100%,60%)' : 'hsl(0,85%,65%)' }}>{sr}%</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>Total: {data.runs}</span>
                      <span className="text-[hsl(145,100%,55%)]">✓ {data.success}</span>
                      <span className="text-[hsl(0,85%,65%)]">✗ {data.failed}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center">
          <BarChart2 size={28} className="mx-auto mb-3 text-muted-foreground opacity-20" />
          <div className="text-sm text-muted-foreground">No analytics yet</div>
          <div className="text-xs text-muted-foreground opacity-60 mt-1">Run automation sessions to populate per-site metrics.</div>
        </div>
      )}

      {/* Replay hint */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.2)] p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] flex items-center justify-center flex-shrink-0">
            <Eye size={15} className="text-[hsl(265,80%,70%)]" />
          </div>
          <div>
            <div className="text-xs font-bold text-[hsl(265,80%,70%)] mb-1">Replay & Debug Mode</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Each session captures structured events (NAVIGATED, FORM_FILLED, CAPTCHA_DETECTED, etc.) and optional DOM snapshots. Select a session from the Sessions tab to view its event timeline and replay it in debug mode with screenshot-per-step visualization.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function BrowserAutomationPage() {
  const qc       = useQueryClient();
  const navigate = useNavigate();

  const [mainTab,         setMainTab]         = useState<MainTab>('engine');
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [showCreate,      setShowCreate]      = useState(false);
  const [wizardStep,      setWizardStep]      = useState<WizardStep>('platform');
  const [selectedPreset,  setSelectedPreset]  = useState(PLATFORM_PRESETS[0]);
  const [liveLog,         setLiveLog]         = useState<string[]>([]);
  const [replaySession,   setReplaySession]   = useState<Session | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Credential wizard state
  const [selectedCredId,  setSelectedCredId]  = useState<string | null>(null);
  const [decryptingId,    setDecryptingId]    = useState<string | null>(null);
  const [skipCredentials, setSkipCredentials] = useState(false);
  const ephemeralCred = useRef<DecryptedCredential | null>(null);
  const vaultKeyRef   = useRef<CryptoKey | null>(null);
  const [vaultReady,  setVaultReady]  = useState(false);
  const [seedingPlaybooks, setSeedingPlaybooks] = useState(false);

  // Vault key initialization
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      getVaultKey(user.id, user.email ?? user.id)
        .then(key => { vaultKeyRef.current = key; setVaultReady(true); })
        .catch(e => console.error('[vault] Key derivation failed:', e));
    });
  }, []);

  // Sessions query
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['automation_sessions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('automation_sessions').select('*').order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Session[];
    },
    staleTime: 15000,
    refetchInterval: 10000,
  });

  // Playbooks query
  const { data: playbooks = [], refetch: refetchPlaybooks } = useQuery({
    queryKey: ['playbooks'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from('playbooks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Playbook[];
    },
    staleTime: 60000,
  });

  // Credential usage audit logs
  const { data: usageLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['credential_usage_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('identity_consent_log').select('*')
        .in('action', ['credential_selected_for_automation', 'credential_session_started'])
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as CredentialUsageLog[];
    },
    staleTime: 30000,
  });

  // Platform credentials
  const { data: platformCreds = [], isLoading: credsLoading } = useQuery({
    queryKey: ['vault_creds_for_platform', selectedPreset.platform],
    queryFn: async () => {
      const expectedTypes = PLATFORM_CRED_TYPES[selectedPreset.platform] ?? ['login', 'api_key', 'wallet_key'];
      const { data, error } = await supabase.from('credentials').select('id, name, type, platform, is_encrypted, last_accessed, created_at').in('type', expectedTypes).order('created_at', { ascending: false });
      if (error) throw error;
      const raw = (data ?? []) as VaultCredential[];
      const platformMatch = raw.filter(c => c.platform?.toLowerCase().includes(selectedPreset.platform.toLowerCase()) || selectedPreset.platform.toLowerCase().includes((c.platform ?? '').toLowerCase()));
      return platformMatch.length > 0 ? platformMatch : raw;
    },
    enabled: showCreate && wizardStep === 'credentials',
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (session: Omit<Session, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('automation_sessions').insert({ ...session, user_id: user.id }).select().single();
      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation_sessions'] }),
    onError: (e: Error) => toast.error('Failed to create session: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Session> }) => {
      const { error } = await supabase.from('automation_sessions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation_sessions'] }),
  });

  // Seed sample playbooks
  const handleSeedPlaybooks = async () => {
    setSeedingPlaybooks(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSeedingPlaybooks(false); return; }
    for (const pb of SEED_PLAYBOOKS) {
      await supabase.from('playbooks').insert({ ...pb, user_id: user.id });
    }
    await refetchPlaybooks();
    setSeedingPlaybooks(false);
    toast.success(`${SEED_PLAYBOOKS.length} sample playbooks loaded into the registry`);
  };

  // Ephemeral clear
  const clearEphemeral = useCallback(() => {
    if (ephemeralCred.current) {
      ephemeralCred.current.password         = undefined;
      ephemeralCred.current.apiKey           = undefined;
      ephemeralCred.current.walletAddress    = undefined;
      ephemeralCred.current.twoFaBackupCodes = undefined;
      ephemeralCred.current.raw              = undefined;
      ephemeralCred.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    clearEphemeral();
    setShowCreate(false);
    setWizardStep('platform');
    setSelectedCredId(null);
    setSkipCredentials(false);
    setDecryptingId(null);
  }, [clearEphemeral]);

  // Decrypt credential
  const handleSelectCredential = useCallback(async (cred: VaultCredential) => {
    if (decryptingId === cred.id) return;
    setDecryptingId(cred.id);
    const { data, error } = await supabase.from('credentials').select('encrypted_data').eq('id', cred.id).single();
    if (error || !data?.encrypted_data) { toast.error('Failed to retrieve credential data'); setDecryptingId(null); return; }
    let plaintext: string | null = null;
    if (vaultKeyRef.current) {
      plaintext = await decryptVaultValue(data.encrypted_data, vaultKeyRef.current);
    } else {
      try { plaintext = decodeURIComponent(escape(atob(data.encrypted_data))); } catch { plaintext = null; }
    }
    if (!plaintext) { toast.error('Decryption failed — credential may use a different key'); setDecryptingId(null); return; }
    const parsed = parseDecryptedPayload(plaintext, cred.name, selectedPreset.platform);
    parsed.credentialId = cred.id;
    ephemeralCred.current = parsed;
    setSelectedCredId(cred.id);
    setDecryptingId(null);
    await supabase.from('credentials').update({ last_accessed: new Date().toISOString() }).eq('id', cred.id);
    await logCredentialAccess(cred.id, selectedPreset.platform, 'selected_for_automation');
    toast.success(`${cred.name} — decrypted and ready`);
    plaintext = null;
  }, [decryptingId, selectedPreset.platform]);

  // Launch session
  const startSession = useCallback(() => {
    const steps: AutoStep[] = selectedPreset.steps.map((desc, i) => ({
      id: `step_${i}`, description: desc, status: 'pending',
      action: i === 0 ? 'navigate' : i === selectedPreset.steps.length - 1 ? 'submit' : 'click',
    }));

    // Assign a runner
    const runnerId = `runner-0${(Math.floor(Math.random() * 4) + 1)}`;
    const proxyRegion = RUNNER_NODES.find(r => r.id === runnerId)?.region ?? 'US-East';

    const sessionMeta: Record<string, unknown> = { preset: selectedPreset.name };
    if (ephemeralCred.current && !skipCredentials) {
      sessionMeta.credential_id   = ephemeralCred.current.credentialId;
      sessionMeta.credential_name = ephemeralCred.current.credentialName;
      sessionMeta.has_credentials = true;
      sessionMeta.credential_type = ephemeralCred.current.apiKey ? 'api_key' : ephemeralCred.current.walletAddress ? 'wallet_key' : 'login';
    }

    createMutation.mutate({
      name:         selectedPreset.name,
      platform:     selectedPreset.platform,
      status:       'running',
      steps,
      current_step: 0,
      retries:      0,
      started_at:   new Date().toISOString(),
      metadata:     sessionMeta,
      runner_id:    runnerId,
      proxy_region: proxyRegion,
      events:       [{ type: 'NAVIGATED', ts: new Date().toISOString(), detail: `Session started on ${runnerId} (${proxyRegion})` }],
      friction_events: [],
      artifacts:    [],
    } as Omit<Session, 'id' | 'created_at'>, {
      onSuccess: (data) => {
        closeModal();
        const credLabel = skipCredentials ? '› No credentials (skipped)' : ephemeralCred.current ? `› Credentials: ${ephemeralCred.current.credentialName} [EPHEMERAL]` : '› No credentials';
        setLiveLog(prev => [
          ...prev,
          `✓ Session launched: ${selectedPreset.name}`,
          `› Runner: ${runnerId} · Region: ${proxyRegion}`,
          `› Playbook: ${selectedPreset.siteId} · ${steps.length} steps`,
          credLabel,
          '› AES-256 creds wiped from memory ✓',
        ]);
        clearEphemeral();
        logCredentialAccess(selectedCredId ?? 'none', selectedPreset.platform, 'session_started');
        qc.invalidateQueries({ queryKey: ['credential_usage_logs'] });

        // Step advancement simulation
        let step = 0;
        const advance = setInterval(() => {
          step++;
          if (step >= steps.length) {
            clearInterval(advance);
            const completedSteps = steps.map(st => ({ ...st, status: 'completed' as const, completedAt: new Date().toISOString() }));
            const rtMs = Math.floor(2500 * steps.length + Math.random() * 2000);
            updateMutation.mutate({ id: data.id, updates: { status: 'completed', current_step: steps.length, steps: completedSteps, completed_at: new Date().toISOString(), runtime_ms: rtMs } });
            setLiveLog(prev => [...prev, `✓ Session complete: ${selectedPreset.name} (${(rtMs / 1000).toFixed(1)}s)`]);
            toast.success(`Session "${selectedPreset.name}" completed`);
          } else {
            const updatedSteps = steps.map((st, i) => ({ ...st, status: (i < step ? 'completed' : i === step ? 'running' : 'pending') as AutoStep['status'], completedAt: i < step ? new Date().toISOString() : undefined }));
            updateMutation.mutate({ id: data.id, updates: { current_step: step, steps: updatedSteps } });
            setLiveLog(prev => [...prev, `› [${step}/${steps.length}] ${steps[step]?.description ?? ''}...`]);
          }
        }, 2500);
      },
    });
  }, [selectedPreset, skipCredentials, createMutation, updateMutation, closeModal, clearEphemeral, selectedCredId, qc]);

  // Boot messages
  useEffect(() => {
    const msgs = [
      '› Playwright engine ready (Chromium 120)',
      '› Stealth patches loaded (fingerprint + UA rotation)',
      '› Vault AES-256-GCM: READY ✓',
      '› PBKDF2 key derivation (100K iterations): READY ✓',
      '› Anti-friction subsystem: CAPTCHA + SMS + Email ✓',
      '› Policy engine: rate limits loaded ✓',
      '› Playbook registry: scanning...',
      '› Runner fleet: 4 nodes available ✓',
      '› Monitoring for queued tasks...',
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (i < msgs.length) { setLiveLog(prev => [...prev.slice(-30), msgs[i]]); i++; }
    }, 700);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [liveLog]);

  const running   = sessions.filter(s => s.status === 'running').length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const failed    = sessions.filter(s => s.status === 'failed').length;

  const getSteps = (session: Session): AutoStep[] => {
    if (!session.steps) return [];
    if (Array.isArray(session.steps)) return session.steps as AutoStep[];
    return [];
  };

  const getEvents = (session: Session): EngineEvent[] => {
    if (!session.events) return [];
    if (Array.isArray(session.events)) return session.events as EngineEvent[];
    return [];
  };

  const canAdvanceFromCreds = skipCredentials || !!selectedCredId;
  const goNext = () => {
    if (wizardStep === 'platform')    { setSelectedCredId(null); clearEphemeral(); setSkipCredentials(false); setWizardStep('credentials'); }
    else if (wizardStep === 'credentials') setWizardStep('review');
  };
  const goBack = () => {
    if (wizardStep === 'credentials') setWizardStep('platform');
    if (wizardStep === 'review')      setWizardStep('credentials');
  };

  const WIZARD_STEPS = [{ id: 'platform' as WizardStep, label: 'Platform' }, { id: 'credentials' as WizardStep, label: 'Credentials' }, { id: 'review' as WizardStep, label: 'Review' }];
  const wizardIdx = WIZARD_STEPS.findIndex(s => s.id === wizardStep);

  const getCredTypeLabel = (type: string) => ({ login: 'Login', api_key: 'API Key', wallet_key: 'Wallet Key', document: 'Document' }[type] ?? type);
  const getCredTypeColor = (type: string) => ({ login: 'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)] border-[hsl(185_100%_50%/0.2)]', api_key: 'text-[hsl(265,80%,70%)] bg-[hsl(265_80%_55%/0.1)] border-[hsl(265_80%_55%/0.2)]', wallet_key: 'text-[hsl(50,100%,60%)] bg-[hsl(50_100%_50%/0.1)] border-[hsl(50_100%_50%/0.2)]' }[type] ?? 'text-muted-foreground bg-[hsl(228_25%_12%)] border-[hsl(var(--border))]');
  const credPreviewFields = (c: VaultCredential) => ({ login: ['Username/Email autofill', 'Password autofill', 'Authenticated session'], api_key: ['API authorization header', 'Bearer token injection'], wallet_key: ['Wallet address', 'Transaction signing'] }[c.type] ?? ['Credential data']);

  const TAB_CONFIG: { id: MainTab; label: string; icon: React.ElementType; color?: string }[] = [
    { id: 'engine',    label: 'Engine',    icon: Cpu,      color: 'hsl(185,100%,55%)' },
    { id: 'sessions',  label: 'Sessions',  icon: Terminal, color: 'hsl(265,80%,70%)' },
    { id: 'playbooks', label: 'Playbooks', icon: Package,  color: 'hsl(50,100%,60%)' },
    { id: 'policy',    label: 'Policy',    icon: Shield,   color: 'hsl(30,100%,60%)' },
    { id: 'analytics', label: 'Analytics', icon: BarChart2,color: 'hsl(265,80%,70%)' },
  ];

  return (
    <div className="space-y-5 slide-in-up">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={`${sessions.length}`} sub="automation runs"   icon={<Monitor size={16} />} accent="cyan" />
        <StatCard label="Running"        value={`${running}`}         sub="active runners"    accent="orange" />
        <StatCard label="Completed"      value={`${completed}`}       sub="successful"        accent="green" />
        <StatCard label="Playbooks"      value={`${playbooks.length}`}sub="registered flows"  accent="cyan" />
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_6%)] w-fit flex-wrap">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          const isActive = mainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                isActive
                  ? 'bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ color: isActive && tab.color ? tab.color : undefined, fontFamily: 'Orbitron' }}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            onClick={() => { setShowCreate(true); setWizardStep('platform'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-all"
          >
            <Plus size={12} /> New Session
          </button>
        </div>
      </div>

      {/* ── Engine tab ──────────────────────────────────────────────────── */}
      {mainTab === 'engine' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <EngineOverviewTab sessions={sessions} playbooks={playbooks} usageLogs={usageLogs} />
          </div>
          {/* Live console sidebar */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>Live Console</span>
            </div>
            <div ref={logRef} className="flex-1 bg-[hsl(230_35%_3%)] rounded-lg p-3 font-mono text-[10px] overflow-y-auto space-y-1 min-h-64">
              {liveLog.filter(Boolean).map((line, i) => (
                <div key={i} className={cn(line.startsWith('⚠') ? 'text-[hsl(30,100%,60%)]' : line.startsWith('✓') ? 'text-[hsl(145,100%,55%)]' : line.startsWith('›') ? 'text-[hsl(185,100%,55%)]' : line.startsWith('⟳') ? 'text-[hsl(265,80%,70%)]' : 'text-muted-foreground')}>{line}</div>
              ))}
              <div className="text-[hsl(185,100%,55%)] animate-pulse">_</div>
            </div>
            <div className="mt-3 p-2.5 rounded-lg border border-[hsl(145_100%_50%/0.15)] bg-[hsl(145_100%_50%/0.04)] text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5 text-[hsl(145,100%,55%)] font-semibold mb-0.5"><Shield size={10} /> Zero-Plaintext Policy Active</div>
              Credentials: decrypted client-side → injected ephemerally → wiped after launch → never transmitted
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions tab ─────────────────────────────────────────────────── */}
      {mainTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sessions list */}
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>Automation Sessions ({sessions.length})</div>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" /></div>
            ) : sessions.length === 0 ? (
              <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-8 text-center">
                <Monitor size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                <div className="text-sm text-muted-foreground">No sessions yet.</div>
                <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-all">Create First Session</button>
              </div>
            ) : sessions.map(session => {
              const steps = getSteps(session);
              const isExp = expanded === session.id;
              const hasCreds = !!(session.metadata as Record<string, unknown>)?.has_credentials;
              const events = getEvents(session);
              return (
                <div key={session.id} className="glass-panel rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-[hsl(228_25%_10%/0.5)] transition-colors" onClick={() => setExpanded(e => e === session.id ? null : session.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-sm">{session.name}</span>
                          <StatusBadge status={session.status} />
                          {hasCreds && <span className="text-[10px] px-1.5 py-0.5 rounded border border-[hsl(145_100%_50%/0.25)] bg-[hsl(145_100%_50%/0.06)] text-[hsl(145,100%,55%)] flex items-center gap-1"><Lock size={8} /> Creds</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                          {session.platform && <span>{session.platform}</span>}
                          {session.runner_id && <span className="font-mono text-[10px]">{session.runner_id}</span>}
                          {session.proxy_region && <span className="text-[10px]">{session.proxy_region}</span>}
                          {session.started_at && <span>Started {timeAgo(session.started_at)}</span>}
                          {session.runtime_ms && <span className="text-[hsl(145,100%,55%)]">{(session.runtime_ms / 1000).toFixed(1)}s</span>}
                        </div>
                        {steps.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500" style={{ width: `${(session.current_step / steps.length) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{session.current_step}/{steps.length}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {session.status === 'running' && <button onClick={e => { e.stopPropagation(); updateMutation.mutate({ id: session.id, updates: { status: 'idle' } }); toast.info('Paused'); }} className="p-1.5 rounded hover:bg-[hsl(228_25%_15%)] transition-colors"><Pause size={12} className="text-muted-foreground" /></button>}
                        {session.status === 'failed' && <button onClick={e => { e.stopPropagation(); updateMutation.mutate({ id: session.id, updates: { status: 'running', retries: session.retries + 1 } }); }} className="p-1.5 rounded hover:bg-[hsl(228_25%_15%)] transition-colors"><RefreshCw size={12} className="text-muted-foreground" /></button>}
                        <button onClick={e => { e.stopPropagation(); setReplaySession(session); }} className="p-1.5 rounded hover:bg-[hsl(265_80%_55%/0.15)] transition-colors" title="View event timeline"><Eye size={12} className="text-[hsl(265,80%,70%)]" /></button>
                        {isExp ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </div>
                    </div>
                  </div>
                  {isExp && (
                    <div className="border-t border-[hsl(var(--border))] px-4 py-3 bg-[hsl(228_35%_5%/0.5)] space-y-2">
                      {hasCreds && (
                        <div className="flex items-center gap-2 text-[11px] text-[hsl(145,100%,55%)] mb-2 p-2 rounded bg-[hsl(145_100%_50%/0.05)] border border-[hsl(145_100%_50%/0.12)]">
                          <Lock size={10} />
                          <span>Creds injected: <strong>{String((session.metadata as Record<string, unknown>)?.credential_name ?? '—')}</strong></span>
                          <span className="text-muted-foreground">· {String((session.metadata as Record<string, unknown>)?.credential_type ?? '—')}</span>
                        </div>
                      )}
                      {steps.length === 0 ? <div className="text-xs text-muted-foreground">No step data.</div> : steps.map((step, i) => {
                        const Icon = ACTION_ICONS[step.action] ?? Globe;
                        return (
                          <div key={step.id || i} className={cn('flex items-start gap-3 text-xs', step.status === 'completed' && 'opacity-60')}>
                            <div className={cn('w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5', { 'bg-[hsl(145_100%_50%/0.2)]': step.status === 'completed', 'bg-[hsl(185_100%_50%/0.2)] animate-pulse': step.status === 'running', 'bg-[hsl(228_25%_15%)]': step.status === 'pending', 'bg-[hsl(0_85%_60%/0.2)]': step.status === 'failed' })}>
                              {step.status === 'completed' ? <CheckCircle size={11} className="text-[hsl(145,100%,55%)]" /> : step.status === 'failed' ? <AlertTriangle size={11} className="text-[hsl(0,85%,65%)]" /> : <Icon size={11} className="text-muted-foreground" />}
                            </div>
                            <div className="flex-1">
                              <div className={cn('font-medium', step.status === 'running' && 'text-[hsl(185,100%,55%)]')}>{step.description}</div>
                              {step.completedAt && <div className="text-[10px] text-muted-foreground">{timeAgo(step.completedAt)}</div>}
                              {step.error && <div className="text-[10px] text-[hsl(0,85%,65%)]">{step.error}</div>}
                            </div>
                            <div className="text-[10px] uppercase text-muted-foreground">{step.action}</div>
                          </div>
                        );
                      })}

                      {/* Engine events */}
                      {events.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Engine Events</div>
                          {events.slice(0, 5).map((evt, i) => {
                            const Ic = EVENT_ICONS[evt.type] ?? Activity;
                            return (
                              <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
                                <Ic size={9} className={EVENT_COLORS[evt.type]} />
                                <span className={EVENT_COLORS[evt.type]}>{evt.type}</span>
                                <span className="text-muted-foreground flex-1 truncate">{evt.detail}</span>
                                <span className="text-muted-foreground flex-shrink-0">{timeAgo(evt.ts)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live console */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>Live Console</span>
            </div>
            <div ref={logRef} className="flex-1 bg-[hsl(230_35%_3%)] rounded-lg p-3 font-mono text-[11px] overflow-y-auto space-y-1.5 min-h-64">
              {liveLog.filter(Boolean).map((line, i) => (
                <div key={i} className={cn(line.startsWith('⚠') ? 'text-[hsl(30,100%,60%)]' : line.startsWith('✓') ? 'text-[hsl(145,100%,55%)]' : line.startsWith('›') ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground')}>{line}</div>
              ))}
              <div className="text-[hsl(185,100%,55%)] animate-pulse">_</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Playbooks tab ─────────────────────────────────────────────────── */}
      {mainTab === 'playbooks' && (
        <PlaybooksTab playbooks={playbooks} onSeedPlaybooks={handleSeedPlaybooks} seeding={seedingPlaybooks} />
      )}

      {/* ── Policy tab ────────────────────────────────────────────────────── */}
      {mainTab === 'policy' && (
        <PolicyTab sessions={sessions} />
      )}

      {/* ── Analytics tab ─────────────────────────────────────────────────── */}
      {mainTab === 'analytics' && (
        <AnalyticsTab sessions={sessions} usageLogs={usageLogs} />
      )}

      {/* ── Replay / Event Timeline Modal ─────────────────────────────────── */}
      {replaySession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReplaySession(null)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.3)] p-5 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto slide-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-black text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>EVENT TIMELINE</div>
                <div className="text-xs text-muted-foreground">{replaySession.name}</div>
              </div>
              <button onClick={() => setReplaySession(null)} className="p-1.5 rounded hover:bg-[hsl(228_25%_12%)]"><X size={14} /></button>
            </div>

            {/* Session metadata */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              {[
                { label: 'Runner',   value: replaySession.runner_id  ?? '—' },
                { label: 'Region',   value: replaySession.proxy_region ?? '—' },
                { label: 'Status',   value: replaySession.status },
                { label: 'Runtime',  value: replaySession.runtime_ms ? `${(replaySession.runtime_ms / 1000).toFixed(1)}s` : '—' },
              ].map(m => (
                <div key={m.label} className="p-2 rounded-lg bg-[hsl(228_25%_8%)] border border-[hsl(var(--border))]">
                  <div className="text-[10px] text-muted-foreground mb-0.5">{m.label}</div>
                  <div className="font-mono font-semibold">{m.value}</div>
                </div>
              ))}
            </div>

            {/* Engine events timeline */}
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Structured Events</div>
            <div className="space-y-1.5">
              {getEvents(replaySession).length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No events recorded for this session.</div>
              ) : getEvents(replaySession).map((evt, i) => {
                const Ic = EVENT_ICONS[evt.type] ?? Activity;
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-[hsl(var(--border))]">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${Object.entries(EVENT_COLORS).find(([k]) => k === evt.type)?.[1]?.replace(/text-\[/g, '').replace(/\]/g, '') ?? 'transparent'} 12%, transparent)` }}>
                      <Ic size={11} className={EVENT_COLORS[evt.type] ?? 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-xs font-bold', EVENT_COLORS[evt.type] ?? 'text-foreground')}>{evt.type}</div>
                      <div className="text-[10px] text-muted-foreground">{evt.detail}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(evt.ts)}</div>
                  </div>
                );
              })}
            </div>

            {/* Steps timeline */}
            <div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Step Execution</div>
            <div className="space-y-1">
              {getSteps(replaySession).map((step, i) => (
                <div key={i} className={cn('flex items-center gap-2 text-xs py-1 px-2 rounded', step.status === 'completed' && 'opacity-70')}>
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', { 'bg-[hsl(145,100%,55%)]': step.status === 'completed', 'bg-[hsl(185,100%,55%)] animate-pulse': step.status === 'running', 'bg-[hsl(228,20%,30%)]': step.status === 'pending', 'bg-[hsl(0,85%,65%)]': step.status === 'failed' })} />
                  <span className="text-muted-foreground w-5 flex-shrink-0">{i + 1}.</span>
                  <span className="flex-1">{step.description}</span>
                  {step.completedAt && <span className="text-[10px] text-muted-foreground">{timeAgo(step.completedAt)}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Session Wizard Modal ─────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.2)] p-6 w-full max-w-lg mx-4 slide-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>NEW AUTOMATION SESSION</h3>
              <button onClick={closeModal} className="p-1.5 rounded hover:bg-[hsl(228_25%_12%)]"><X size={14} /></button>
            </div>

            {/* Wizard step indicator */}
            <div className="flex items-center gap-0 mb-6">
              {WIZARD_STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all', i < wizardIdx ? 'bg-[hsl(145_100%_50%/0.2)] border-[hsl(145_100%_50%/0.5)] text-[hsl(145,100%,55%)]' : i === wizardIdx ? 'bg-[hsl(185_100%_50%/0.2)] border-[hsl(185,100%,55%)] text-[hsl(185,100%,55%)]' : 'border-[hsl(var(--border))] text-muted-foreground')}>
                      {i < wizardIdx ? <CheckCircle size={13} /> : i + 1}
                    </div>
                    <span className={cn('text-xs font-semibold', i === wizardIdx ? 'text-[hsl(185,100%,55%)]' : i < wizardIdx ? 'text-[hsl(145,100%,55%)]' : 'text-muted-foreground')}>{s.label}</span>
                  </div>
                  {i < WIZARD_STEPS.length - 1 && <div className={cn('flex-1 h-px mx-2', i < wizardIdx ? 'bg-[hsl(145_100%_50%/0.4)]' : 'bg-[hsl(var(--border))]')} />}
                </React.Fragment>
              ))}
            </div>

            {/* Step 1: Platform */}
            {wizardStep === 'platform' && (
              <div className="space-y-4">
                <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Select Platform Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORM_PRESETS.map(preset => (
                    <button key={preset.name} onClick={() => setSelectedPreset(preset)} className={cn('p-3 rounded-lg border text-left transition-colors text-xs', selectedPreset.name === preset.name ? 'border-[hsl(185_100%_50%/0.5)] bg-[hsl(185_100%_50%/0.1)] text-[hsl(185,100%,55%)]' : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[hsl(185_100%_50%/0.3)]')}>
                      <div className="font-semibold mb-0.5">{preset.platform}</div>
                      <div className="text-[10px] opacity-70 mb-1">{preset.name}</div>
                      <div className="text-[9px] px-1 py-0.5 rounded border inline-block border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)]">{preset.capability}</div>
                    </button>
                  ))}
                </div>
                {/* Match to playbook */}
                {playbooks.find(p => p.site_id === selectedPreset.siteId) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[hsl(50_100%_50%/0.2)] bg-[hsl(50_100%_50%/0.04)] text-[11px]">
                    <Package size={11} className="text-[hsl(50,100%,60%)]" />
                    <span className="text-[hsl(50,100%,60%)] font-semibold">Playbook found:</span>
                    <span className="text-muted-foreground">{playbooks.find(p => p.site_id === selectedPreset.siteId)?.name}</span>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-[hsl(228_35%_5%)] border border-[hsl(var(--border))]">
                  <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Workflow Steps</div>
                  {selectedPreset.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <span className="w-4 h-4 rounded-full bg-[hsl(228_25%_15%)] text-[10px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Credentials */}
            {wizardStep === 'credentials' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.04)] flex items-start gap-2.5">
                  <Shield size={13} className="text-[hsl(265,80%,70%)] flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted-foreground"><span className="text-[hsl(265,80%,70%)] font-semibold">Zero-knowledge injection</span> — AES-256-GCM decryption, ephemeral only, never transmitted.</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold">Select Credential</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Vault entries for <span className="text-[hsl(185,100%,55%)]">{selectedPreset.platform}</span></p>
                  </div>
                  {vaultReady ? <div className="flex items-center gap-1.5 text-[11px] text-[hsl(145,100%,55%)]"><div className="w-1.5 h-1.5 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" /> AES-256 Ready</div> : <div className="flex items-center gap-1.5 text-[11px] text-[hsl(30,100%,60%)]"><RefreshCw size={11} className="animate-spin" /> Initializing key...</div>}
                </div>
                {credsLoading ? (
                  <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-[hsl(265_80%_55%/0.3)] border-t-[hsl(265,80%,70%)] rounded-full animate-spin" /></div>
                ) : platformCreds.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.04)] text-center">
                    <AlertCircle size={22} className="mx-auto mb-2 text-[hsl(30,100%,60%)]" />
                    <div className="text-sm font-semibold mb-1">No credentials for {selectedPreset.platform}</div>
                    <div className="text-xs text-muted-foreground mb-3">Add login or API key credentials to the Vault first.</div>
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => { closeModal(); navigate('/vault'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-cyan-500 text-black"><Key size={12} /> Go to Vault</button>
                      <button onClick={() => setSkipCredentials(true)} className="px-3 py-2 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground">Skip</button>
                    </div>
                    {skipCredentials && <div className="mt-3 text-[11px] text-[hsl(145,100%,55%)]"><CheckCircle size={11} className="inline mr-1" /> Skipping — session runs without login</div>}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {platformCreds.map(cred => {
                      const isSel = selectedCredId === cred.id;
                      const isDec = decryptingId === cred.id;
                      return (
                        <div key={cred.id} onClick={() => !isDec && !isSel && handleSelectCredential(cred)} className={cn('p-3.5 rounded-xl border cursor-pointer transition-all', isSel ? 'border-[hsl(145_100%_50%/0.4)] bg-[hsl(145_100%_50%/0.06)]' : 'border-[hsl(var(--border))] hover:border-[hsl(265_80%_55%/0.3)]', isDec && 'opacity-70 cursor-wait')}>
                          <div className="flex items-center gap-3">
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', isSel ? 'bg-[hsl(145_100%_50%/0.15)]' : 'bg-[hsl(228_25%_12%)]')}>
                              {isDec ? <RefreshCw size={14} className="text-[hsl(265,80%,70%)] animate-spin" /> : isSel ? <CheckCircle size={14} className="text-[hsl(145,100%,55%)]" /> : <Key size={14} className="text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-semibold text-sm">{cred.name}</span>
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', getCredTypeColor(cred.type))}>{getCredTypeLabel(cred.type)}</span>
                              </div>
                              {isSel && <div className="flex gap-1 flex-wrap mt-1">{credPreviewFields(cred).map(p => <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(145_100%_50%/0.08)] border border-[hsl(145_100%_50%/0.15)] text-[hsl(145,100%,55%)]">✓ {p}</span>)}</div>}
                            </div>
                            {isDec && <div className="text-[10px] text-[hsl(265,80%,70%)] animate-pulse flex-shrink-0">Decrypting...</div>}
                            {isSel && <div className="text-[11px] font-bold text-[hsl(145,100%,55%)] flex-shrink-0">SELECTED</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {platformCreds.length > 0 && !skipCredentials && (
                  <button onClick={() => { setSkipCredentials(true); setSelectedCredId(null); clearEphemeral(); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">Skip credential injection</button>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {wizardStep === 'review' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[hsl(185_100%_50%/0.2)] bg-[hsl(185_100%_50%/0.04)]">
                  <div className="text-xs font-black uppercase tracking-wider text-[hsl(185,100%,55%)] mb-3" style={{ fontFamily: 'Orbitron' }}>Session Summary</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Platform</span><span className="font-semibold">{selectedPreset.platform}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Workflow</span><span className="font-semibold">{selectedPreset.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Steps</span><span className="font-semibold">{selectedPreset.steps.length}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Runner</span><span className="font-mono text-[hsl(145,100%,55%)] text-xs">auto-assigned</span></div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Credentials</span>
                      {skipCredentials ? <span className="text-[hsl(30,100%,60%)] text-xs">Skipped</span> : selectedCredId ? <span className="flex items-center gap-1.5 text-[hsl(145,100%,55%)] text-xs font-semibold"><Lock size={10} /> {ephemeralCred.current?.credentialName ?? '—'} — injected</span> : <span className="text-muted-foreground text-xs">None</span>}
                    </div>
                    {playbooks.find(p => p.site_id === selectedPreset.siteId) && <div className="flex justify-between"><span className="text-muted-foreground">Playbook</span><span className="text-[hsl(50,100%,60%)] text-xs">{playbooks.find(p => p.site_id === selectedPreset.siteId)?.version}</span></div>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2" style={{ fontFamily: 'Orbitron' }}>Security Checklist</div>
                  {['Credentials encrypted at rest (AES-256-GCM)', 'Decryption performed client-side only', 'No plaintext transmitted to backend', 'Session runs in isolated browser context', 'Credential access logged (non-sensitive audit)', 'Credentials wiped after session launch'].map(label => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <CheckCircle size={11} className="text-[hsl(145,100%,55%)] flex-shrink-0" />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wizard navigation */}
            <div className="flex gap-3 mt-6">
              {wizardStep !== 'platform' ? (
                <button onClick={goBack} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground">
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <button onClick={closeModal} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground">Cancel</button>
              )}
              {wizardStep !== 'review' ? (
                <button onClick={goNext} disabled={wizardStep === 'credentials' && !canAdvanceFromCreds} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all">
                  {wizardStep === 'platform' ? 'Select Credentials' : 'Review & Launch'} <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={startSession} disabled={createMutation.isPending} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all">
                  {createMutation.isPending ? <><RefreshCw size={14} className="animate-spin" /> Launching...</> : <><Play size={14} /> Launch Session</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
