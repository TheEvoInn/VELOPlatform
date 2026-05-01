import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket, Shield, Cpu, FileText, Send, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, ChevronRight, X, Eye, Globe, Zap,
  Bot, Lock, ExternalLink, Copy, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/hooks/useSharedData';
import { cn } from '@/lib/utils';
import {
  runEligibilityCheck, generateAIContent, getAutopilotsFromDB,
  getUserIdentity, logIdentityAccess, type UserIdentity
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Opportunity {
  id: string;
  title: string;
  platform: string;
  category: string;
  estimated_value: number;
  currency: string;
  effort: string;
  requirements: string[];
  confidence: string;
  description?: string;
  url?: string;
}

interface ApplicationWorkflowProps {
  opportunity: Opportunity;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (taskId?: string) => void;
}

type StepId = 'eligibility' | 'terms' | 'assets' | 'preview' | 'submit' | 'done';

const WORKFLOW_STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: 'eligibility', label: 'Eligibility',  icon: Shield },
  { id: 'terms',       label: 'Terms Check',  icon: Globe },
  { id: 'assets',      label: 'AI Assets',    icon: Cpu },
  { id: 'preview',     label: 'Review',       icon: Eye },
  { id: 'submit',      label: 'Submit',       icon: Send },
  { id: 'done',        label: 'Confirmed',    icon: CheckCircle },
];

// Platform compliance database
const PLATFORM_RULES: Record<string, { automation: 'allowed' | 'restricted' | 'prohibited'; requires_id: boolean; notes: string }> = {
  upwork:       { automation: 'restricted', requires_id: true,  notes: 'Manual oversight required. Automated bidding may violate ToS.' },
  fiverr:       { automation: 'restricted', requires_id: false, notes: 'Automated account actions restricted. Human review recommended.' },
  clickworker:  { automation: 'allowed',    requires_id: false, notes: 'API-based task completion allowed.' },
  remotive:     { automation: 'allowed',    requires_id: false, notes: 'Job board scraping permitted.' },
  lever:        { automation: 'allowed',    requires_id: false, notes: 'Application API available.' },
  'scale ai':   { automation: 'allowed',    requires_id: false, notes: 'Worker API supported.' },
  arbitrum:     { automation: 'allowed',    requires_id: false, notes: 'Fully decentralized, automation permitted.' },
  linea:        { automation: 'allowed',    requires_id: false, notes: 'Blockchain protocols allow automation.' },
  'zksync':     { automation: 'allowed',    requires_id: false, notes: 'DeFi automation fully supported.' },
  freelancer:   { automation: 'restricted', requires_id: true,  notes: 'Limited automation; human review required for bids.' },
  toptal:       { automation: 'prohibited', requires_id: true,  notes: 'Strictly prohibits automated applications.' },
  'amazon mturk': { automation: 'allowed', requires_id: false, notes: 'Worker API available for task automation.' },
};

function getPlatformCompliance(platform: string) {
  const key = platform?.toLowerCase().trim();
  for (const [k, v] of Object.entries(PLATFORM_RULES)) {
    if (key?.includes(k)) return { platform: k, ...v };
  }
  return { platform: platform, automation: 'unknown' as const, requires_id: false, notes: 'Platform compliance unknown — proceed with caution.' };
}

export default function ApplicationWorkflow({ opportunity, isOpen, onClose, onSuccess }: ApplicationWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<StepId>('eligibility');
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());

  // Eligibility state
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<{
    is_eligible: boolean;
    checks: { check: string; passed: boolean; message: string }[];
    missing_requirements: string[];
  } | null>(null);
  const [selectedAutopilot, setSelectedAutopilot] = useState<{ id: string; name: string; avatar?: string; skills?: string[] } | null>(null);
  const [autopilots, setAutopilots] = useState<{ id: string; name: string; avatar?: string; status: string; skills?: string[] }[]>([]);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);

  // Terms state
  const [termsResult, setTermsResult] = useState<ReturnType<typeof getPlatformCompliance> | null>(null);
  const [userApprovedTerms, setUserApprovedTerms] = useState(false);

  // Asset generation state
  const [generating, setGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<{
    cover_letter?: string;
    bio?: string;
    message?: string;
  }>({});
  const [activeAsset, setActiveAsset] = useState<'cover_letter' | 'bio' | 'message'>('cover_letter');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const currentStepIdx = WORKFLOW_STEPS.findIndex(s => s.id === currentStep);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;
    // Load autopilots & identity
    Promise.all([getAutopilotsFromDB(), getUserIdentity()]).then(([{ data: aps }, { data: id }]) => {
      if (aps?.length) {
        const active = (aps as typeof autopilots).filter(a => !['error'].includes(a.status));
        setAutopilots(active);
        if (active.length > 0) setSelectedAutopilot(active[0]);
      }
      setIdentity(id);
    });
  }, [isOpen]);

  const runEligibility = useCallback(async () => {
    if (!selectedAutopilot) { toast.error('Select an Autopilot first'); return; }
    setEligibilityLoading(true);
    const { data, error } = await runEligibilityCheck(selectedAutopilot.id, opportunity.id);
    if (error) { toast.error('Eligibility check failed: ' + error); setEligibilityLoading(false); return; }
    setEligibilityResult(data);
    if (data?.is_eligible) {
      setCompletedSteps(s => new Set([...s, 'eligibility']));
    }
    setEligibilityLoading(false);
  }, [selectedAutopilot, opportunity.id]);

  const runTermsCheck = useCallback(() => {
    const result = getPlatformCompliance(opportunity.platform);
    setTermsResult(result);
    if (result.automation === 'allowed') {
      setCompletedSteps(s => new Set([...s, 'terms']));
    }
  }, [opportunity.platform]);

  const generateAssets = useCallback(async () => {
    if (!identity) { toast.error('Identity profile required'); return; }
    setGenerating(true);

    const contentType = opportunity.category === 'crypto' ? 'message' :
                        opportunity.category === 'dropshipping' ? 'product_description' : 'cover_letter';

    const { text, error } = await generateAIContent({
      content_type: contentType,
      context: {
        title: opportunity.title,
        job_title: opportunity.title,
        subject: opportunity.title,
        topic: opportunity.title,
        name: opportunity.title,
        platform: opportunity.platform,
        requirements: opportunity.requirements,
        description: opportunity.description || '',
        estimated_value: opportunity.estimated_value,
        currency: opportunity.currency,
        category: opportunity.category,
      },
      identity: {
        name: identity.display_name || identity.full_name || 'Professional',
        persona: identity.bio || 'Experienced professional',
        tone: 'professional',
        style: 'Concise & Direct',
        rules: [],
      },
      autopilot_id: selectedAutopilot?.id,
      opportunity_id: opportunity.id,
    });

    if (error) {
      toast.error('AI generation failed: ' + error);
      setGenerating(false);
      return;
    }

    // Generate bio too
    const { text: bioText } = await generateAIContent({
      content_type: 'bio',
      context: {
        platform: opportunity.platform,
        target_role: opportunity.title,
        skills: identity.skills || [],
        years_experience: identity.years_experience || 0,
      },
      identity: {
        name: identity.display_name || identity.full_name || 'Professional',
        persona: identity.bio || '',
        tone: 'professional',
        style: 'Concise & Direct',
      },
    });

    setGeneratedAssets({
      cover_letter: text || '',
      bio: bioText || '',
    });
    setCompletedSteps(s => new Set([...s, 'assets']));
    setGenerating(false);

    // Log access
    await logIdentityAccess({
      action: 'data_used',
      purpose: `AI content generation for ${opportunity.title} on ${opportunity.platform}`,
      fields_accessed: ['full_name', 'email', 'headline', 'skills', 'bio'],
      platform: opportunity.platform,
      autopilot_id: selectedAutopilot?.id,
      opportunity_id: opportunity.id,
    });
  }, [identity, opportunity, selectedAutopilot]);

  const submitApplication = useCallback(async () => {
    setSubmitting(true);
    // Create a task in mission control
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setSubmitting(false); return; }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        name: `Apply: ${opportunity.title} on ${opportunity.platform}`,
        type: 'application',
        status: 'queued',
        autopilot_id: selectedAutopilot?.id,
        opportunity_id: opportunity.id,
        priority: eligibilityResult?.is_eligible ? 1 : 3,
        progress: 0,
        logs: [{
          timestamp: new Date().toISOString(),
          message: 'Application workflow initiated via VELO 2.0',
          assets_generated: Object.keys(generatedAssets),
          terms_status: termsResult?.automation,
        }],
      })
      .select()
      .single();

    if (error) { toast.error('Failed to queue task: ' + error.message); setSubmitting(false); return; }

    // Update opportunity status
    await supabase
      .from('opportunities')
      .update({ status: 'applied', matched_autopilot_id: selectedAutopilot?.id })
      .eq('id', opportunity.id);

    // Send notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'task_complete',
      title: `Application Queued: ${opportunity.title}`,
      message: `${selectedAutopilot?.name || 'Autopilot'} will execute the application on ${opportunity.platform}`,
      data: { task_id: task.id, opportunity_id: opportunity.id },
      priority: 'normal',
    });

    setTaskId(task.id);
    setCompletedSteps(s => new Set([...s, 'preview', 'submit', 'done']));
    setCurrentStep('done');
    setSubmitting(false);
    // Invalidate shared React Query cache so Mission Control refreshes
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
    onSuccess?.(task.id);
  }, [opportunity, selectedAutopilot, eligibilityResult, generatedAssets, termsResult, onSuccess]);

  const goToStep = (stepId: StepId) => {
    setCurrentStep(stepId);
    if (stepId === 'terms' && !termsResult) runTermsCheck();
  };

  const advanceStep = async () => {
    const steps = WORKFLOW_STEPS.map(s => s.id);
    const idx = steps.indexOf(currentStep);

    if (currentStep === 'eligibility') {
      if (!eligibilityResult) { await runEligibility(); return; }
      if (eligibilityResult.is_eligible) { setCurrentStep('terms'); runTermsCheck(); }
    } else if (currentStep === 'terms') {
      if (termsResult?.automation === 'prohibited') { toast.error('Automation prohibited on this platform'); return; }
      if (termsResult?.automation === 'restricted' && !userApprovedTerms) { toast.warning('Please approve restricted platform access'); return; }
      setCompletedSteps(s => new Set([...s, 'terms']));
      setCurrentStep('assets');
    } else if (currentStep === 'assets') {
      if (!generatedAssets.cover_letter) { await generateAssets(); return; }
      setCurrentStep('preview');
      setCompletedSteps(s => new Set([...s, 'assets']));
    } else if (currentStep === 'preview') {
      setCompletedSteps(s => new Set([...s, 'preview']));
      setCurrentStep('submit');
    } else if (currentStep === 'submit') {
      await submitApplication();
    }
  };

  if (!isOpen) return null;

  const compliance = termsResult || getPlatformCompliance(opportunity.platform);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.25)] overflow-hidden shadow-2xl shadow-[hsl(185_100%_50%/0.08)] slide-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(228_35%_5%/0.8)] flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(185,100%,55%)] mb-1" style={{ fontFamily: 'Orbitron' }}>Application Workflow</div>
              <div className="text-sm font-bold truncate">{opportunity.title}</div>
              <div className="text-xs text-muted-foreground">{opportunity.platform} · Est. {opportunity.estimated_value > 0 ? `$${opportunity.estimated_value.toLocaleString()}` : 'TBD'}</div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_12%)] transition-colors flex-shrink-0 mt-0.5">
              <X size={15} className="text-muted-foreground" />
            </button>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-1 mt-4">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = completedSteps.has(step.id);
              const isCurrent = step.id === currentStep;
              const isPast = WORKFLOW_STEPS.findIndex(s => s.id === currentStep) > i;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => (isDone || isPast) && goToStep(step.id)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 flex-1 min-w-0 transition-all',
                      (isDone || isPast) ? 'cursor-pointer' : 'cursor-default'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-full border flex items-center justify-center transition-all',
                      isDone ? 'bg-[hsl(145_100%_50%/0.2)] border-[hsl(145_100%_50%/0.5)]' :
                      isCurrent ? 'bg-[hsl(185_100%_50%/0.2)] border-[hsl(185_100%_50%/0.6)] shadow-[0_0_8px_hsl(185_100%_50%/0.3)]' :
                      'bg-[hsl(228_25%_12%)] border-[hsl(228_25%_20%)]'
                    )}>
                      {isDone
                        ? <CheckCircle size={12} className="text-[hsl(145,100%,55%)]" />
                        : <Icon size={12} className={isCurrent ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground'} />}
                    </div>
                    <span className={cn('text-[9px] font-semibold hidden sm:block truncate w-full text-center',
                      isCurrent ? 'text-[hsl(185,100%,55%)]' : isDone ? 'text-[hsl(145,100%,55%)]' : 'text-muted-foreground'
                    )}>{step.label}</span>
                  </button>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className={cn('h-px flex-shrink-0 w-4 mb-4 transition-colors', isDone ? 'bg-[hsl(145_100%_50%/0.4)]' : 'bg-[hsl(228_25%_18%)]')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── ELIGIBILITY ── */}
          {currentStep === 'eligibility' && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground leading-relaxed">
                Select an Autopilot and run a pre-flight check to verify eligibility before applying.
              </div>

              {/* Autopilot selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Select Autopilot</label>
                <div className="space-y-2">
                  {autopilots.length === 0 ? (
                    <div className="p-3 rounded-lg border border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.04)] text-xs text-[hsl(30,100%,60%)] flex items-center gap-2">
                      <AlertTriangle size={12} /> No autopilots available. Create one in AI Core.
                    </div>
                  ) : (
                    autopilots.map(ap => (
                      <button
                        key={ap.id}
                        onClick={() => setSelectedAutopilot(ap)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                          selectedAutopilot?.id === ap.id
                            ? 'border-[hsl(185_100%_50%/0.4)] bg-[hsl(185_100%_50%/0.08)]'
                            : 'border-[hsl(var(--border))] hover:border-[hsl(185_100%_50%/0.2)]'
                        )}
                      >
                        <span className="text-xl flex-shrink-0">{ap.avatar || '🤖'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold">{ap.name}</div>
                          <div className="text-[11px] text-muted-foreground">{(ap.skills || []).slice(0, 3).join(', ')}</div>
                        </div>
                        {selectedAutopilot?.id === ap.id && <CheckCircle size={14} className="text-[hsl(185,100%,55%)]" />}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Eligibility result */}
              {eligibilityResult && (
                <div className={cn(
                  'rounded-xl border p-4',
                  eligibilityResult.is_eligible ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.05)]' : 'border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.05)]'
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    {eligibilityResult.is_eligible
                      ? <CheckCircle size={16} className="text-[hsl(145,100%,55%)]" />
                      : <AlertTriangle size={16} className="text-[hsl(30,100%,60%)]" />}
                    <span className="text-sm font-bold">
                      {eligibilityResult.is_eligible ? 'Eligible — Ready to Proceed' : `${eligibilityResult.missing_requirements.length} Requirements Not Met`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {eligibilityResult.checks.map(c => (
                      <div key={c.check} className="flex items-center gap-2 text-xs">
                        {c.passed ? <CheckCircle size={11} className="text-[hsl(145,100%,55%)] flex-shrink-0" /> : <XCircle size={11} className="text-[hsl(0,85%,65%)] flex-shrink-0" />}
                        <span className={c.passed ? 'text-muted-foreground' : 'text-foreground'}>{c.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TERMS ── */}
          {currentStep === 'terms' && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">Checking platform compliance before automation proceeds.</div>

              {termsResult && (
                <div className={cn(
                  'rounded-xl border p-5',
                  termsResult.automation === 'allowed' ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.05)]' :
                  termsResult.automation === 'restricted' ? 'border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.05)]' :
                  'border-[hsl(0_85%_60%/0.3)] bg-[hsl(0_85%_60%/0.05)]'
                )}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border',
                      termsResult.automation === 'allowed' ? 'text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.4)] bg-[hsl(145_100%_50%/0.1)]' :
                      termsResult.automation === 'restricted' ? 'text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.4)] bg-[hsl(30_100%_55%/0.1)]' :
                      'text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.4)] bg-[hsl(0_85%_60%/0.1)]'
                    )}>
                      {termsResult.automation === 'allowed' ? '✓ Automation Allowed' :
                       termsResult.automation === 'restricted' ? '⚠ Restricted — Approval Needed' :
                       termsResult.automation === 'prohibited' ? '✗ Automation Prohibited' :
                       '? Status Unknown'}
                    </div>
                  </div>
                  <div className="text-sm font-semibold mb-1 capitalize">{termsResult.platform}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed mb-3">{termsResult.notes}</div>

                  {termsResult.requires_id && (
                    <div className="flex items-center gap-2 text-xs text-[hsl(265,80%,70%)] mb-3">
                      <Lock size={11} /> Identity verification required by this platform
                    </div>
                  )}

                  {termsResult.automation === 'restricted' && (
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.04)]">
                      <div
                        onClick={() => setUserApprovedTerms(v => !v)}
                        className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                          userApprovedTerms ? 'bg-[hsl(30_100%_55%/0.3)] border-[hsl(30,100%,60%)]' : 'border-[hsl(var(--border))]'
                        )}
                      >
                        {userApprovedTerms && <CheckCircle size={12} className="text-[hsl(30,100%,60%)]" />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        I understand this platform restricts automation and accept responsibility. I authorize VELO to proceed with human oversight enabled.
                      </span>
                    </label>
                  )}

                  {termsResult.automation === 'prohibited' && (
                    <div className="p-3 rounded-lg border border-[hsl(0_85%_60%/0.2)] bg-[hsl(0_85%_60%/0.05)] text-xs text-[hsl(0,85%,65%)] flex items-start gap-2">
                      <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                      This platform prohibits automation. You must apply manually. VELO will not proceed.
                    </div>
                  )}
                </div>
              )}

              {/* Compliance log notice */}
              <div className="p-3 rounded-lg border border-[hsl(265_80%_55%/0.15)] bg-[hsl(265_80%_55%/0.05)] text-xs text-muted-foreground flex items-start gap-2">
                <Shield size={11} className="text-[hsl(265,80%,70%)] mt-0.5 flex-shrink-0" />
                All compliance decisions are logged in your Safety Control audit trail.
              </div>
            </div>
          )}

          {/* ── AI ASSETS ── */}
          {currentStep === 'assets' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cpu size={12} className="text-[hsl(185,100%,55%)]" />
                AI generates application assets using your real identity profile.
              </div>

              {Object.keys(generatedAssets).length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-[hsl(var(--border))] text-center">
                  {generating ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
                      <div className="text-xs text-muted-foreground">Generating assets with Gemini 3 Flash...</div>
                      <div className="text-[11px] text-muted-foreground opacity-60">Using your identity: {identity?.display_name || identity?.full_name || 'Profile'}</div>
                    </div>
                  ) : (
                    <>
                      <Cpu size={28} className="text-muted-foreground mx-auto mb-3 opacity-30" />
                      <div className="text-sm font-semibold mb-1">Ready to Generate</div>
                      <div className="text-xs text-muted-foreground mb-4">AI will create a cover letter and bio using your verified identity.</div>
                      <button onClick={generateAssets} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-all">
                        Generate Assets
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(['cover_letter', 'bio'] as const).map(type => (
                      generatedAssets[type] && (
                        <button
                          key={type}
                          onClick={() => setActiveAsset(type)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors',
                            activeAsset === type
                              ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]'
                              : 'text-muted-foreground border-[hsl(var(--border))] hover:text-foreground'
                          )}
                        >
                          {type.replace('_', ' ')}
                        </button>
                      )
                    ))}
                    <button
                      onClick={generateAssets}
                      disabled={generating}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw size={10} className={generating ? 'animate-spin' : ''} /> Regenerate
                    </button>
                  </div>
                  <div className="relative">
                    <div className="p-4 rounded-xl bg-[hsl(228_35%_4%)] border border-[hsl(var(--border))] text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-mono">
                      {generatedAssets[activeAsset] || ''}
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedAssets[activeAsset] || ''); toast.success('Copied!'); }}
                      className="absolute top-2 right-2 p-1.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] hover:bg-[hsl(228_25%_18%)] transition-colors"
                    >
                      <Copy size={11} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PREVIEW ── */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">Review all details before submission.</div>

              <div className="space-y-3">
                {/* Opportunity summary */}
                <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_10%)]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Opportunity</div>
                  <div className="text-sm font-bold mb-1">{opportunity.title}</div>
                  <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{opportunity.platform}</span>
                    <span>·</span>
                    <span className="capitalize">{opportunity.category}</span>
                    <span>·</span>
                    <span className="text-[hsl(185,100%,55%)] font-semibold">{opportunity.estimated_value > 0 ? `$${opportunity.estimated_value.toLocaleString()}` : 'TBD'}</span>
                  </div>
                </div>

                {/* Autopilot */}
                {selectedAutopilot && (
                  <div className="p-4 rounded-xl border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.04)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Assigned Autopilot</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{selectedAutopilot.avatar || '🤖'}</span>
                      <span className="text-sm font-bold">{selectedAutopilot.name}</span>
                    </div>
                  </div>
                )}

                {/* Terms status */}
                {termsResult && (
                  <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_10%)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Compliance Status</div>
                    <div className={cn('text-xs font-semibold capitalize',
                      termsResult.automation === 'allowed' ? 'text-[hsl(145,100%,55%)]' :
                      termsResult.automation === 'restricted' ? 'text-[hsl(30,100%,60%)]' : 'text-[hsl(0,85%,65%)]'
                    )}>
                      {termsResult.automation} — {termsResult.notes}
                    </div>
                  </div>
                )}

                {/* Generated assets */}
                {generatedAssets.cover_letter && (
                  <div className="p-4 rounded-xl border border-[hsl(145_100%_50%/0.2)] bg-[hsl(145_100%_50%/0.04)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <CheckCircle size={10} className="text-[hsl(145,100%,55%)]" /> AI Assets Generated
                    </div>
                    <div className="text-xs text-muted-foreground">{Object.keys(generatedAssets).join(', ')} ready for submission</div>
                  </div>
                )}

                {/* Identity */}
                <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_10%)]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Lock size={10} /> Identity (Verified)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {identity?.full_name || 'Name not set'} · {identity?.email || 'Email not set'} · {identity?.completeness_score || 0}% complete
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SUBMIT ── */}
          {currentStep === 'submit' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-[hsl(185_100%_50%/0.2)] bg-[hsl(185_100%_50%/0.04)] text-center">
                {submitting ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
                    <div className="text-sm font-semibold">Queuing Application Task...</div>
                    <div className="text-xs text-muted-foreground">Creating task in Mission Control · Logging identity access · Notifying systems</div>
                  </div>
                ) : (
                  <>
                    <Send size={32} className="text-[hsl(185,100%,55%)] mx-auto mb-3 float-anim" />
                    <div className="text-base font-bold mb-2">Ready to Submit</div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {selectedAutopilot?.name} will execute this application on {opportunity.platform}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      All actions will be logged · Identity access recorded · Task created in Mission Control
                    </div>
                  </>
                )}
              </div>

              <div className="p-3 rounded-lg border border-[hsl(265_80%_55%/0.15)] bg-[hsl(265_80%_55%/0.05)] text-xs text-muted-foreground flex items-start gap-2">
                <Shield size={11} className="text-[hsl(265,80%,70%)] mt-0.5 flex-shrink-0" />
                Submission is queued in Mission Control. The Autopilot will execute autonomously using Browser Automation with full logging.
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {currentStep === 'done' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(145_100%_50%/0.15)] border border-[hsl(145_100%_50%/0.4)] flex items-center justify-center float-anim">
                <CheckCircle size={28} className="text-[hsl(145,100%,55%)]" />
              </div>
              <div>
                <div className="text-lg font-black text-[hsl(145,100%,55%)] mb-1" style={{ fontFamily: 'Orbitron' }}>APPLICATION QUEUED</div>
                <div className="text-xs text-muted-foreground">
                  Task created in Mission Control. {selectedAutopilot?.name} will execute the application workflow.
                </div>
              </div>

              {taskId && (
                <div className="p-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs font-mono text-muted-foreground">
                  Task ID: {taskId}
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
                  Close
                </button>
                <button onClick={() => { onClose(); navigate('/mission-control'); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-all">
                  <Zap size={13} /> View in Mission Control
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {currentStep !== 'done' && (
          <div className="px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(228_35%_5%/0.8)] flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => {
                const steps = WORKFLOW_STEPS.map(s => s.id);
                const idx = steps.indexOf(currentStep);
                if (idx > 0) setCurrentStep(steps[idx - 1]);
              }}
              disabled={currentStepIdx === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {currentStep === 'submit' ? (
                <button
                  onClick={advanceStep}
                  disabled={submitting || !selectedAutopilot}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
                  {submitting ? 'Submitting...' : 'Launch Application'}
                </button>
              ) : (
                <button
                  onClick={advanceStep}
                  disabled={
                    (currentStep === 'eligibility' && !selectedAutopilot) ||
                    (currentStep === 'eligibility' && eligibilityLoading) ||
                    (currentStep === 'terms' && termsResult?.automation === 'prohibited') ||
                    (currentStep === 'terms' && termsResult?.automation === 'restricted' && !userApprovedTerms) ||
                    (currentStep === 'assets' && generating)
                  }
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {eligibilityLoading || generating
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <ChevronRight size={14} />}
                  {currentStep === 'eligibility' && (!eligibilityResult ? (eligibilityLoading ? 'Checking...' : 'Run Check') : 'Continue') }
                  {currentStep === 'terms' && 'Confirm & Continue'}
                  {currentStep === 'assets' && (!generatedAssets.cover_letter ? (generating ? 'Generating...' : 'Generate Assets') : 'Continue')}
                  {currentStep === 'preview' && 'Proceed to Submit'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
