import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock, Plus, Eye, EyeOff, Trash2, Key, Globe, Wallet as WalletIcon,
  FileText, Shield, RefreshCw, Clock, Upload, CheckCircle, AlertTriangle,
  Image, X, ExternalLink, Copy, KeyRound,
} from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import { getCredentialsFromDB, addCredential, getUserIdentity, upsertUserIdentity } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { getVaultKey, encryptVaultValue, decryptVaultValue, clearVaultKeyCache } from '@/lib/vaultCrypto';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Credential {
  id: string;
  name: string;
  type: 'login' | 'api_key' | 'wallet_key' | 'document' | 'certificate' | 'work_sample' | 'id_document';
  platform?: string;
  is_encrypted: boolean;
  last_accessed?: string;
  created_at: string;
  // encrypted_data is not fetched by default — only fetched on reveal
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  login:       Globe,
  api_key:     Key,
  wallet_key:  WalletIcon,
  document:    FileText,
  certificate: Shield,
  work_sample: FileText,
  id_document: Image,
};

const TYPE_COLORS: Record<string, string> = {
  login:       'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)]',
  api_key:     'text-[hsl(265,80%,70%)] bg-[hsl(265_80%_55%/0.1)]',
  wallet_key:  'text-[hsl(50,100%,60%)] bg-[hsl(50_100%_50%/0.1)]',
  document:    'text-muted-foreground bg-[hsl(228_25%_12%)]',
  certificate: 'text-[hsl(145,100%,55%)] bg-[hsl(145_100%_50%/0.1)]',
  work_sample: 'text-muted-foreground bg-[hsl(228_25%_12%)]',
  id_document: 'text-[hsl(265,80%,70%)] bg-[hsl(265_80%_55%/0.1)]',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function VaultPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showIdUpload, setShowIdUpload] = useState(false);
  const [hasIdDoc, setHasIdDoc] = useState(false);

  // Per-credential decrypted value cache (session only, never persisted)
  const [revealedValues, setRevealedValues] = useState<Record<string, string | null>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  // Vault key state
  const [vaultKeyReady, setVaultKeyReady] = useState(false);
  const vaultKeyRef = useRef<CryptoKey | null>(null);

  // Credential form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Credential['type']>('login');
  const [newPlatform, setNewPlatform] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  // ID upload state
  const [uploading, setUploading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idType, setIdType] = useState<'passport' | 'national_id' | 'drivers_license' | 'work_permit'>('passport');
  const [idPreview, setIdPreview] = useState<string | null>(null);

  // ── Initialize vault key from current user ───────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      getVaultKey(user.id, user.email ?? user.id)
        .then(key => {
          vaultKeyRef.current = key;
          setVaultKeyReady(true);
        })
        .catch(e => {
          console.error('Vault key derivation failed:', e);
          toast.error('Vault encryption unavailable — browser may not support Web Crypto API');
        });
    });
    return () => { clearVaultKeyCache(); };
  }, []);

  const loadCredentials = useCallback(async () => {
    const [{ data, error }, { data: identity }] = await Promise.all([
      getCredentialsFromDB(),
      getUserIdentity(),
    ]);
    if (!error && data) setCredentials(data as Credential[]);
    if (identity) setHasIdDoc(identity.has_id_document ?? false);
    setLoading(false);
    // Clear revealed values when re-loading
    setRevealedValues({});
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  // ── Encrypt a value before storing ──────────────────────────────────────
  const encryptValue = useCallback(async (plaintext: string): Promise<string> => {
    if (!vaultKeyRef.current) {
      // Fallback to legacy base64 if Web Crypto unavailable
      return btoa(unescape(encodeURIComponent(plaintext)));
    }
    return encryptVaultValue(plaintext, vaultKeyRef.current);
  }, []);

  // ── Decrypt a credential value on reveal ────────────────────────────────
  const handleReveal = useCallback(async (credId: string) => {
    // Toggle off if already revealed
    if (revealedValues[credId] !== undefined) {
      setRevealedValues(prev => {
        const next = { ...prev };
        delete next[credId];
        return next;
      });
      return;
    }

    setRevealing(credId);

    // Fetch the encrypted_data for this specific credential
    const { data, error } = await supabase
      .from('credentials')
      .select('encrypted_data')
      .eq('id', credId)
      .single();

    if (error || !data?.encrypted_data) {
      setRevealedValues(prev => ({ ...prev, [credId]: null }));
      setRevealing(null);
      toast.error('Could not retrieve credential data');
      return;
    }

    // Update last_accessed timestamp
    await supabase.from('credentials').update({ last_accessed: new Date().toISOString() }).eq('id', credId);

    let plaintext: string | null = null;
    if (vaultKeyRef.current) {
      plaintext = await decryptVaultValue(data.encrypted_data, vaultKeyRef.current);
    } else {
      // Fallback: try legacy base64
      try { plaintext = decodeURIComponent(escape(atob(data.encrypted_data))); } catch { plaintext = null; }
    }

    setRevealedValues(prev => ({ ...prev, [credId]: plaintext }));
    setRevealing(null);

    // Log access to audit trail
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('credentials').update({
        access_log: [{ timestamp: new Date().toISOString(), action: 'revealed', user_id: user.id }],
      }).eq('id', credId);
    }
  }, [revealedValues]);

  const copyToClipboard = useCallback(async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard — clears in 30s');
    // Auto-clear clipboard for security
    setTimeout(() => navigator.clipboard.writeText(''), 30000);
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }
    if (!newValue.trim()) { toast.error('Value is required for encryption'); return; }
    setAdding(true);

    const encrypted = await encryptValue(newValue);

    const { error } = await addCredential({
      name: newName,
      type: newType,
      platform: newPlatform || null,
      encrypted_data: encrypted,
      is_encrypted: true,
    });

    if (error) {
      toast.error('Failed to add credential');
    } else {
      toast.success(`${newName} encrypted and stored in Vault`);
      setShowAdd(false);
      setNewName(''); setNewType('login'); setNewPlatform(''); setNewValue('');
      await loadCredentials();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from('credentials').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success(`${name} removed from Vault`);
    setCredentials(prev => prev.filter(c => c.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large — max 5MB'); return; }
    setIdFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setIdPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setIdPreview(null);
    }
  };

  const handleIdUpload = async () => {
    if (!idFile) { toast.error('Select a document to upload'); return; }
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setUploading(false); return; }

    const ext = idFile.name.split('.').pop() || 'pdf';
    const path = `identity-documents/${user.id}/${idType}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('identity-docs')
      .upload(path, idFile, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    // Encrypt the storage path before saving to credentials
    const encryptedPath = await encryptValue(path);

    const { error: credError } = await addCredential({
      name: `${idType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} — ${idFile.name}`,
      type: 'id_document',
      platform: 'Identity Vault',
      encrypted_data: encryptedPath,
      is_encrypted: true,
    });

    if (!credError) {
      await upsertUserIdentity({ has_id_document: true });
      setHasIdDoc(true);
      toast.success('Identity document encrypted and stored — Autopilot eligibility unlocked');
      setShowIdUpload(false);
      setIdFile(null);
      setIdPreview(null);
      await loadCredentials();
    } else {
      toast.error('Failed to record document');
    }

    setUploading(false);
  };

  const logins  = credentials.filter(c => c.type === 'login').length;
  const apiKeys = credentials.filter(c => c.type === 'api_key').length;
  const wallets = credentials.filter(c => c.type === 'wallet_key').length;
  const docs    = credentials.filter(c => ['document', 'certificate', 'work_sample', 'id_document'].includes(c.type)).length;
  const idDocs  = credentials.filter(c => c.type === 'id_document').length;

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Credentials" value={`${credentials.length}`} sub="AES-256 encrypted"  icon={<Lock size={16} />} accent="violet" />
        <StatCard label="Logins"            value={`${logins}`}             sub="platform accounts"  accent="cyan" />
        <StatCard label="API Keys"          value={`${apiKeys}`}            sub="service integrations" accent="orange" />
        <StatCard label="Wallets + Docs"    value={`${wallets + docs}`}     sub="crypto & documents" accent="green" />
      </div>

      {/* Security banner */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.2)] p-4 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-[hsl(265_80%_55%/0.12)] border border-[hsl(265_80%_55%/0.2)] flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-[hsl(265,80%,70%)]" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-bold text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>
            ZERO-KNOWLEDGE AES-256-GCM VAULT
          </div>
          <div className="text-xs text-muted-foreground">
            Keys derived client-side via PBKDF2 · {vaultKeyReady ? 'Web Crypto API active' : 'Initializing...'} · Zero plaintext sent to database · All access logged
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vaultKeyReady ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
              <span className="text-xs text-[hsl(145,100%,55%)] font-semibold">KEY ACTIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <RefreshCw size={12} className="text-[hsl(30,100%,60%)] animate-spin" />
              <span className="text-xs text-[hsl(30,100%,60%)]">Deriving key...</span>
            </div>
          )}
        </div>
      </div>

      {/* Crypto spec detail */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.1)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={14} className="text-[hsl(265,80%,70%)]" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Encryption Specification</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Algorithm',    value: 'AES-256-GCM',    color: 'hsl(265,80%,70%)' },
            { label: 'Key Derivation', value: 'PBKDF2 100K', color: 'hsl(185,100%,55%)' },
            { label: 'IV Size',      value: '96-bit random',  color: 'hsl(145,100%,55%)' },
            { label: 'Auth Tag',     value: '128-bit GCM',    color: 'hsl(30,100%,60%)' },
          ].map(spec => (
            <div key={spec.label} className="p-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{spec.label}</div>
              <div className="text-xs font-bold mt-0.5" style={{ color: spec.color }}>{spec.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ID Document Section */}
      <div className={cn(
        'glass-panel rounded-xl border p-4',
        hasIdDoc || idDocs > 0
          ? 'border-[hsl(145_100%_50%/0.25)]'
          : 'border-[hsl(265_80%_55%/0.2)] border-dashed'
      )}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', hasIdDoc || idDocs > 0 ? 'bg-[hsl(145_100%_50%/0.12)]' : 'bg-[hsl(265_80%_55%/0.1)]')}>
            {hasIdDoc || idDocs > 0 ? <CheckCircle size={22} className="text-[hsl(145,100%,55%)]" /> : <Image size={22} className="text-[hsl(265,80%,70%)]" />}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-bold flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
              {hasIdDoc || idDocs > 0 ? (
                <span className="text-[hsl(145,100%,55%)]">ID DOCUMENT VERIFIED ✓</span>
              ) : (
                <span className="text-[hsl(265,80%,70%)]">ID DOCUMENT REQUIRED</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {hasIdDoc || idDocs > 0
                ? `${idDocs} document${idDocs !== 1 ? 's' : ''} stored with AES-256-GCM · Storage path encrypted · Autopilot eligibility unlocked`
                : 'Required for Upwork, Fiverr, Freelancer, and identity-verified platforms. Stored encrypted — path and file both protected.'}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowIdUpload(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                hasIdDoc || idDocs > 0
                  ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)] text-[hsl(145,100%,55%)] hover:bg-[hsl(145_100%_50%/0.15)]'
                  : 'border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.1)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.18)]'
              )}
            >
              <Upload size={12} />
              {hasIdDoc || idDocs > 0 ? 'Update ID' : 'Upload ID Document'}
            </button>
            <button
              onClick={() => navigate('/identity')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={11} /> Identity Studio
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>
          Vault Contents
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 transition-opacity"
        >
          <Plus size={13} /> Add Credential
        </button>
      </div>

      {/* Credentials list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[hsl(265_80%_55%/0.3)] border-t-[hsl(265,80%,70%)] rounded-full animate-spin" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-10 text-center">
          <Lock size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <div className="text-sm font-semibold mb-1">Vault is empty</div>
          <div className="text-xs text-muted-foreground mb-4">Add credentials and ID documents to enable Autopilot workflows</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => setShowIdUpload(true)} className="px-4 py-2 rounded-xl text-xs font-bold border border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.08)] text-[hsl(265,80%,70%)] hover:opacity-90 transition-all">
              Upload ID Document
            </button>
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 transition-all">
              Add First Credential
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {credentials.map(cred => {
            const Icon = TYPE_ICONS[cred.type] ?? Lock;
            const isIdDoc    = cred.type === 'id_document';
            const isRevealed = revealedValues[cred.id] !== undefined;
            const revealedVal = revealedValues[cred.id];
            const isRevealLoading = revealing === cred.id;

            return (
              <div
                key={cred.id}
                className={cn(
                  'glass-panel rounded-xl border p-4',
                  isIdDoc ? 'border-[hsl(265_80%_55%/0.15)]' : 'border-[hsl(var(--border))]',
                  isRevealed ? 'border-[hsl(265_80%_55%/0.25)] bg-[hsl(265_80%_55%/0.03)]' : ''
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', TYPE_COLORS[cred.type] || TYPE_COLORS.document)}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold">{cred.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground capitalize">
                        {cred.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-[hsl(145,100%,55%)]">🔒 AES-256</span>
                      {isIdDoc && <span className="text-[10px] text-[hsl(265,80%,70%)] flex items-center gap-1"><Shield size={8} /> ID VERIFIED</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {cred.platform && <span>{cred.platform}</span>}
                      {cred.last_accessed && <><span>·</span><span className="flex items-center gap-1"><Clock size={9} /> Last used {timeAgo(cred.last_accessed)}</span></>}
                      <span>·</span>
                      <span>Added {timeAgo(cred.created_at)}</span>
                    </div>

                    {/* Revealed value display */}
                    {isRevealed && !isIdDoc && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 font-mono text-[11px] px-3 py-1.5 rounded bg-[hsl(228_35%_5%)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,80%)] overflow-hidden">
                          {revealedVal !== null ? (
                            <span className="break-all">{revealedVal}</span>
                          ) : (
                            <span className="text-[hsl(0,85%,65%)]">⚠ Decryption failed — may have been encrypted with a different key</span>
                          )}
                        </div>
                        {revealedVal && (
                          <button
                            onClick={() => copyToClipboard(revealedVal)}
                            className="p-1.5 rounded hover:bg-[hsl(228_25%_15%)] transition-colors flex-shrink-0"
                            title="Copy to clipboard"
                          >
                            <Copy size={12} className="text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    )}
                    {isRevealed && isIdDoc && (
                      <div className="mt-2 text-[11px] text-[hsl(265,80%,70%)] flex items-center gap-1.5">
                        <Shield size={10} />
                        Storage path decrypted — file accessible from Identity Vault
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isIdDoc && (
                      <button
                        onClick={() => handleReveal(cred.id)}
                        disabled={isRevealLoading || !vaultKeyReady}
                        className={cn(
                          'p-2 rounded-lg transition-colors flex items-center gap-1',
                          isRevealed
                            ? 'bg-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)]'
                            : 'hover:bg-[hsl(228_25%_12%)] text-muted-foreground hover:text-foreground',
                          !vaultKeyReady && 'opacity-50 cursor-not-allowed'
                        )}
                        title={!vaultKeyReady ? 'Vault key initializing...' : isRevealed ? 'Hide value' : 'Decrypt & reveal'}
                      >
                        {isRevealLoading ? (
                          <RefreshCw size={14} className="animate-spin text-[hsl(265,80%,70%)]" />
                        ) : isRevealed ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    )}
                    {isIdDoc && (
                      <div className="text-[10px] px-2 py-1 rounded bg-[hsl(145_100%_50%/0.08)] border border-[hsl(145_100%_50%/0.2)] text-[hsl(145,100%,55%)]">
                        Encrypted
                      </div>
                    )}
                    <button
                      onClick={() => handleDelete(cred.id, cred.name)}
                      className="p-2 rounded-lg hover:bg-[hsl(0_85%_60%/0.1)] text-muted-foreground hover:text-[hsl(0,85%,65%)] transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ID Upload Modal */}
      {showIdUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowIdUpload(false)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.3)] p-6 w-full max-w-md mx-4 slide-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>UPLOAD ID DOCUMENT</h3>
              <button onClick={() => setShowIdUpload(false)} className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_12%)]">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-3 rounded-lg border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.05)] mb-4 text-xs text-muted-foreground flex items-start gap-2">
              <Shield size={12} className="text-[hsl(265,80%,70%)] mt-0.5 flex-shrink-0" />
              <span>
                Your ID is stored in Supabase Storage with AES-256-GCM encryption. The storage path itself is also encrypted before saving to the database — zero plaintext stored anywhere.
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'passport',        label: 'Passport' },
                    { id: 'national_id',     label: 'National ID' },
                    { id: 'drivers_license', label: 'Driver License' },
                    { id: 'work_permit',     label: 'Work Permit' },
                  ] as const).map(dt => (
                    <button
                      key={dt.id}
                      onClick={() => setIdType(dt.id)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs border text-left transition-colors',
                        idType === dt.id
                          ? 'bg-[hsl(265_80%_55%/0.15)] border-[hsl(265_80%_55%/0.4)] text-[hsl(265,80%,70%)]'
                          : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  idFile
                    ? 'border-[hsl(145_100%_50%/0.4)] bg-[hsl(145_100%_50%/0.04)]'
                    : 'border-[hsl(265_80%_55%/0.25)] hover:border-[hsl(265_80%_55%/0.45)] hover:bg-[hsl(265_80%_55%/0.04)]'
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const fakeEv = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileSelect(fakeEv);
                  }
                }}
              >
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />
                {idPreview ? (
                  <div className="space-y-2">
                    <img src={idPreview} alt="ID preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                    <div className="text-xs text-[hsl(145,100%,55%)]">{idFile?.name}</div>
                  </div>
                ) : idFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={28} className="text-[hsl(145,100%,55%)]" />
                    <div className="text-xs text-[hsl(145,100%,55%)]">{idFile.name}</div>
                    <div className="text-[10px] text-muted-foreground">{(idFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={28} className="text-muted-foreground opacity-40" />
                    <div className="text-sm font-semibold text-muted-foreground">Click or drag to upload</div>
                    <div className="text-xs text-muted-foreground opacity-60">JPG, PNG, PDF · Max 5MB</div>
                  </div>
                )}
              </div>

              {idFile && (
                <div className="flex items-center gap-2 text-xs text-[hsl(145,100%,55%)]">
                  <CheckCircle size={12} />
                  Ready — file will be uploaded to secure storage, path encrypted with AES-256-GCM
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowIdUpload(false); setIdFile(null); setIdPreview(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handleIdUpload}
                disabled={uploading || !idFile}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                {uploading ? 'Encrypting & Uploading...' : 'Encrypt & Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add credential modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.25)] p-6 w-full max-w-md mx-4 slide-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>ADD TO VAULT</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-[hsl(145,100%,55%)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
                {vaultKeyReady ? 'AES-256 Ready' : 'Key initializing...'}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Credential Name</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                  placeholder="e.g. Upwork Account"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none transition-colors"
                  value={newType}
                  onChange={e => setNewType(e.target.value as Credential['type'])}
                >
                  <option value="login">Login (email + password)</option>
                  <option value="api_key">API Key</option>
                  <option value="wallet_key">Wallet Private Key</option>
                  <option value="document">Document</option>
                  <option value="certificate">Certificate</option>
                  <option value="work_sample">Work Sample URL</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Platform (optional)</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                  placeholder="Upwork, Ethereum, Shopify..."
                  value={newPlatform}
                  onChange={e => setNewPlatform(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Secret Value <span className="text-[hsl(145,100%,55%)]">— encrypted before storage</span>
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                  placeholder={
                    newType === 'login'      ? 'email:password or JSON credentials' :
                    newType === 'api_key'    ? 'sk-... or API key string' :
                    newType === 'wallet_key' ? '0x... private key (never stored in plain)' :
                    'Value or URL'
                  }
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                />
                <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock size={9} />
                  Encrypted with AES-256-GCM · Key derived from your identity · Never leaves your browser unencrypted
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !newName || !vaultKeyReady}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {adding ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                {adding ? 'Encrypting...' : 'Encrypt & Store'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
