/**
 * VELO 2.0 — Unified Onboarding Wizard
 * Single end-to-end flow: Identity → Address → Professional → Payment → Security →
 * Documents → Platforms → Autopilot → System Check
 *
 * Saves to: user_identity, credentials (encrypted), platforms, autopilots,
 *           onboarding_progress, identity-docs storage bucket
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Rocket, User, MapPin, Briefcase, CreditCard, Shield, Upload,
  Globe, Bot, CheckCircle, ChevronRight, X, Lock, Eye, EyeOff,
  AlertTriangle, RefreshCw, Plus, Trash2, FileText, Image as ImageIcon,
  Zap, Star, Cpu, Target, Activity, Check, Package, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  createEngine, createAutopilot, upsertOnboardingProgress,
  upsertUserIdentity, giveIdentityConsent
} from '@/lib/api';
import { getVaultKey, encryptVaultValue } from '@/lib/vaultCrypto';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface OnboardingFlowProps { onComplete: () => void; onSkip: () => void; }

type StepId =
  | 'identity_personal'
  | 'identity_address'
  | 'identity_professional'
  | 'identity_payment'
  | 'identity_security'
  | 'documents'
  | 'platforms'
  | 'autopilot'
  | 'system_check';

interface Step {
  id: StepId;
  phase: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

interface PlatformEntry {
  slug: string;
  name: string;
  category: string;
  url: string;
  status: 'ready' | 'pending' | 'needs_account' | 'skip';
  username: string;
  password: string;
  notes: string;
}

interface UploadedDoc {
  key: string;
  label: string;
  file?: File;
  url?: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STEPS: Step[] = [
  { id: 'identity_personal',     phase: 'Identity',   label: 'Personal',     icon: User,       color: 'cyan' },
  { id: 'identity_address',      phase: 'Identity',   label: 'Address',      icon: MapPin,     color: 'cyan' },
  { id: 'identity_professional', phase: 'Identity',   label: 'Professional', icon: Briefcase,  color: 'cyan' },
  { id: 'identity_payment',      phase: 'Identity',   label: 'Payment',      icon: CreditCard, color: 'violet' },
  { id: 'identity_security',     phase: 'Identity',   label: 'Security',     icon: Shield,     color: 'violet' },
  { id: 'documents',             phase: 'Documents',  label: 'Documents',    icon: Upload,     color: 'orange' },
  { id: 'platforms',             phase: 'Platforms',  label: 'Platforms',    icon: Globe,      color: 'green' },
  { id: 'autopilot',             phase: 'Autopilot',  label: 'Autopilot',    icon: Bot,        color: 'violet' },
  { id: 'system_check',          phase: 'Launch',     label: 'Launch',       icon: Rocket,     color: 'cyan' },
];

const PHASES = ['Identity', 'Documents', 'Platforms', 'Autopilot', 'Launch'];

const PLATFORM_LIST: Omit<PlatformEntry, 'status' | 'username' | 'password' | 'notes'>[] = [
  { slug: 'upwork',        name: 'Upwork',         category: 'freelance', url: 'https://upwork.com' },
  { slug: 'fiverr',        name: 'Fiverr',         category: 'freelance', url: 'https://fiverr.com' },
  { slug: 'clickworker',   name: 'ClickWorker',    category: 'gig',       url: 'https://clickworker.com' },
  { slug: 'scale-ai',      name: 'Scale AI',       category: 'gig',       url: 'https://app.scale.com' },
  { slug: 'appen',         name: 'Appen',          category: 'gig',       url: 'https://connect.appen.com' },
  { slug: 'rev',           name: 'Rev',            category: 'gig',       url: 'https://rev.com' },
  { slug: 'testlio',       name: 'Testlio',        category: 'testing',   url: 'https://join.testlio.com' },
  { slug: 'lionbridge',    name: 'Lionbridge AI',  category: 'gig',       url: 'https://workwiselions.com' },
  { slug: 'syncswap',      name: 'SyncSwap',       category: 'crypto',    url: 'https://syncswap.xyz' },
  { slug: 'galxe',         name: 'Galxe',          category: 'crypto',    url: 'https://galxe.com' },
];

const DOC_SLOTS: UploadedDoc[] = [
  { key: 'gov_id_front',    label: 'Government ID — Front',    status: 'idle' },
  { key: 'gov_id_back',     label: 'Government ID — Back',     status: 'idle' },
  { key: 'proof_of_address',label: 'Proof of Address',         status: 'idle' },
  { key: 'resume',          label: 'Resume / CV',              status: 'idle' },
  { key: 'portfolio',       label: 'Portfolio / Work Samples', status: 'idle' },
];

const CATEGORIES = ['freelance', 'crypto', 'gig', 'remote_job', 'testing', 'content', 'dropshipping'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_9%)] border border-[hsl(var(--border))] text-sm ' +
  'focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors placeholder:text-muted-foreground/40';

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-2 block">
      {children}
      {hint && <span className="text-[hsl(145,100%,55%)] text-[10px]">{hint}</span>}
    </label>
  );
}

// Phase pill indicator
function PhasePill({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all',
      done   ? 'bg-[hsl(145_100%_50%/0.1)] border-[hsl(145_100%_50%/0.3)] text-[hsl(145,100%,55%)]'
             : active ? 'bg-[hsl(185_100%_50%/0.12)] border-[hsl(185_100%_50%/0.35)] text-[hsl(185,100%,55%)]'
             : 'bg-transparent border-[hsl(228_25%_18%)] text-muted-foreground',
    )}>
      {done && <Check size={9} />}
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // ── Identity: Personal ────────────────────────────────────────────────────
  const [personal, setPersonal] = useState({
    full_name: '', display_name: '', date_of_birth: '',
    nationality: '', email: '', phone: '',
    workspace_name: 'VELO Workspace',
  });
  const [showEmail, setShowEmail] = useState(false);

  // ── Identity: Address ─────────────────────────────────────────────────────
  const [address, setAddress] = useState({
    location_country: '', location_city: '',
    address_line1: '', address_line2: '',
    postal_code: '', timezone: 'UTC-5',
  });

  // ── Identity: Professional ────────────────────────────────────────────────
  const [professional, setProfessional] = useState({
    headline: '', bio: '', professional_title: '',
    years_experience: '', skills: '',
    languages: 'English', hourly_rate_min: '',
    portfolio_url: '', linkedin_url: '', github_url: '',
    employer: '', work_authorization: '',
  });

  // ── Identity: Payment ─────────────────────────────────────────────────────
  const [payment, setPayment] = useState({
    payment_paypal: '', payment_bank_account: '',
    payment_wise: '', payment_crypto_address: '',
    tax_id: '', tax_country: '',
  });

  // ── Identity: Security ────────────────────────────────────────────────────
  const [security, setSecurity] = useState({
    security_question_1: '', security_answer_1: '',
    security_question_2: '', security_answer_2: '',
    id_document_type: 'passport', id_document_number: '',
    id_document_expiry: '',
  });
  const [identityConsent, setIdentityConsent] = useState(false);

  // ── Documents ─────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<UploadedDoc[]>(DOC_SLOTS.map(d => ({ ...d })));
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Platforms ─────────────────────────────────────────────────────────────
  const [platforms, setPlatforms] = useState<PlatformEntry[]>(
    PLATFORM_LIST.map(p => ({ ...p, status: 'skip', username: '', password: '', notes: '' }))
  );
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  // ── Autopilot ─────────────────────────────────────────────────────────────
  const [autopilot, setAutopilot] = useState({
    name: 'ARIA-1', persona: '', tone: 'professional',
    selected_categories: ['freelance', 'gig'] as string[],
    workload_limit: '10', risk_level: 'medium',
    engine_name: '', engine_goal: '',
    allowed_operations: ['apply', 'browse', 'fill_forms'] as string[],
  });

  // ── Readiness scan ────────────────────────────────────────────────────────
  const [readiness, setReadiness] = useState<{
    label: string; ok: boolean; detail: string
  }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [launching, setLaunching] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const step     = STEPS[stepIndex];
  const progress = Math.round((doneSteps.size / STEPS.length) * 100);
  const isLast   = stepIndex === STEPS.length - 1;

  const currentPhase = step.phase;
  const donePhases   = PHASES.filter(ph => {
    const phSteps = STEPS.filter(s => s.phase === ph).map((s, i) => STEPS.indexOf(s));
    return phSteps.every(i => doneSteps.has(i));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Document upload handler — uploads File directly (no blob URL roundtrip)
  // ─────────────────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (key: string, file: File) => {
    // Validate immediately
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ALLOWED.includes(file.type)) {
      toast.error(`File type "${file.type}" not supported. Use JPG, PNG, WEBP, or PDF.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
      return;
    }
    if (file.size === 0) {
      toast.error('File is empty — select a valid document.');
      return;
    }

    setDocs(prev => prev.map(d => d.key === key ? { ...d, file, status: 'uploading' } : d));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDocs(prev => prev.map(d => d.key === key ? { ...d, status: 'error' } : d));
      toast.error('Authentication required — please log in again.');
      return;
    }

    // Build storage path matching RLS policy — stable key (no timestamp) so re-uploads replace same file
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeKey = key.replace(/[^a-z0-9_-]/gi, '_');
    const path = `identity-documents/${user.id}/${safeKey}.${ext}`;

    console.log(`[OnboardingFlow] Uploading ${file.name} to ${path} (${file.size} bytes)`);

    // Upload File directly — File IS a Blob, no fetch(URL.createObjectURL()) needed
    let uploadErr: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.storage
        .from('identity-docs')
        .upload(path, file, {                // Direct File upload
          contentType: file.type,
          upsert: true,
        });

      if (!error) {
        uploadErr = null;
        break;
      }
      uploadErr = error.message;
      console.error(`[OnboardingFlow] Upload attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    if (uploadErr) {
      console.error('[OnboardingFlow] All upload attempts failed:', uploadErr);
      setDocs(prev => prev.map(d => d.key === key ? { ...d, status: 'error' } : d));
      toast.error(`Upload failed: ${uploadErr}`);
      return;
    }

    // Save metadata to user_documents table
    await supabase.from('user_documents').upsert({
      user_id:    user.id,
      doc_key:    key,
      doc_type:   key.includes('gov_id') ? 'government_id' : key === 'resume' ? 'resume' : key === 'portfolio' ? 'portfolio' : 'other',
      doc_label:  DOC_SLOTS.find(d => d.key === key)?.label || key,
      storage_path: path,
      file_name:  file.name,
      file_size:  file.size,
      mime_type:  file.type,
      verification_status: 'uploaded',
      source:     'onboarding',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,doc_key' });

    // If ID doc, update has_id_document flag
    if (key.includes('gov_id')) {
      await supabase.from('user_identity').upsert(
        { user_id: user.id, has_id_document: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    }

    // Get signed URL for preview (bucket is private)
    const { data: signedData } = await supabase.storage
      .from('identity-docs')
      .createSignedUrl(path, 3600);

    setDocs(prev => prev.map(d =>
      d.key === key ? { ...d, status: 'done', url: signedData?.signedUrl || path } : d
    ));

    console.log(`[OnboardingFlow] Upload complete: ${path}`);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Save step to backend
  // ─────────────────────────────────────────────────────────────────────────
  const saveStep = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (step.id === 'identity_personal') {
      await upsertUserIdentity({
        full_name:    personal.full_name   || undefined,
        display_name: personal.display_name || undefined,
        email:        personal.email        || undefined,
        phone:        personal.phone        || undefined,
        nationality:  personal.nationality  || undefined,
        date_of_birth: personal.date_of_birth || undefined,
      });
      await upsertOnboardingProgress({ workspace_name: personal.workspace_name });
    }

    else if (step.id === 'identity_address') {
      await upsertUserIdentity({
        location_country: address.location_country || undefined,
        location_city:    address.location_city    || undefined,
        address_line1:    address.address_line1    || undefined,
        address_line2:    address.address_line2    || undefined,
        postal_code:      address.postal_code       || undefined,
        timezone:         address.timezone          || undefined,
      });
    }

    else if (step.id === 'identity_professional') {
      await upsertUserIdentity({
        headline:         professional.headline          || undefined,
        bio:              professional.bio               || undefined,
        professional_title: professional.professional_title || undefined,
        years_experience: professional.years_experience ? Number(professional.years_experience) : undefined,
        skills:           professional.skills ? professional.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        languages:        professional.languages ? professional.languages.split(',').map(s => s.trim()).filter(Boolean) : ['English'],
        hourly_rate_min:  professional.hourly_rate_min ? Number(professional.hourly_rate_min) : undefined,
        portfolio_url:    professional.portfolio_url  || undefined,
        linkedin_url:     professional.linkedin_url   || undefined,
        github_url:       professional.github_url     || undefined,
        employer:         professional.employer       || undefined,
        work_authorization: professional.work_authorization || undefined,
        has_portfolio:    !!professional.portfolio_url,
      });
    }

    else if (step.id === 'identity_payment') {
      await upsertUserIdentity({
        payment_paypal:         payment.payment_paypal         || undefined,
        payment_bank_account:   payment.payment_bank_account   || undefined,
        payment_wise:           payment.payment_wise           || undefined,
        payment_crypto_address: payment.payment_crypto_address || undefined,
        tax_id:                 payment.tax_id                 || undefined,
        tax_country:            payment.tax_country            || undefined,
      });
    }

    else if (step.id === 'identity_security') {
      await upsertUserIdentity({
        security_question_1:  security.security_question_1 || undefined,
        security_answer_1:    security.security_answer_1   || undefined,
        security_question_2:  security.security_question_2 || undefined,
        security_answer_2:    security.security_answer_2   || undefined,
        id_document_type:     security.id_document_type    || undefined,
        id_document_number:   security.id_document_number  || undefined,
        id_document_expiry:   security.id_document_expiry  || undefined,
      });
      if (identityConsent) {
        await giveIdentityConsent(['applications', 'registration', 'communication']);
      }
    }

    else if (step.id === 'platforms') {
      // Save credentials for platforms that have username/password entered
      const credPlatforms = platforms.filter(p =>
        (p.status === 'ready' || p.status === 'pending') && p.username
      );

      if (credPlatforms.length > 0) {
        const key = await getVaultKey(user.id, user.email!);
        for (const pl of credPlatforms) {
          const secretPayload = JSON.stringify({ username: pl.username, password: pl.password });
          const encrypted = await encryptVaultValue(secretPayload, key);
          const { error } = await supabase.from('credentials').upsert({
            user_id: user.id,
            name:    `${pl.name} Account`,
            type:    'login',
            platform: pl.slug,
            encrypted_data: encrypted,
            is_encrypted:   true,
          }, { onConflict: 'user_id,name' });
          if (error) console.error('[onboarding] credential save error:', error);
        }
        toast.success(`${credPlatforms.length} platform credential(s) encrypted and stored`);
      }

      // Upsert platforms into the registry
      const activePlatforms = platforms.filter(p => p.status !== 'skip');
      if (activePlatforms.length > 0) {
        const platformBase = PLATFORM_LIST;
        for (const pl of activePlatforms) {
          const base = platformBase.find(b => b.slug === pl.slug);
          if (!base) continue;
          const { error: _e } = await supabase.from('platforms').upsert({
            user_id:   user.id,
            name:      base.name,
            slug:      base.slug,
            url:       base.url,
            category:  base.category,
            is_active: pl.status === 'ready',
            is_verified: pl.status === 'ready',
            payout_method: [],
            payout_frequency: 'weekly',
            min_payout: 0,
            required_identity: [],
            automation_difficulty: 'medium',
            risk_score: 50,
            login_url:  base.url,
            notes:      pl.notes || '',
          }, { onConflict: 'user_id,slug' });
        }
      }
    }

    else if (step.id === 'autopilot') {
      if (autopilot.name) {
        await createAutopilot({
          name:               autopilot.name,
          persona:            autopilot.persona || 'Autonomous income agent',
          tone:               autopilot.tone,
          status:             'idle',
          skills:             professional.skills ? professional.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
          allowed_categories: autopilot.selected_categories,
          workload_limit:     Number(autopilot.workload_limit) || 10,
          behavior_rules:     [
            'Always request milestones on new contracts',
            'Never accept tasks below minimum hourly rate',
            'Request identity consent before every application',
            autopilot.risk_level === 'low' ? 'Prefer verified, established platforms' : 'Explore new opportunity sources',
          ],
          cover_letter_template: '',
          resume_template:       '',
        });
      }
      if (autopilot.engine_name) {
        await createEngine({
          name:     autopilot.engine_name,
          goal:     autopilot.engine_goal || `Maximize earnings across ${autopilot.selected_categories.join(', ')} categories`,
          status:   'idle',
          channels: autopilot.selected_categories,
          category: autopilot.selected_categories[0] || 'freelance',
        });
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Run system readiness scan
  // ─────────────────────────────────────────────────────────────────────────
  const runReadinessScan = async () => {
    setScanning(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setScanning(false); return; }

    const [identityRes, credRes, platformRes, autopilotRes, transRes] = await Promise.all([
      supabase.from('user_identity').select('completeness_score, consent_given, email, full_name, skills, payment_paypal').eq('user_id', user.id).maybeSingle(),
      supabase.from('credentials').select('id').eq('user_id', user.id).limit(1),
      supabase.from('platforms').select('id').eq('user_id', user.id).limit(1),
      supabase.from('autopilots').select('id').eq('user_id', user.id).limit(1),
      supabase.from('wallet_transactions').select('id').eq('user_id', user.id).limit(1),
    ]);

    const id = identityRes.data;
    const docsUploaded = docs.filter(d => d.status === 'done').length;

    setReadiness([
      {
        label: 'Identity Profile',
        ok:     (id?.completeness_score ?? 0) >= 40,
        detail: id ? `${id.completeness_score ?? 0}% complete${id.full_name ? ` · ${id.full_name}` : ''}` : 'Not created',
      },
      {
        label: 'Consent & Authorization',
        ok:     !!id?.consent_given,
        detail: id?.consent_given ? 'Granted for applications, registration, communication' : 'Not granted — Autopilot cannot submit applications',
      },
      {
        label: 'Payment Method',
        ok:     !!(id?.payment_paypal || payment.payment_bank_account || payment.payment_wise),
        detail: id?.payment_paypal ? `PayPal: ${id.payment_paypal}` : 'No payout method configured',
      },
      {
        label: 'Secure Credentials',
        ok:     !credRes.error && (credRes.data?.length ?? 0) > 0,
        detail: credRes.data?.length ? `${credRes.data.length} credential(s) encrypted in vault` : 'No credentials stored — add platform logins',
      },
      {
        label: 'Platform Registry',
        ok:     !platformRes.error && (platformRes.data?.length ?? 0) > 0,
        detail: platformRes.data?.length ? `${platformRes.data.length} platform(s) registered` : 'No platforms — skipped during setup',
      },
      {
        label: 'Autopilot Agent',
        ok:     !autopilotRes.error && (autopilotRes.data?.length ?? 0) > 0,
        detail: autopilotRes.data?.length ? 'Agent configured and idle' : 'No autopilot created',
      },
      {
        label: 'Document Storage',
        ok:     docsUploaded > 0,
        detail: docsUploaded > 0 ? `${docsUploaded}/${docs.length} documents uploaded` : 'No documents uploaded — some platforms require ID verification',
      },
      {
        label: 'Skills Defined',
        ok:     (id?.skills?.length ?? 0) > 0 || professional.skills.length > 0,
        detail: id?.skills?.length ? id.skills.slice(0, 3).join(', ') + (id.skills.length > 3 ? '…' : '') : 'No skills — add in Identity Studio',
      },
    ]);
    setScanning(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────
  const goNext = async () => {
    if (isLast) { await handleLaunch(); return; }
    setSaving(true);
    try {
      await saveStep();
      setDoneSteps(prev => new Set([...prev, stepIndex]));
      setStepIndex(i => i + 1);
      if (step.id === 'system_check' || stepIndex + 1 === STEPS.findIndex(s => s.id === 'system_check')) {
        await runReadinessScan();
      }
    } catch (err) {
      console.error('[onboarding] save error:', err);
      toast.error('Save failed — check console');
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => { if (stepIndex > 0) setStepIndex(i => i - 1); };

  const skipStep = () => {
    setDoneSteps(prev => new Set([...prev, stepIndex]));
    setStepIndex(i => i + 1);
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await saveStep();
      await upsertOnboardingProgress({
        completed_steps: STEPS.map(s => s.id),
        current_step: 'done',
        is_complete: true,
        selected_categories: autopilot.selected_categories,
        completed_at: new Date().toISOString(),
      });
      toast.success('VELO 2.0 fully configured — system is live!');
      onComplete();
    } catch (err) {
      console.error('[onboarding] launch error:', err);
      setLaunching(false);
    }
  };

  const canProceed = () => {
    if (step.id === 'identity_personal') return personal.full_name.length > 1 && personal.workspace_name.length > 2;
    if (step.id === 'autopilot') return autopilot.name.length > 1;
    return true;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-[hsl(230_35%_3%/0.98)] backdrop-blur-md overflow-y-auto py-6 px-4">
      {/* Stars bg */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="star absolute" style={{
            width: `${Math.random() * 2 + 0.5}px`, height: `${Math.random() * 2 + 0.5}px`,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            '--duration': `${Math.random() * 4 + 2}s`, '--delay': `${Math.random() * 3}s`,
          } as React.CSSProperties} />
        ))}
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Skip */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>
            VELO 2.0 — MISSION SETUP
          </div>
          <button onClick={onSkip} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X size={13} /> Skip for now
          </button>
        </div>

        {/* Phase pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {PHASES.map(ph => (
            <PhasePill
              key={ph}
              label={ph}
              active={currentPhase === ph}
              done={donePhases.includes(ph)}
            />
          ))}
        </div>

        {/* Main progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">Step {stepIndex + 1} of {STEPS.length}</span>
            <span className="text-[11px] text-muted-foreground">{progress}% complete</span>
          </div>
          <div className="h-1 rounded-full bg-[hsl(228_25%_12%)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700"
              style={{ width: `${Math.max(3, progress)}%` }} />
          </div>
          {/* Step dots */}
          <div className="flex justify-between mt-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = doneSteps.has(i);
              const isCurrent = i === stepIndex;
              return (
                <button key={s.id} onClick={() => i < stepIndex && setStepIndex(i)}
                  className={cn('flex flex-col items-center gap-1 group', i < stepIndex ? 'cursor-pointer' : 'cursor-default')}>
                  <div className={cn(
                    'w-7 h-7 rounded-full border flex items-center justify-center transition-all',
                    isDone    ? 'bg-[hsl(145_100%_50%/0.15)] border-[hsl(145_100%_50%/0.4)]'
                              : isCurrent ? 'bg-[hsl(185_100%_50%/0.15)] border-[hsl(185_100%_50%/0.5)] glow-cyan'
                              : 'bg-[hsl(228_25%_10%)] border-[hsl(228_25%_18%)]'
                  )}>
                    {isDone
                      ? <CheckCircle size={12} className="text-[hsl(145,100%,55%)]" />
                      : <Icon size={11} className={isCurrent ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground'} />
                    }
                  </div>
                  <span className={cn('text-[9px] hidden md:block truncate max-w-[50px] text-center',
                    isCurrent ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground')}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.18)] overflow-hidden slide-in-up">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[hsl(var(--border))]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center flex-shrink-0">
              {React.createElement(step.icon, { size: 17, className: 'text-black' })}
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{step.phase} · {step.label}</div>
              <h2 className="text-base font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>
                {step.id === 'identity_personal'     ? 'Personal Identity'           :
                 step.id === 'identity_address'      ? 'Location & Address'          :
                 step.id === 'identity_professional' ? 'Professional Profile'        :
                 step.id === 'identity_payment'      ? 'Payment & Tax Info'          :
                 step.id === 'identity_security'     ? 'Security & ID Document'      :
                 step.id === 'documents'             ? 'Document Uploads'            :
                 step.id === 'platforms'             ? 'Platform Account Setup'      :
                 step.id === 'autopilot'             ? 'Autopilot Configuration'     :
                                                      'System Readiness Check'
                }
              </h2>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[55vh] overflow-y-auto space-y-4">

            {/* ── STEP: Personal ────────────────────────────────────────── */}
            {step.id === 'identity_personal' && (
              <>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.04)] text-xs text-muted-foreground">
                  <Lock size={12} className="text-[hsl(265,80%,70%)] flex-shrink-0 mt-0.5" />
                  All identity data is encrypted and never shared with third parties. Used only for authorized platform applications with your consent.
                </div>
                <div>
                  <FieldLabel>Workspace Name *</FieldLabel>
                  <input className={inputCls} value={personal.workspace_name}
                    onChange={e => setPersonal(p => ({ ...p, workspace_name: e.target.value }))}
                    placeholder="e.g. Alpha Strike Base, Profit Nexus..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Legal Full Name *</FieldLabel>
                    <input autoFocus className={inputCls} value={personal.full_name}
                      onChange={e => setPersonal(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="As on government ID" />
                  </div>
                  <div>
                    <FieldLabel>Display / Username</FieldLabel>
                    <input className={inputCls} value={personal.display_name}
                      onChange={e => setPersonal(p => ({ ...p, display_name: e.target.value }))}
                      placeholder="How you appear on platforms" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Date of Birth</FieldLabel>
                    <input type="date" className={inputCls} value={personal.date_of_birth}
                      onChange={e => setPersonal(p => ({ ...p, date_of_birth: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>Nationality</FieldLabel>
                    <input className={inputCls} value={personal.nationality}
                      onChange={e => setPersonal(p => ({ ...p, nationality: e.target.value }))}
                      placeholder="e.g. American, British..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel hint="🔒 encrypted">Primary Email</FieldLabel>
                    <div className="relative">
                      <input type={showEmail ? 'text' : 'password'} className={cn(inputCls, 'pr-8')}
                        value={personal.email}
                        onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))}
                        placeholder="your@email.com" />
                      <button onClick={() => setShowEmail(s => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showEmail ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Phone Number</FieldLabel>
                    <input className={inputCls} value={personal.phone}
                      onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 555 000 0000" />
                  </div>
                </div>
              </>
            )}

            {/* ── STEP: Address ─────────────────────────────────────────── */}
            {step.id === 'identity_address' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Country *</FieldLabel>
                    <input className={inputCls} value={address.location_country}
                      onChange={e => setAddress(a => ({ ...a, location_country: e.target.value }))}
                      placeholder="United States" />
                  </div>
                  <div>
                    <FieldLabel>City</FieldLabel>
                    <input className={inputCls} value={address.location_city}
                      onChange={e => setAddress(a => ({ ...a, location_city: e.target.value }))}
                      placeholder="New York" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Address Line 1</FieldLabel>
                  <input className={inputCls} value={address.address_line1}
                    onChange={e => setAddress(a => ({ ...a, address_line1: e.target.value }))}
                    placeholder="123 Main Street" />
                </div>
                <div>
                  <FieldLabel>Address Line 2 <span className="text-[10px] text-muted-foreground">(optional)</span></FieldLabel>
                  <input className={inputCls} value={address.address_line2}
                    onChange={e => setAddress(a => ({ ...a, address_line2: e.target.value }))}
                    placeholder="Apt 4B, Suite 100..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Postal / ZIP Code</FieldLabel>
                    <input className={inputCls} value={address.postal_code}
                      onChange={e => setAddress(a => ({ ...a, postal_code: e.target.value }))}
                      placeholder="10001" />
                  </div>
                  <div>
                    <FieldLabel>Timezone</FieldLabel>
                    <select className={inputCls} value={address.timezone}
                      onChange={e => setAddress(a => ({ ...a, timezone: e.target.value }))}>
                      {['UTC-8', 'UTC-7', 'UTC-6', 'UTC-5', 'UTC-4', 'UTC+0', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+5:30', 'UTC+8', 'UTC+9', 'UTC+10'].map(tz => (
                        <option key={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP: Professional ────────────────────────────────────── */}
            {step.id === 'identity_professional' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Professional Title</FieldLabel>
                    <input className={inputCls} value={professional.professional_title}
                      onChange={e => setProfessional(p => ({ ...p, professional_title: e.target.value }))}
                      placeholder="Full-Stack Developer" />
                  </div>
                  <div>
                    <FieldLabel>Employer (current)</FieldLabel>
                    <input className={inputCls} value={professional.employer}
                      onChange={e => setProfessional(p => ({ ...p, employer: e.target.value }))}
                      placeholder="Company or Freelance" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Headline (shown on profiles)</FieldLabel>
                  <input className={inputCls} value={professional.headline}
                    onChange={e => setProfessional(p => ({ ...p, headline: e.target.value }))}
                    placeholder="Full-stack dev · 8 yrs exp · React, Node, Python" />
                </div>
                <div>
                  <FieldLabel>Professional Bio</FieldLabel>
                  <textarea rows={3} className={cn(inputCls, 'resize-none')} value={professional.bio}
                    onChange={e => setProfessional(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Brief professional summary used in cover letters and profiles..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Years of Experience</FieldLabel>
                    <input type="number" min="0" max="50" className={inputCls} value={professional.years_experience}
                      onChange={e => setProfessional(p => ({ ...p, years_experience: e.target.value }))}
                      placeholder="8" />
                  </div>
                  <div>
                    <FieldLabel>Min Hourly Rate ($)</FieldLabel>
                    <input type="number" min="0" className={inputCls} value={professional.hourly_rate_min}
                      onChange={e => setProfessional(p => ({ ...p, hourly_rate_min: e.target.value }))}
                      placeholder="25" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Skills <span className="text-[10px] text-muted-foreground">(comma-separated)</span></FieldLabel>
                  <input className={inputCls} value={professional.skills}
                    onChange={e => setProfessional(p => ({ ...p, skills: e.target.value }))}
                    placeholder="React, TypeScript, copywriting, SEO, data entry..." />
                </div>
                <div>
                  <FieldLabel>Languages <span className="text-[10px] text-muted-foreground">(comma-separated)</span></FieldLabel>
                  <input className={inputCls} value={professional.languages}
                    onChange={e => setProfessional(p => ({ ...p, languages: e.target.value }))}
                    placeholder="English, Spanish..." />
                </div>
                <div>
                  <FieldLabel>Work Authorization</FieldLabel>
                  <select className={inputCls} value={professional.work_authorization}
                    onChange={e => setProfessional(p => ({ ...p, work_authorization: e.target.value }))}>
                    <option value="">Select...</option>
                    {['US Citizen', 'Permanent Resident', 'Work Visa', 'OPT/CPT', 'Remote Only (Non-US)', 'EU/EEA Citizen', 'Other'].map(w => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Portfolio URL</FieldLabel>
                    <input className={inputCls} value={professional.portfolio_url}
                      onChange={e => setProfessional(p => ({ ...p, portfolio_url: e.target.value }))}
                      placeholder="https://yourportfolio.com" />
                  </div>
                  <div>
                    <FieldLabel>LinkedIn URL</FieldLabel>
                    <input className={inputCls} value={professional.linkedin_url}
                      onChange={e => setProfessional(p => ({ ...p, linkedin_url: e.target.value }))}
                      placeholder="https://linkedin.com/in/..." />
                  </div>
                </div>
                <div>
                  <FieldLabel>GitHub URL</FieldLabel>
                  <input className={inputCls} value={professional.github_url}
                    onChange={e => setProfessional(p => ({ ...p, github_url: e.target.value }))}
                    placeholder="https://github.com/..." />
                </div>
              </>
            )}

            {/* ── STEP: Payment ─────────────────────────────────────────── */}
            {step.id === 'identity_payment' && (
              <>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(145_100%_50%/0.15)] bg-[hsl(145_100%_50%/0.04)] text-xs text-muted-foreground">
                  <Lock size={12} className="text-[hsl(145,100%,55%)] flex-shrink-0 mt-0.5" />
                  Payment info is stored encrypted. Autopilots use this to configure payout methods when creating platform accounts.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>PayPal Email</FieldLabel>
                    <input className={inputCls} value={payment.payment_paypal}
                      onChange={e => setPayment(p => ({ ...p, payment_paypal: e.target.value }))}
                      placeholder="paypal@email.com" />
                  </div>
                  <div>
                    <FieldLabel>Wise Email</FieldLabel>
                    <input className={inputCls} value={payment.payment_wise}
                      onChange={e => setPayment(p => ({ ...p, payment_wise: e.target.value }))}
                      placeholder="wise@email.com" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Bank Account <span className="text-[10px] text-muted-foreground">(routing + account number)</span></FieldLabel>
                  <input className={inputCls} value={payment.payment_bank_account}
                    onChange={e => setPayment(p => ({ ...p, payment_bank_account: e.target.value }))}
                    placeholder="021000021 / 1234567890" />
                </div>
                <div>
                  <FieldLabel>Crypto Wallet Address <span className="text-[10px] text-muted-foreground">(ETH/ERC-20)</span></FieldLabel>
                  <input className={cn(inputCls, 'font-mono text-xs')} value={payment.payment_crypto_address}
                    onChange={e => setPayment(p => ({ ...p, payment_crypto_address: e.target.value }))}
                    placeholder="0x..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Tax ID / SSN / EIN</FieldLabel>
                    <input className={inputCls} value={payment.tax_id}
                      onChange={e => setPayment(p => ({ ...p, tax_id: e.target.value }))}
                      placeholder="XXX-XX-XXXX" />
                  </div>
                  <div>
                    <FieldLabel>Tax Country</FieldLabel>
                    <input className={inputCls} value={payment.tax_country}
                      onChange={e => setPayment(p => ({ ...p, tax_country: e.target.value }))}
                      placeholder="United States" />
                  </div>
                </div>
              </>
            )}

            {/* ── STEP: Security ────────────────────────────────────────── */}
            {step.id === 'identity_security' && (
              <>
                <div>
                  <FieldLabel>ID Document Type</FieldLabel>
                  <select className={inputCls} value={security.id_document_type}
                    onChange={e => setSecurity(s => ({ ...s, id_document_type: e.target.value }))}>
                    {['passport', "driver's_license", 'national_id', 'state_id', 'residence_permit'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Document Number</FieldLabel>
                    <input className={cn(inputCls, 'font-mono')} value={security.id_document_number}
                      onChange={e => setSecurity(s => ({ ...s, id_document_number: e.target.value }))}
                      placeholder="A12345678" />
                  </div>
                  <div>
                    <FieldLabel>Expiry Date</FieldLabel>
                    <input type="date" className={inputCls} value={security.id_document_expiry}
                      onChange={e => setSecurity(s => ({ ...s, id_document_expiry: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Security Question 1</FieldLabel>
                  <input className={inputCls} value={security.security_question_1}
                    onChange={e => setSecurity(s => ({ ...s, security_question_1: e.target.value }))}
                    placeholder="e.g. What was the name of your first pet?" />
                </div>
                <div>
                  <FieldLabel>Answer 1</FieldLabel>
                  <input className={inputCls} value={security.security_answer_1}
                    onChange={e => setSecurity(s => ({ ...s, security_answer_1: e.target.value }))}
                    placeholder="Answer (stored encrypted)" />
                </div>
                <div>
                  <FieldLabel>Security Question 2</FieldLabel>
                  <input className={inputCls} value={security.security_question_2}
                    onChange={e => setSecurity(s => ({ ...s, security_question_2: e.target.value }))}
                    placeholder="e.g. What city were you born in?" />
                </div>
                <div>
                  <FieldLabel>Answer 2</FieldLabel>
                  <input className={inputCls} value={security.security_answer_2}
                    onChange={e => setSecurity(s => ({ ...s, security_answer_2: e.target.value }))}
                    placeholder="Answer (stored encrypted)" />
                </div>

                {/* Consent gate */}
                <div className="mt-2 p-4 rounded-xl border border-[hsl(265_80%_55%/0.25)] bg-[hsl(265_80%_55%/0.06)]">
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => setIdentityConsent(c => !c)}>
                    <div className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                      identityConsent
                        ? 'bg-[hsl(265_80%_55%/0.4)] border-[hsl(265,80%,70%)]'
                        : 'border-[hsl(var(--border))]'
                    )}>
                      {identityConsent && <Check size={11} className="text-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[hsl(265,80%,70%)] mb-1">Authorization & Consent</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        I authorize VELO 2.0 Autopilots to use my identity data for legitimate job applications, platform account creation, and service registrations on my behalf. I understand all actions are logged in the immutable Audit Log and I can revoke consent at any time from Settings.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP: Documents ───────────────────────────────────────── */}
            {step.id === 'documents' && (
              <>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(50_100%_50%/0.2)] bg-[hsl(50_100%_50%/0.04)] text-xs text-muted-foreground">
                  <Shield size={12} className="text-[hsl(50,100%,60%)] flex-shrink-0 mt-0.5" />
                  Documents are stored in encrypted private storage (identity-docs bucket). Autopilots access them only during verified, consent-approved applications. All uploads are immutable.
                </div>
                <div className="space-y-3">
                  {docs.map(doc => (
                    <div key={doc.key}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-xl border transition-all',
                        doc.status === 'done'  ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.04)]'
                                               : doc.status === 'error' ? 'border-[hsl(0_85%_60%/0.3)] bg-[hsl(0_85%_60%/0.04)]'
                                               : 'border-[hsl(var(--border))] bg-[hsl(228_25%_9%)]'
                      )}>
                      {/* Icon */}
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        doc.status === 'done'  ? 'bg-[hsl(145_100%_50%/0.12)]'
                                               : 'bg-[hsl(228_25%_12%)]')}>
                        {doc.status === 'uploading'
                          ? <RefreshCw size={16} className="animate-spin text-[hsl(185,100%,55%)]" />
                          : doc.status === 'done'
                          ? <CheckCircle size={16} className="text-[hsl(145,100%,55%)]" />
                          : doc.status === 'error'
                          ? <AlertTriangle size={16} className="text-[hsl(0,85%,65%)]" />
                          : doc.key.includes('resume') ? <FileText size={16} className="text-muted-foreground" />
                          : <ImageIcon size={16} className="text-muted-foreground" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{doc.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {doc.status === 'done'   ? <span className="text-[hsl(145,100%,55%)]">✓ Uploaded & stored securely</span>
                           : doc.status === 'uploading' ? 'Encrypting and uploading...'
                           : doc.status === 'error'     ? <span className="text-[hsl(0,85%,65%)]">Upload failed — retry</span>
                           : 'Click to upload · PDF, JPG, PNG accepted'}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {doc.status === 'done' && (
                          <button onClick={() => setDocs(prev => prev.map(d =>
                            d.key === doc.key ? { ...d, status: 'idle', file: undefined, url: undefined } : d
                          ))} className="p-1.5 rounded hover:bg-[hsl(0_85%_60%/0.1)] transition-colors">
                            <Trash2 size={12} className="text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={() => fileInputRefs.current[doc.key]?.click()}
                          disabled={doc.status === 'uploading'}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            doc.status === 'done'
                              ? 'border-[hsl(145_100%_50%/0.3)] text-[hsl(145,100%,55%)] hover:bg-[hsl(145_100%_50%/0.1)]'
                              : 'border-[hsl(185_100%_50%/0.3)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.1)]'
                          )}
                        >
                          {doc.status === 'done' ? 'Replace' : 'Upload'}
                        </button>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          ref={el => { fileInputRefs.current[doc.key] = el; }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(doc.key, f); }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground text-center pt-1">
                  All documents optional — upload what you have. Missing documents will be requested by platforms during account creation.
                </div>
              </>
            )}

            {/* ── STEP: Platforms ───────────────────────────────────────── */}
            {step.id === 'platforms' && (
              <>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(185_100%_50%/0.15)] bg-[hsl(185_100%_50%/0.04)] text-xs text-muted-foreground">
                  <Globe size={12} className="text-[hsl(185,100%,55%)] flex-shrink-0 mt-0.5" />
                  For platforms you already have: enter credentials (stored AES-256 encrypted). For platforms you need: mark as "Need Account" and Autopilot will handle registration when deployed.
                </div>

                <div className="space-y-2">
                  {platforms.map((pl, idx) => {
                    const isExpanded = expandedPlatform === pl.slug;
                    const catColor = pl.category === 'freelance' ? 'text-[hsl(185,100%,55%)]'
                      : pl.category === 'crypto' ? 'text-[hsl(50,100%,60%)]'
                      : pl.category === 'testing' ? 'text-[hsl(145,100%,55%)]'
                      : 'text-[hsl(265,80%,70%)]';

                    const statusColor =
                      pl.status === 'ready'        ? 'border-[hsl(145_100%_50%/0.4)] bg-[hsl(145_100%_50%/0.06)]'
                      : pl.status === 'pending'    ? 'border-[hsl(50_100%_50%/0.3)] bg-[hsl(50_100%_50%/0.04)]'
                      : pl.status === 'needs_account' ? 'border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.04)]'
                      : 'border-[hsl(var(--border))] bg-[hsl(228_25%_9%)]';

                    return (
                      <div key={pl.slug} className={cn('rounded-xl border overflow-hidden transition-all', statusColor)}>
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{pl.name}</span>
                              <span className={cn('text-[10px] uppercase', catColor)}>{pl.category}</span>
                              {pl.status === 'ready'        && <span className="text-[10px] text-[hsl(145,100%,55%)] flex items-center gap-1"><CheckCircle size={9} /> Ready</span>}
                              {pl.status === 'pending'      && <span className="text-[10px] text-[hsl(50,100%,60%)]">⏳ Pending Verification</span>}
                              {pl.status === 'needs_account'&& <span className="text-[10px] text-[hsl(265,80%,70%)]">🤖 Autopilot Will Create</span>}
                              {pl.status === 'skip'         && <span className="text-[10px] text-muted-foreground">—</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">{pl.url.replace('https://', '')}</div>
                          </div>

                          {/* Status buttons */}
                          <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                            {(['skip', 'ready', 'pending', 'needs_account'] as const).map(s => (
                              <button key={s}
                                onClick={() => {
                                  setPlatforms(prev => prev.map((p, i) => i === idx ? { ...p, status: s } : p));
                                  if (s !== 'skip') setExpandedPlatform(pl.slug);
                                  else setExpandedPlatform(e => e === pl.slug ? null : e);
                                }}
                                className={cn(
                                  'text-[9px] px-2 py-1 rounded border transition-all',
                                  pl.status === s
                                    ? s === 'ready'         ? 'bg-[hsl(145_100%_50%/0.15)] border-[hsl(145_100%_50%/0.4)] text-[hsl(145,100%,55%)]'
                                    : s === 'pending'       ? 'bg-[hsl(50_100%_50%/0.15)] border-[hsl(50_100%_50%/0.4)] text-[hsl(50,100%,60%)]'
                                    : s === 'needs_account' ? 'bg-[hsl(265_80%_55%/0.15)] border-[hsl(265_80%_55%/0.4)] text-[hsl(265,80%,70%)]'
                                    : 'bg-[hsl(228_25%_12%)] border-[hsl(var(--border))] text-muted-foreground'
                                    : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
                                )}
                              >
                                {s === 'skip' ? 'Skip' : s === 'ready' ? 'I Have Account' : s === 'pending' ? 'Pending' : 'Need Account'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Credential input (expanded) */}
                        {isExpanded && pl.status !== 'skip' && pl.status !== 'needs_account' && (
                          <div className="border-t border-[hsl(var(--border))] px-4 py-3 space-y-2 bg-[hsl(228_35%_5%/0.6)]">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <FieldLabel hint="🔒">Username / Email</FieldLabel>
                                <input className={inputCls} value={pl.username}
                                  onChange={e => setPlatforms(prev => prev.map((p, i) => i === idx ? { ...p, username: e.target.value } : p))}
                                  placeholder="your@email.com" />
                              </div>
                              <div>
                                <FieldLabel hint="🔒">Password</FieldLabel>
                                <input type="password" className={inputCls} value={pl.password}
                                  onChange={e => setPlatforms(prev => prev.map((p, i) => i === idx ? { ...p, password: e.target.value } : p))}
                                  placeholder="••••••••" />
                              </div>
                            </div>
                            <div>
                              <FieldLabel>Notes <span className="text-[10px] text-muted-foreground">(optional: 2FA status, account tier)</span></FieldLabel>
                              <input className={inputCls} value={pl.notes}
                                onChange={e => setPlatforms(prev => prev.map((p, i) => i === idx ? { ...p, notes: e.target.value } : p))}
                                placeholder="e.g. Top Rated, 2FA via Google Auth..." />
                            </div>
                            <div className="text-[10px] text-[hsl(145,100%,55%)] flex items-center gap-1.5 pt-1">
                              <Lock size={9} /> Credentials will be AES-256 encrypted before storage. Never transmitted in plaintext.
                            </div>
                          </div>
                        )}
                        {isExpanded && pl.status === 'needs_account' && (
                          <div className="border-t border-[hsl(var(--border))] px-4 py-3 bg-[hsl(228_35%_5%/0.6)]">
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              <span className="text-[hsl(265,80%,70%)] font-semibold">Autopilot will:</span> navigate to the signup page, fill the registration form using your identity data, handle email/SMS verification, and store the new credentials in your Vault automatically.
                            </div>
                            <div>
                              <FieldLabel>Additional Notes for Autopilot</FieldLabel>
                              <input className={inputCls} value={pl.notes}
                                onChange={e => setPlatforms(prev => prev.map((p, i) => i === idx ? { ...p, notes: e.target.value } : p))}
                                placeholder="Any special instructions for account creation..." />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  {[
                    { label: 'Have Account',   count: platforms.filter(p => p.status === 'ready').length,         color: 'text-[hsl(145,100%,55%)]' },
                    { label: 'Need Account',   count: platforms.filter(p => p.status === 'needs_account').length,  color: 'text-[hsl(265,80%,70%)]' },
                    { label: 'Skipped',        count: platforms.filter(p => p.status === 'skip').length,           color: 'text-muted-foreground' },
                  ].map(item => (
                    <div key={item.label} className="p-2 rounded-lg bg-[hsl(228_25%_9%)] border border-[hsl(var(--border))]">
                      <div className={cn('text-lg font-black', item.color)}>{item.count}</div>
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── STEP: Autopilot ───────────────────────────────────────── */}
            {step.id === 'autopilot' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Autopilot Name *</FieldLabel>
                    <input autoFocus className={inputCls} value={autopilot.name}
                      onChange={e => setAutopilot(a => ({ ...a, name: e.target.value }))}
                      placeholder="e.g. ARIA-1, NEXUS-7..." />
                  </div>
                  <div>
                    <FieldLabel>Tone</FieldLabel>
                    <select className={inputCls} value={autopilot.tone}
                      onChange={e => setAutopilot(a => ({ ...a, tone: e.target.value }))}>
                      {['professional', 'friendly', 'technical', 'creative', 'concise'].map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel>AI Persona</FieldLabel>
                  <input className={inputCls} value={autopilot.persona}
                    onChange={e => setAutopilot(a => ({ ...a, persona: e.target.value }))}
                    placeholder="e.g. Senior full-stack dev with 8 years experience..." />
                </div>
                <div>
                  <FieldLabel>Profit Categories</FieldLabel>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(cat => {
                      const sel = autopilot.selected_categories.includes(cat);
                      return (
                        <button key={cat} type="button"
                          onClick={() => setAutopilot(a => ({
                            ...a,
                            selected_categories: sel ? a.selected_categories.filter(c => c !== cat) : [...a.selected_categories, cat]
                          }))}
                          className={cn(
                            'text-xs px-2.5 py-1.5 rounded-lg border capitalize transition-all',
                            sel ? 'border-[hsl(185_100%_50%/0.4)] bg-[hsl(185_100%_50%/0.1)] text-[hsl(185,100%,55%)]'
                               : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
                          )}>
                          {sel && <span className="mr-1">✓</span>}{cat.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Max Concurrent Tasks</FieldLabel>
                    <input type="number" min="1" max="50" className={inputCls} value={autopilot.workload_limit}
                      onChange={e => setAutopilot(a => ({ ...a, workload_limit: e.target.value }))}
                      placeholder="10" />
                  </div>
                  <div>
                    <FieldLabel>Risk Tolerance</FieldLabel>
                    <select className={inputCls} value={autopilot.risk_level}
                      onChange={e => setAutopilot(a => ({ ...a, risk_level: e.target.value }))}>
                      <option value="low">Conservative — Verified platforms only</option>
                      <option value="medium">Balanced — Include new platforms</option>
                      <option value="high">Aggressive — All opportunities</option>
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel>Allowed Operations</FieldLabel>
                  <div className="flex gap-2 flex-wrap">
                    {['apply', 'browse', 'fill_forms', 'submit_work', 'create_accounts', 'message_clients'].map(op => {
                      const sel = autopilot.allowed_operations.includes(op);
                      return (
                        <button key={op} type="button"
                          onClick={() => setAutopilot(a => ({
                            ...a,
                            allowed_operations: sel ? a.allowed_operations.filter(o => o !== op) : [...a.allowed_operations, op]
                          }))}
                          className={cn(
                            'text-[11px] px-2 py-1.5 rounded-lg border transition-all',
                            sel ? 'border-[hsl(265_80%_55%/0.4)] bg-[hsl(265_80%_55%/0.1)] text-[hsl(265,80%,70%)]'
                               : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
                          )}>
                          {op.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t border-[hsl(var(--border))] pt-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Profit Engine (optional)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Engine Name</FieldLabel>
                      <input className={inputCls} value={autopilot.engine_name}
                        onChange={e => setAutopilot(a => ({ ...a, engine_name: e.target.value }))}
                        placeholder="e.g. Freelance Blitz..." />
                    </div>
                    <div>
                      <FieldLabel>Engine Goal</FieldLabel>
                      <input className={inputCls} value={autopilot.engine_goal}
                        onChange={e => setAutopilot(a => ({ ...a, engine_goal: e.target.value }))}
                        placeholder="Win 5 gigs per week..." />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP: System Check ────────────────────────────────────── */}
            {step.id === 'system_check' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground">Run a full system scan to verify readiness before launch</div>
                  <button
                    onClick={runReadinessScan}
                    disabled={scanning}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[hsl(185_100%_50%/0.3)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.08)] disabled:opacity-60 transition-colors"
                  >
                    {scanning ? <RefreshCw size={11} className="animate-spin" /> : <Activity size={11} />}
                    {readiness ? 'Re-Scan' : 'Run Scan'}
                  </button>
                </div>

                {scanning && (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <div className="w-10 h-10 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
                    <div className="text-sm text-muted-foreground">Scanning all systems...</div>
                  </div>
                )}

                {readiness && !scanning && (
                  <>
                    {/* Readiness score */}
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_9%)] mb-4">
                      <div className="text-center">
                        <div className="text-3xl font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>
                          {Math.round((readiness.filter(r => r.ok).length / readiness.length) * 100)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Ready</div>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all"
                            style={{ width: `${Math.round((readiness.filter(r => r.ok).length / readiness.length) * 100)}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5">
                          {readiness.filter(r => r.ok).length}/{readiness.length} checks passed
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {readiness.map(item => (
                        <div key={item.label} className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border transition-all',
                          item.ok
                            ? 'border-[hsl(145_100%_50%/0.2)] bg-[hsl(145_100%_50%/0.04)]'
                            : 'border-[hsl(50_100%_50%/0.2)] bg-[hsl(50_100%_50%/0.04)]'
                        )}>
                          {item.ok
                            ? <CheckCircle size={14} className="text-[hsl(145,100%,55%)] flex-shrink-0 mt-0.5" />
                            : <AlertTriangle size={14} className="text-[hsl(50,100%,60%)] flex-shrink-0 mt-0.5" />
                          }
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Warning items */}
                    {readiness.filter(r => !r.ok).length > 0 && (
                      <div className="mt-3 p-3 rounded-xl border border-[hsl(50_100%_50%/0.2)] bg-[hsl(50_100%_50%/0.04)] text-xs text-muted-foreground">
                        <span className="text-[hsl(50,100%,60%)] font-semibold">⚠ {readiness.filter(r => !r.ok).length} items need attention</span> — You can still launch and complete setup later via Identity Studio, Vault, and Platform Registry.
                      </div>
                    )}

                    {readiness.filter(r => !r.ok).length === 0 && (
                      <div className="p-3 rounded-xl border border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)] text-xs text-[hsl(145,100%,55%)] text-center font-semibold">
                        <Star size={13} className="inline mr-1.5" />
                        All systems operational — VELO 2.0 is mission-ready!
                      </div>
                    )}
                  </>
                )}

                {!readiness && !scanning && (
                  <div className="text-center py-8">
                    <Cpu size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                    <div className="text-sm text-muted-foreground mb-1">Ready for final system check?</div>
                    <div className="text-xs text-muted-foreground opacity-70">Click "Run Scan" to verify all systems before launch</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer actions ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.4)]">
            <button
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {!isLast && step.id !== 'identity_personal' && (
                <button onClick={skipStep} className="px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Skip
                </button>
              )}
              <button
                onClick={goNext}
                disabled={!canProceed() || saving || launching}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-40 transition-all min-w-[140px] justify-center"
              >
                {(saving || launching)
                  ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving...</>
                  : isLast
                  ? <><Rocket size={15} /> Launch VELO 2.0</>
                  : <>Save & Continue <ChevronRight size={15} /></>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Bottom hint */}
        <div className="text-center mt-4 text-[11px] text-muted-foreground">
          All data auto-saves per step · Encrypted · Never shared · Deletable anytime from Identity Studio
        </div>
      </div>
    </div>
  );
}
