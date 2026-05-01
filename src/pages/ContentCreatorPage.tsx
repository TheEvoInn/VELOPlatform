import React, { useState, useEffect } from 'react';
import { Cpu, Sparkles, Copy, Check, RefreshCw, FileText, MessageSquare, Package, Bitcoin, Search, Mail, User, AlertTriangle, Shield } from 'lucide-react';
import { generateAIContent, getAutopilotsFromDB, getUserIdentity, type UserIdentity } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const CONTENT_TYPES = [
  { id: 'cover_letter',      label: 'Cover Letter',       icon: FileText,       desc: 'Personalized application letter' },
  { id: 'resume',            label: 'Resume/Profile',     icon: FileText,       desc: 'Targeted professional resume' },
  { id: 'bio',               label: 'Professional Bio',   icon: User,           desc: 'Platform profile bio' },
  { id: 'message',           label: 'Client Message',     icon: MessageSquare,  desc: 'Professional communication' },
  { id: 'email',             label: 'Email',              icon: Mail,           desc: 'Professional email draft' },
  { id: 'product_description',label: 'Product Description',icon: Package,       desc: 'E-commerce product copy' },
  { id: 'crypto_submission', label: 'Crypto Submission',  icon: Bitcoin,        desc: 'Task completion report' },
  { id: 'research_summary',  label: 'Research Summary',   icon: Search,         desc: 'Market research digest' },
];

interface Autopilot {
  id: string;
  name: string;
  avatar?: string;
  persona?: string;
  tone?: string;
  behavior_rules?: string[];
}

export default function ContentCreatorPage() {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState(CONTENT_TYPES[0]);
  const [autopilots, setAutopilots] = useState<Autopilot[]>([]);
  const [selectedAutopilot, setSelectedAutopilot] = useState<string>('');
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Array<{ type: string; output: string; ts: string }>>([]);

  // Context fields
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  useEffect(() => {
    Promise.all([getAutopilotsFromDB(), getUserIdentity()]).then(([{ data: aps }, { data: id }]) => {
      if (aps?.length) {
        setAutopilots(aps as Autopilot[]);
        setSelectedAutopilot(aps[0].id);
      }
      if (id) setIdentity(id);
    });
  }, []);

  const identityReady = identity?.consent_given && (identity?.completeness_score ?? 0) >= 30;

  const generate = async () => {
    if (!title.trim()) { toast.error('Enter a title or topic'); return; }
    setGenerating(true);
    setOutput('');

    const ap = autopilots.find(a => a.id === selectedAutopilot);

    // Prefer real identity over autopilot persona for name/bio
    const identityForGeneration = identity?.full_name || identity?.display_name ? {
      name: identity?.display_name || identity?.full_name || ap?.name || 'Professional',
      persona: identity?.bio || ap?.persona || 'Experienced professional',
      tone: ap?.tone || 'professional',
      style: 'Concise & Direct',
      rules: ap?.behavior_rules || [],
    } : ap ? {
      name: ap.name,
      persona: ap.persona || 'Professional AI assistant',
      tone: ap.tone || 'professional',
      style: 'Concise & Direct',
      rules: ap.behavior_rules || [],
    } : undefined;

    const context: Record<string, unknown> = {
      title,
      platform,
      description,
      requirements: requirements.split(',').map(r => r.trim()).filter(Boolean),
      estimatedValue: parseFloat(estimatedValue) || 0,
      currency: 'USD',
      // Inject real identity context
      user_name: identity?.full_name || identity?.display_name,
      user_email: identity?.email,
      user_headline: identity?.headline,
      user_skills: identity?.skills,
      user_years_experience: identity?.years_experience,
      user_location: identity?.location_country,
      user_portfolio: identity?.portfolio_url,
      user_linkedin: identity?.linkedin_url,
    };

    const { text, error } = await generateAIContent({
      content_type: activeType.id as Parameters<typeof generateAIContent>[0]['content_type'],
      context,
      identity: identityForGeneration,
      autopilot_id: selectedAutopilot || undefined,
    });

    if (error) {
      toast.error('Generation failed: ' + error);
    } else if (text) {
      setOutput(text);
      setHistory(h => [{ type: activeType.label, output: text, ts: new Date().toISOString() }, ...h.slice(0, 9)]);
      toast.success(`${activeType.label} generated successfully!`);
    }
    setGenerating(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 slide-in-up">
      {/* Header */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.2)] p-4 flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <Cpu size={18} className="text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-neon-violet" style={{ fontFamily: 'Orbitron' }}>CONTENT CREATOR AI</div>
          <div className="text-xs text-muted-foreground">Powered by Gemini 3 Flash · Uses your real identity · All output persona-matched</div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Identity status */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs',
            identityReady
              ? 'bg-[hsl(145_100%_50%/0.08)] border-[hsl(145_100%_50%/0.2)] text-[hsl(145,100%,55%)]'
              : 'bg-[hsl(30_100%_55%/0.08)] border-[hsl(30_100%_55%/0.2)] text-[hsl(30,100%,60%)]'
          )}>
            {identityReady
              ? <><Shield size={11} /> Identity Active</>
              : <><AlertTriangle size={11} /> <button onClick={() => navigate('/identity')} className="underline">Set up Identity</button></>}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
            <span className="text-xs text-[hsl(145,100%,55%)] font-semibold">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Identity context panel — shown when identity is available */}
      {identity && identityReady && (
        <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.15)] p-3 flex items-center gap-3 flex-wrap">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
            {(identity.display_name || identity.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold">{identity.display_name || identity.full_name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {identity.headline || 'No headline'} · {(identity.skills || []).slice(0, 3).join(', ')}
            </div>
          </div>
          <span className="text-[10px] text-[hsl(265,80%,70%)] flex items-center gap-1">
            <Sparkles size={9} /> Grounding AI output with your verified profile
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: config */}
        <div className="space-y-4">
          {/* Content type */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>Content Type</div>
            <div className="space-y-1">
              {CONTENT_TYPES.map(ct => {
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.id}
                    onClick={() => { setActiveType(ct); setOutput(''); }}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors text-xs',
                      activeType.id === ct.id
                        ? 'bg-[hsl(265_80%_55%/0.12)] text-[hsl(265,80%,70%)] border border-[hsl(265_80%_55%/0.25)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(228_25%_10%)]'
                    )}
                  >
                    <Icon size={13} className="flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{ct.label}</div>
                      <div className="text-[10px] opacity-70">{ct.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Autopilot selector */}
          {autopilots.length > 0 && (
            <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2" style={{ fontFamily: 'Orbitron' }}>Autopilot Voice</div>
              <div className="space-y-1.5">
                {autopilots.map(ap => (
                  <button key={ap.id} onClick={() => setSelectedAutopilot(ap.id)}
                    className={cn('w-full flex items-center gap-2 p-2.5 rounded-lg text-xs text-left transition-colors',
                      selectedAutopilot === ap.id ? 'bg-[hsl(185_100%_50%/0.1)] border border-[hsl(185_100%_50%/0.25)] text-[hsl(185,100%,55%)]' : 'text-muted-foreground hover:bg-[hsl(228_25%_10%)]'
                    )}>
                    <span className="text-base">{ap.avatar || '🤖'}</span>
                    <div>
                      <div className="font-semibold">{ap.name}</div>
                      <div className="text-[10px] opacity-60 capitalize">{ap.tone || 'professional'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: context inputs */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4" style={{ fontFamily: 'Orbitron' }}>Context Input</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Title / Topic *</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="Job title, product name, topic..." value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Platform</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="Upwork, Shopify, Arbitrum..." value={platform} onChange={e => setPlatform(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Description / Brief</label>
                <textarea className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors resize-none h-24" placeholder="Describe the opportunity, task, or product..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Requirements (comma-separated)</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="React, SEO, ETH wallet..." value={requirements} onChange={e => setRequirements(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Estimated Value (USD)</label>
                <input type="number" className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="250" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} />
              </div>
            </div>
            <button
              onClick={generate}
              disabled={generating || !title}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {generating ? (
                <><RefreshCw size={15} className="animate-spin" /> Generating...</>
              ) : (
                <><Sparkles size={15} /> Generate {activeType.label}</>
              )}
            </button>
          </div>
        </div>

        {/* Right: output */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 min-h-64 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>
                Generated Output
              </div>
              {output && (
                <button onClick={copy} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check size={11} className="text-[hsl(145,100%,55%)]" /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {generating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-[hsl(265_80%_55%/0.3)] border-t-[hsl(265,80%,70%)] animate-spin" />
                  <div className="absolute inset-2 rounded-full border border-[hsl(185_100%_50%/0.3)] border-b-[hsl(185,100%,55%)] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <div className="text-xs text-muted-foreground">AI is crafting your content...</div>
                <div className="text-[10px] text-[hsl(265,80%,70%)]">Gemini 3 Flash · Identity-grounded</div>
              </div>
            ) : output ? (
              <div className="flex-1 overflow-y-auto">
                <pre className="text-sm leading-relaxed whitespace-pre-wrap text-foreground font-sans">{output}</pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                <Sparkles size={28} className="text-muted-foreground opacity-30" />
                <div className="text-sm text-muted-foreground">Fill in the context and generate</div>
                <div className="text-xs text-muted-foreground opacity-60">
                  {identityReady ? 'AI will use your verified identity profile' : 'Complete Identity Studio for better output'}
                </div>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2" style={{ fontFamily: 'Orbitron' }}>Recent Generations</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <button key={i} onClick={() => setOutput(h.output)} className="w-full text-left p-2 rounded-lg bg-[hsl(228_25%_10%)] hover:bg-[hsl(228_25%_12%)] transition-colors">
                    <div className="text-xs font-semibold text-muted-foreground">{h.type}</div>
                    <div className="text-[10px] text-muted-foreground opacity-60 line-clamp-1">{h.output.slice(0, 60)}...</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
