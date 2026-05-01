import React, { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Lock, Eye, FileText, Globe, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { giveIdentityConsent } from '@/lib/api';
import { toast } from 'sonner';

interface ConsentGateProps {
  isOpen: boolean;
  onApprove: () => void;
  onDeny: () => void;
  purpose: string;
  platform?: string;
  autopilotName?: string;
  fields?: string[];
}

const FIELD_LABELS: Record<string, { label: string; icon: React.ElementType; sensitive: boolean }> = {
  full_name:        { label: 'Full Name',        icon: FileText, sensitive: false },
  email:            { label: 'Email Address',     icon: Globe,    sensitive: false },
  phone:            { label: 'Phone Number',      icon: Shield,   sensitive: true  },
  headline:         { label: 'Professional Headline', icon: FileText, sensitive: false },
  bio:              { label: 'Bio / About',       icon: FileText, sensitive: false },
  skills:           { label: 'Skills',            icon: FileText, sensitive: false },
  location_country: { label: 'Country',           icon: Globe,    sensitive: false },
  location_city:    { label: 'City',              icon: Globe,    sensitive: false },
  portfolio_url:    { label: 'Portfolio URL',     icon: Globe,    sensitive: false },
  linkedin_url:     { label: 'LinkedIn Profile',  icon: Globe,    sensitive: false },
};

export default function ConsentGate({
  isOpen, onApprove, onDeny, purpose, platform, autopilotName, fields = []
}: ConsentGateProps) {
  const [saving, setSaving] = useState(false);
  const [checkedConsent, setCheckedConsent] = useState(false);

  if (!isOpen) return null;

  const sensitiveFields = fields.filter(f => FIELD_LABELS[f]?.sensitive);

  const handleApprove = async () => {
    if (!checkedConsent) {
      toast.error('Please confirm your consent first');
      return;
    }
    setSaving(true);
    const { error } = await giveIdentityConsent(['applications', 'registration', 'communication']);
    if (error) {
      toast.error('Failed to record consent');
      setSaving(false);
      return;
    }
    toast.success('Consent granted — Autopilot authorized to proceed');
    onApprove();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-lg mx-4 glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.35)] p-0 overflow-hidden slide-in-up shadow-2xl shadow-[hsl(265_80%_55%/0.15)]">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-[hsl(265_80%_30%/0.6)] to-[hsl(185_100%_30%/0.6)] px-6 py-4 border-b border-[hsl(265_80%_55%/0.2)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(265_80%_55%/0.25)] border border-[hsl(265_80%_55%/0.4)] flex items-center justify-center flex-shrink-0">
              <Shield size={20} className="text-[hsl(265,80%,70%)]" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-[hsl(265,80%,80%)]" style={{ fontFamily: 'Orbitron' }}>Identity Authorization Required</div>
              <div className="text-xs text-muted-foreground mt-0.5">Your explicit consent is required before proceeding</div>
            </div>
            <button onClick={onDeny} className="ml-auto p-1.5 rounded-lg hover:bg-[hsl(228_25%_12%)] transition-colors">
              <X size={15} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Request details */}
          <div className="p-4 rounded-xl border border-[hsl(185_100%_50%/0.2)] bg-[hsl(185_100%_50%/0.04)]">
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Authorization Request</div>
            <div className="text-sm font-semibold text-foreground mb-1">{purpose}</div>
            <div className="flex flex-wrap gap-2 text-xs mt-2">
              {autopilotName && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[hsl(265_80%_55%/0.12)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)]">
                  🤖 {autopilotName}
                </span>
              )}
              {platform && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground">
                  <Globe size={10} /> {platform}
                </span>
              )}
            </div>
          </div>

          {/* Fields being shared */}
          {fields.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold flex items-center gap-2">
                <Eye size={11} /> Data to be shared
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {fields.map(f => {
                  const meta = FIELD_LABELS[f] ?? { label: f, icon: FileText, sensitive: false };
                  const Icon = meta.icon;
                  return (
                    <div key={f} className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs',
                      meta.sensitive
                        ? 'border-[hsl(30_100%_55%/0.25)] bg-[hsl(30_100%_55%/0.06)] text-[hsl(30,100%,65%)]'
                        : 'border-[hsl(var(--border))] bg-[hsl(228_25%_10%)] text-muted-foreground'
                    )}>
                      <Icon size={10} className="flex-shrink-0" />
                      <span>{meta.label}</span>
                      {meta.sensitive && <AlertTriangle size={9} className="ml-auto flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
              {sensitiveFields.length > 0 && (
                <div className="mt-2 flex items-start gap-2 text-[11px] text-[hsl(30,100%,60%)]">
                  <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                  <span>Sensitive fields highlighted — used only for this specific action and never stored by third parties.</span>
                </div>
              )}
            </div>
          )}

          {/* Legal notice */}
          <div className="p-3 rounded-lg border border-[hsl(145_100%_50%/0.15)] bg-[hsl(145_100%_50%/0.04)] text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-[hsl(145,100%,55%)]">Legal Notice:</strong> Your identity data will only be used for the purpose described above. VELO 2.0 does not share your information with unauthorized third parties. All access is logged and auditable. You may revoke this consent at any time from the Identity Studio.
          </div>

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <div
              onClick={() => setCheckedConsent(c => !c)}
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                checkedConsent
                  ? 'bg-[hsl(265_80%_55%/0.3)] border-[hsl(265,80%,70%)]'
                  : 'border-[hsl(var(--border))] group-hover:border-[hsl(265_80%_55%/0.4)]'
              )}
            >
              {checkedConsent && <CheckCircle size={13} className="text-[hsl(265,80%,70%)]" />}
            </div>
            <span className="text-xs text-muted-foreground leading-relaxed">
              I confirm that I am providing my real, accurate identity information voluntarily, and I authorize VELO 2.0 to use this data for the purpose stated above in compliance with applicable laws.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onDeny}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground hover:border-[hsl(0_85%_60%/0.3)] transition-colors"
          >
            Deny Access
          </button>
          <button
            onClick={handleApprove}
            disabled={!checkedConsent || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <><Lock size={14} /> Authorize & Proceed</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
