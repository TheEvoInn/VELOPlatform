/**
 * VELO 2.0 — Internal AI Runtime Panel
 *
 * Shows the status of all AI tiers and allows configuration
 * of the remote Ollama endpoint. This is the "internal AI runtime"
 * control center — no user installation of any software required
 * unless they want to run a remote Ollama server.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Cloud, Layers, CheckCircle, AlertTriangle, RefreshCw,
  Settings2, ChevronRight, Zap, Server, Globe, ExternalLink,
  Copy, Eye, EyeOff, Info, Radio, Wifi, WifiOff,
  Activity, BarChart3, FileText, Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { checkOllamaHealth, getRouterState, setAIMode, resetCloudStatus } from '@/lib/aiRouter';
import { useAIRouter } from '@/hooks/useAIRouter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime tier status
// ─────────────────────────────────────────────────────────────────────────────
interface TierStatus {
  available: boolean;
  label: string;
  detail: string;
  loading: boolean;
}

interface RuntimeStatus {
  cloud:    TierStatus;
  ollama:   TierStatus;  // remote Ollama via backend secret
  local:    TierStatus;  // localhost:11434
  template: TierStatus;  // always available
  activeTier: 'cloud' | 'ollama' | 'local' | 'template';
  checked: boolean;
}

export default function AIRuntimePanel() {
  const router = useAIRouter();
  const [status, setStatus] = useState<RuntimeStatus>({
    cloud:    { available: false, label: 'Cloud AI', detail: 'Checking...', loading: true },
    ollama:   { available: false, label: 'Remote Ollama', detail: 'Checking...', loading: true },
    local:    { available: false, label: 'Local Ollama', detail: 'Checking...', loading: true },
    template: { available: true,  label: 'Template Engine', detail: 'Built-in — always available', loading: false },
    activeTier: 'template',
    checked: false,
  });
  const [checking, setChecking] = useState(false);
  const [ollamaEndpoint, setOllamaEndpoint] = useState('');
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'setup' | 'stats'>('status');

  const checkAllTiers = useCallback(async () => {
    setChecking(true);

    // Check local Ollama
    const localOk = await checkOllamaHealth();

    // Check backend runtime (cloud + remote Ollama)
    let backendStatus = { cloud: false, ollama: false, ollamaEndpointSet: false };
    try {
      const { data, error } = await supabase.functions.invoke('ai-runtime', {
        body: { action: 'status' },
      });
      if (!error && data) {
        backendStatus = {
          cloud: data.tiers?.cloud?.available ?? false,
          ollama: data.tiers?.ollama?.available ?? false,
          ollamaEndpointSet: !!data.ollama_endpoint_set,
        };
      }
    } catch {
      // Backend unreachable
    }

    const activeTier =
      backendStatus.cloud ? 'cloud' :
      backendStatus.ollama ? 'ollama' :
      localOk ? 'local' :
      'template';

    setStatus({
      cloud: {
        available: backendStatus.cloud,
        label: 'Cloud AI (OnSpace)',
        detail: backendStatus.cloud ? 'Online · Gemini 3 Flash · Uses credits' : 'Offline or no credits',
        loading: false,
      },
      ollama: {
        available: backendStatus.ollama,
        label: 'Remote Ollama (Backend)',
        detail: backendStatus.ollamaEndpointSet
          ? (backendStatus.ollama ? 'Online · OLLAMA_ENDPOINT configured' : 'Endpoint set but unreachable')
          : 'OLLAMA_ENDPOINT not set — see Setup tab',
        loading: false,
      },
      local: {
        available: localOk,
        label: 'Local Ollama (Your Device)',
        detail: localOk
          ? `Online · ${getRouterState().availableModels.length} model(s) · localhost:11434`
          : 'Not running · Download ollama.com to use',
        loading: false,
      },
      template: {
        available: true,
        label: 'Template Engine (Built-in)',
        detail: 'Always available · Zero cost · Pattern-based responses',
        loading: false,
      },
      activeTier,
      checked: true,
    });
    setChecking(false);
  }, []);

  useEffect(() => { checkAllTiers(); }, [checkAllTiers]);

  const saveOllamaEndpoint = async () => {
    if (!ollamaEndpoint.trim()) {
      toast.error('Please enter a valid endpoint URL');
      return;
    }
    setSavingEndpoint(true);
    try {
      // Note: In a real deployment, this would update the backend secret via admin API.
      // For now, we store in localStorage and use it for local routing hints.
      localStorage.setItem('velo_remote_ollama_endpoint', ollamaEndpoint.trim());
      toast.success('Remote Ollama endpoint saved', {
        description: 'Set OLLAMA_ENDPOINT in your OnSpace Cloud Secrets for backend use',
      });
      await checkAllTiers();
    } finally {
      setSavingEndpoint(false);
    }
  };

  const TIERS = [
    {
      key: 'cloud' as const,
      icon: Cloud,
      color: 'hsl(265,80%,70%)',
      bgColor: 'hsl(265_80%_55%/0.1)',
      borderColor: 'hsl(265_80%_55%/0.25)',
      priority: 'Primary',
      cost: 'Uses credits',
    },
    {
      key: 'ollama' as const,
      icon: Server,
      color: 'hsl(185,100%,55%)',
      bgColor: 'hsl(185_100%_50%/0.1)',
      borderColor: 'hsl(185_100%_50%/0.2)',
      priority: 'Secondary',
      cost: 'Free (self-hosted)',
    },
    {
      key: 'local' as const,
      icon: Cpu,
      color: 'hsl(30,100%,60%)',
      bgColor: 'hsl(30_100%_55%/0.1)',
      borderColor: 'hsl(30_100%_55%/0.2)',
      priority: 'Tertiary',
      cost: 'Free (local device)',
    },
    {
      key: 'template' as const,
      icon: FileText,
      color: 'hsl(145,100%,55%)',
      bgColor: 'hsl(145_100%_50%/0.1)',
      borderColor: 'hsl(145_100%_50%/0.2)',
      priority: 'Fallback',
      cost: 'Free (built-in)',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>
            VELO INTERNAL AI RUNTIME
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            4-tier AI system · No paid API required · Always operational
          </div>
        </div>
        <button
          onClick={checkAllTiers}
          disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-[10px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={10} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {/* Active tier indicator */}
      {status.checked && (
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-xl border',
          status.activeTier === 'cloud'    ? 'border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.06)]' :
          status.activeTier === 'ollama'   ? 'border-[hsl(185_100%_50%/0.3)] bg-[hsl(185_100%_50%/0.06)]' :
          status.activeTier === 'local'    ? 'border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.06)]' :
          'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.06)]'
        )}>
          <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse',
            status.activeTier === 'cloud'  ? 'bg-[hsl(265,80%,70%)]' :
            status.activeTier === 'ollama' ? 'bg-[hsl(185,100%,55%)]' :
            status.activeTier === 'local'  ? 'bg-[hsl(30,100%,60%)]' :
            'bg-[hsl(145,100%,55%)]'
          )} />
          <div>
            <div className="text-xs font-bold">
              Active Runtime: <span className={
                status.activeTier === 'cloud'  ? 'text-[hsl(265,80%,70%)]' :
                status.activeTier === 'ollama' ? 'text-[hsl(185,100%,55%)]' :
                status.activeTier === 'local'  ? 'text-[hsl(30,100%,60%)]' :
                'text-[hsl(145,100%,55%)]'
              }>{status[status.activeTier].label}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {status[status.activeTier].detail}
            </div>
          </div>
          <div className="ml-auto text-[10px] text-muted-foreground">
            Auto-selected
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 p-0.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(228_25%_8%)] w-fit">
        {(['status', 'setup', 'stats'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors',
              activeTab === t
                ? 'bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-[hsl(185,100%,55%)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
            style={{ fontFamily: 'Orbitron' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── STATUS TAB ── */}
      {activeTab === 'status' && (
        <div className="space-y-3">
          {TIERS.map((tier, idx) => {
            const tierStatus = status[tier.key];
            const Icon = tier.icon;
            const isActive = status.activeTier === tier.key;

            return (
              <div
                key={tier.key}
                className={cn(
                  'glass-panel rounded-xl border p-4 transition-all',
                  isActive
                    ? `border-[${tier.borderColor}] shadow-[0_0_20px_-8px_${tier.color}/0.3]`
                    : 'border-[hsl(var(--border))]',
                  !tierStatus.available && !isActive && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
                    style={{
                      background: `color-mix(in srgb, ${tier.color} 12%, transparent)`,
                      borderColor: `color-mix(in srgb, ${tier.color} 25%, transparent)`,
                    }}
                  >
                    <Icon size={18} style={{ color: tier.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold">{tierStatus.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold"
                        style={{
                          color: tier.color,
                          borderColor: `color-mix(in srgb, ${tier.color} 30%, transparent)`,
                          background: `color-mix(in srgb, ${tier.color} 10%, transparent)`,
                        }}
                      >
                        {tier.priority}
                      </span>
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(145_100%_50%/0.12)] border border-[hsl(145_100%_50%/0.25)] text-[hsl(145,100%,55%)] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{tierStatus.detail}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] text-muted-foreground">{tier.cost}</span>
                    {tierStatus.loading
                      ? <RefreshCw size={14} className="animate-spin text-muted-foreground" />
                      : tierStatus.available
                      ? <CheckCircle size={14} className="text-[hsl(145,100%,55%)]" />
                      : <AlertTriangle size={14} className="text-muted-foreground" />}
                  </div>
                </div>

                {/* Priority chain arrow */}
                {idx < TIERS.length - 1 && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[hsl(var(--border)/0.5)]">
                    <div className="text-[9px] text-muted-foreground">
                      {tierStatus.available ? '✓ Used — no fallback needed' : '✗ Unavailable → falls through to next tier'}
                    </div>
                    {!tierStatus.available && (
                      <ChevronRight size={10} className="text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Flow diagram */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>
              Auto-Routing Flow
            </div>
            <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono">
              {[
                { label: 'Cloud AI', color: 'hsl(265,80%,70%)', available: status.cloud.available },
                { label: '→' },
                { label: 'Remote Ollama', color: 'hsl(185,100%,55%)', available: status.ollama.available },
                { label: '→' },
                { label: 'Local Ollama', color: 'hsl(30,100%,60%)', available: status.local.available },
                { label: '→' },
                { label: 'Templates', color: 'hsl(145,100%,55%)', available: true },
              ].map((item, i) =>
                'label' in item && item.color ? (
                  <span
                    key={i}
                    className="px-2 py-1 rounded border"
                    style={{
                      color: item.color,
                      borderColor: `color-mix(in srgb, ${item.color} 30%, transparent)`,
                      background: `color-mix(in srgb, ${item.color} ${item.available ? '15' : '5'}%, transparent)`,
                      opacity: item.available ? 1 : 0.5,
                    }}
                  >
                    {item.label}
                    {item.available && <span className="ml-1">●</span>}
                  </span>
                ) : (
                  <span key={i} className="text-muted-foreground">{item.label}</span>
                )
              )}
            </div>
            <div className="text-[9px] text-muted-foreground mt-2">
              Each tier auto-activates when higher tiers are unavailable. Templates always work — zero cost, zero dependencies.
            </div>
          </div>
        </div>
      )}

      {/* ── SETUP TAB ── */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          {/* Remote Ollama config */}
          <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.2)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server size={16} className="text-[hsl(185,100%,55%)]" />
              <div>
                <div className="text-sm font-bold text-[hsl(185,100%,55%)]">Remote Ollama Backend</div>
                <div className="text-[10px] text-muted-foreground">Run Ollama on any VPS — VELO connects automatically</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">
                  OLLAMA_ENDPOINT (set in OnSpace Cloud Secrets)
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showEndpoint ? 'text' : 'password'}
                      className="w-full px-3 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] font-mono"
                      placeholder="http://your-vps-ip:11434"
                      value={ollamaEndpoint}
                      onChange={e => setOllamaEndpoint(e.target.value)}
                    />
                    <button onClick={() => setShowEndpoint(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showEndpoint ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    onClick={saveOllamaEndpoint}
                    disabled={savingEndpoint || !ollamaEndpoint.trim()}
                    className="px-3 py-2 rounded-lg text-[10px] font-bold bg-[hsl(185_100%_50%/0.15)] border border-[hsl(185_100%_50%/0.3)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.25)] disabled:opacity-50"
                  >
                    {savingEndpoint ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>

              {/* Step-by-step VPS setup */}
              <div className="p-3 rounded-lg bg-[hsl(228_25%_8%)] border border-[hsl(var(--border))]">
                <div className="text-[10px] font-bold text-[hsl(185,100%,55%)] mb-2">
                  FREE SETUP: Run Ollama on any VPS (2 minutes)
                </div>
                <div className="space-y-2">
                  {[
                    { n: '1', cmd: 'curl -fsSL https://ollama.com/install.sh | sh', label: 'Install Ollama on your VPS' },
                    { n: '2', cmd: 'OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=* ollama serve &', label: 'Start Ollama with CORS enabled' },
                    { n: '3', cmd: 'ollama pull phi3:mini', label: 'Pull a free model (1.7GB)' },
                    { n: '4', cmd: 'http://your-vps-ip:11434', label: 'Enter this as your OLLAMA_ENDPOINT above' },
                  ].map(s => (
                    <div key={s.n} className="flex gap-2 text-[10px]">
                      <div className="w-4 h-4 rounded-full bg-[hsl(185_100%_50%/0.15)] border border-[hsl(185_100%_50%/0.3)] text-[hsl(185,100%,55%)] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                        {s.n}
                      </div>
                      <div>
                        <div className="text-muted-foreground">{s.label}</div>
                        <code className="text-[9px] text-[hsl(145,100%,55%)] font-mono">{s.cmd}</code>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[hsl(var(--border)/0.5)] text-[9px] text-muted-foreground">
                  Cheapest option: Oracle Cloud Free Tier, Google Cloud e2-micro, or any $4/mo VPS. Requires 4GB+ RAM.
                </div>
              </div>
            </div>
          </div>

          {/* Backend secrets instruction */}
          <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.2)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-[hsl(265,80%,70%)]" />
              <div>
                <div className="text-sm font-bold text-[hsl(265,80%,70%)]">Set Backend Secret</div>
                <div className="text-[10px] text-muted-foreground">For server-side Ollama routing</div>
              </div>
            </div>
            <div className="space-y-2 text-[10px] text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-[hsl(265,80%,70%)] font-bold mt-0.5">1.</span>
                <span>Click <strong className="text-foreground">Cloud</strong> in the top-right toolbar</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[hsl(265,80%,70%)] font-bold mt-0.5">2.</span>
                <span>Go to <strong className="text-foreground">Secrets</strong> tab</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[hsl(265,80%,70%)] font-bold mt-0.5">3.</span>
                <span>Add secret: <code className="text-[hsl(145,100%,55%)] font-mono">OLLAMA_ENDPOINT</code> = your VPS URL</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[hsl(265,80%,70%)] font-bold mt-0.5">4.</span>
                <span>VELO's backend will automatically route to your Ollama server</span>
              </div>
            </div>
          </div>

          {/* No-install option: always-on template engine */}
          <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.2)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={15} className="text-[hsl(145,100%,55%)]" />
              <div className="text-sm font-bold text-[hsl(145,100%,55%)]">Template Engine — Zero Setup</div>
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              VELO's built-in template engine handles all common generation tasks (bios, cover letters, proposals, code fixes) without any AI model. It's always active as the final fallback — the platform <strong className="text-foreground">never stops working</strong>.
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[hsl(145,100%,55%)]">
              <CheckCircle size={11} />
              <span>Always online · Zero cost · Zero setup · Zero credits required</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS TAB ── */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Requests',   value: router.totalRequests,   color: 'hsl(185,100%,55%)' },
              { label: 'Cloud Requests',   value: router.cloudRequests,   color: 'hsl(265,80%,70%)' },
              { label: 'Local Requests',   value: router.localRequests,   color: 'hsl(30,100%,60%)' },
              { label: 'Cached',           value: router.cachedRequests,  color: 'hsl(145,100%,55%)' },
            ].map(stat => (
              <div key={stat.label} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-3">
                <div className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Cost savings estimate */}
          {router.localRequests > 0 && (
            <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.2)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={14} className="text-[hsl(145,100%,55%)]" />
                <span className="text-xs font-bold text-[hsl(145,100%,55%)]">Estimated Savings</span>
              </div>
              <div className="text-2xl font-black font-mono text-[hsl(145,100%,55%)]">
                ${(router.localRequests * 0.002 + router.cachedRequests * 0.001).toFixed(3)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {router.localRequests} local + {router.cachedRequests} cached requests avoided cloud costs
              </div>
            </div>
          )}

          {/* Mode selector */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>
              AI Mode
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'hybrid', label: 'Hybrid', desc: 'Cloud → Local fallback', color: 'hsl(265,80%,70%)' },
                { id: 'local',  label: 'Local Only', desc: 'Ollama only, no cloud', color: 'hsl(185,100%,55%)' },
                { id: 'cloud',  label: 'Cloud Only', desc: 'Always use credits', color: 'hsl(50,100%,60%)' },
                { id: 'cost_optimized', label: 'Cost Optimized', desc: 'Smart cloud/local split', color: 'hsl(145,100%,55%)' },
              ] as const).map(m => (
                <button
                  key={m.id}
                  onClick={() => { setAIMode(m.id); if (m.id === 'cloud') resetCloudStatus(); toast.success(`AI mode: ${m.label}`); }}
                  className={cn(
                    'p-2.5 rounded-lg border text-left transition-all',
                    router.mode === m.id
                      ? 'border-current bg-[color-mix(in_srgb,currentColor_10%,transparent)]'
                      : 'border-[hsl(var(--border))] hover:border-current hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)]'
                  )}
                  style={{ color: m.color }}
                >
                  <div className="text-[11px] font-bold">{m.label}</div>
                  <div className="text-[9px] opacity-70 text-current mt-0.5">{m.desc}</div>
                  {router.mode === m.id && (
                    <div className="text-[8px] mt-1 flex items-center gap-1 opacity-80">
                      <CheckCircle size={8} /> Active
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
