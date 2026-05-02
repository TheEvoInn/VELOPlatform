
/**
 * VELO 2.0 — Unified Document Upload Hook
 * Handles all document uploads: file → storage → metadata → identity sync → vault reference
 *
 * Fixes:
 * - Uploads File directly (no fetch(URL.createObjectURL()) roundtrip)
 * - Saves metadata to user_documents table for cross-module sync
 * - Updates user_identity.has_id_document on ID uploads
 * - Saves encrypted storage path reference to credentials vault
 * - Full retry logic with exponential backoff
 * - Descriptive error messages at every stage
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { upsertUserIdentity } from '@/lib/api';
import { getVaultKey, encryptVaultValue } from '@/lib/vaultCrypto';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DocumentUploadOptions {
  /** Unique key for this document slot, e.g. 'gov_id_front', 'resume' */
  docKey?: string;
  /** Human-readable label */
  docLabel?: string;
  /** Document type category */
  docType?: 'government_id' | 'proof_of_address' | 'resume' | 'portfolio' | 'certificate' | 'other';
  /** Where the upload was initiated */
  source?: 'vault' | 'onboarding' | 'identity_studio';
  /** If true, encrypt the storage path in credentials table */
  saveToVault?: boolean;
  /** If true, marks user_identity.has_id_document = true on success */
  isIdDocument?: boolean;
  /** Maximum retries (default 3) */
  maxRetries?: number;
}

/** Options that can be passed at upload-call time to override hook-level options */
export interface UploadCallOptions {
  docKey?: string;
  docLabel?: string;
  docType?: DocumentUploadOptions['docType'];
  isIdDocument?: boolean;
  source?: DocumentUploadOptions['source'];
}

export interface DocumentUploadState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  progress: number;
  storageUrl?: string;
  storagePath?: string;
  error?: string;
  credentialId?: string;
}

export interface UploadedDocument {
  id: string;
  doc_key: string;
  doc_type: string;
  doc_label: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  verification_status: string;
  source: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowed file types & limits (must match bucket configuration)
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — matches bucket limit

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useDocumentUpload(options: DocumentUploadOptions = {}) {
  const [state, setState] = useState<DocumentUploadState>({ status: 'idle', progress: 0 });
  const abortRef = useRef<boolean>(false);

  // Store mutable options in a ref so upload() always reads the latest values
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const upload = useCallback(async (file: File, callOptions?: UploadCallOptions): Promise<boolean> => {
    // Merge hook-level options with call-time overrides — call-time wins
    const resolvedDocKey      = callOptions?.docKey      ?? optionsRef.current.docKey      ?? 'document';
    const resolvedDocLabel    = callOptions?.docLabel    ?? optionsRef.current.docLabel    ?? 'Document';
    const resolvedDocType     = callOptions?.docType     ?? optionsRef.current.docType     ?? 'other';
    const resolvedIsIdDocument = callOptions?.isIdDocument ?? optionsRef.current.isIdDocument ?? false;
    const resolvedSource      = callOptions?.source      ?? optionsRef.current.source      ?? 'vault';

    // Destructure `maxRetries` and `saveToVault` from `optionsRef.current`
    const { maxRetries = 3, saveToVault = true } = optionsRef.current;

    abortRef.current = false;

    // ── 1. Validate file ─────────────────────────────────────────────────
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const msg = `File type "${file.type}" not allowed. Use JPG, PNG, WEBP, or PDF.`;
      setState({ status: 'error', progress: 0, error: msg });
      toast.error(msg);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      const msg = `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`;
      setState({ status: 'error', progress: 0, error: msg });
      toast.error(msg);
      return false;
    }
    if (file.size === 0) {
      const msg = 'File is empty — please select a valid document.';
      setState({ status: 'error', progress: 0, error: msg });
      toast.error(msg);
      return false;
    }

    setState({ status: 'uploading', progress: 10 });
    console.log(`[useDocumentUpload] Starting upload: ${file.name} (${file.size} bytes, ${file.type})`);

    // ── 2. Get authenticated user ─────────────────────────────────────────
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      const msg = 'Authentication required — please log in again.';
      setState({ status: 'error', progress: 0, error: msg });
      toast.error(msg);
      return false;
    }

    // ── 3. Build storage path (matches RLS policy pattern) ────────────────
    // Policy requires: folder[1] = 'identity-documents', folder[2] = user.id
    // Use stable key (no timestamp) so re-uploads replace the same file via upsert
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeKey = resolvedDocKey.replace(/[^a-z0-9_-]/gi, '_');
    const storagePath = `identity-documents/${user.id}/${safeKey}.${ext}`;

    setState(s => ({ ...s, progress: 20 }));

    // ── 4. Upload to Supabase Storage with retry ──────────────────────────
    let uploadError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (abortRef.current) return false;

      console.log(`[useDocumentUpload] Upload attempt ${attempt}/${maxRetries}: ${storagePath}`);
      setState(s => ({ ...s, progress: 20 + attempt * 15 }));

      const { error } = await supabase.storage
        .from('identity-docs')
        .upload(storagePath, file, {           // Upload File directly — File IS a Blob
          contentType: file.type,
          upsert: true,
        });

      if (!error) {
        uploadError = null;
        console.log(`[useDocumentUpload] Storage upload successful on attempt ${attempt}`);
        break;
      }

      uploadError = new Error(error.message);
      console.error(`[useDocumentUpload] Upload attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }

    if (uploadError) {
      const msg = `Storage upload failed: ${uploadError.message}. Check your connection and try again.`;
      setState({ status: 'error', progress: 0, error: msg });
      toast.error(msg);
      return false;
    }

    setState(s => ({ ...s, progress: 65 }));

    // ── 5. Save document metadata to user_documents table ────────────────
    const { error: metaError } = await supabase
      .from('user_documents')
      .upsert({
        user_id: user.id,
        doc_key: resolvedDocKey,
        doc_type: resolvedDocType,
        doc_label: resolvedDocLabel,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        verification_status: 'uploaded',
        source: resolvedSource,
        metadata: {
          uploaded_at: new Date().toISOString(),
          original_name: file.name,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,doc_key' });

    if (metaError) {
      console.error('[useDocumentUpload] Metadata save error:', metaError.message);
      // Don't fail the entire upload for metadata save — log and continue
      toast.warning('Document uploaded but metadata save incomplete — document is still stored safely.');
    }

    setState(s => ({ ...s, progress: 80 }));

    // ── 6. Update identity flag for government ID types ──────────────────
    if (resolvedIsIdDocument || resolvedDocType === 'government_id') {
      const { error: identErr } = await supabase
        .from('user_identity')
        .upsert(
          { user_id: user.id, has_id_document: true, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (identErr) {
        console.error('[useDocumentUpload] Identity sync error:', identErr.message);
        // Non-fatal — continue
      } else {
        console.log('[useDocumentUpload] has_id_document set to true');
      }
    }

    setState(s => ({ ...s, progress: 88 }));

    // ── 7. Save encrypted path reference to Credentials Vault ────────────
    // Use a STABLE credential name (docKey-based, not filename-based) so re-uploads
    // always upsert the same credential entry instead of creating duplicates
    let credentialId: string | undefined;
    if (saveToVault) {
      const stableCredName = `[ID Vault] ${resolvedDocLabel}`;
      const credType = (resolvedIsIdDocument || resolvedDocType === 'government_id') ? 'id_document' : 'document';

      try {
        const vaultKey = await getVaultKey(user.id, user.email ?? user.id);
        const encryptedPath = await encryptVaultValue(storagePath, vaultKey);

        const { data: credData, error: credError } = await supabase
          .from('credentials')
          .upsert({
            user_id: user.id,
            name: stableCredName,
            type: credType,
            platform: 'Identity Vault',
            encrypted_data: encryptedPath,
            is_encrypted: true,
            last_accessed: new Date().toISOString(),
          }, { onConflict: 'user_id,name' })
          .select('id')
          .single();

        if (credError) {
          console.error('[useDocumentUpload] Vault credential save error:', credError.message);
          toast.warning('Document stored in storage, but Vault reference save failed. Document is safe.');
        } else {
          credentialId = credData?.id;
          console.log('[useDocumentUpload] Vault credential created/updated:', credentialId);
        }
      } catch (vaultErr) {
        console.error('[useDocumentUpload] Vault encryption error:', vaultErr);
        toast.warning('Document stored. Vault encryption unavailable in this browser — stored as reference only.');

        // Fallback: save unencrypted path reference (still private via RLS)
        const { data: credData } = await supabase
          .from('credentials')
          .upsert({
            user_id: user.id,
            name: stableCredName,
            type: credType,
            platform: 'Identity Vault',
            encrypted_data: btoa(storagePath),
            is_encrypted: false,
          }, { onConflict: 'user_id,name' })
          .select('id')
          .single();
        credentialId = credData?.id;
      }
    }

    setState(s => ({ ...s, progress: 100 }));

    // ── 8. Get public/signed URL ─────────────────────────────────────────
    // Bucket is private, so we get a signed URL (valid 1hr for preview)
    const { data: signedUrlData } = await supabase.storage
      .from('identity-docs')
      .createSignedUrl(storagePath, 3600);

    const storageUrl = signedUrlData?.signedUrl;

    setState({
      status: 'done',
      progress: 100,
      storageUrl,
      storagePath,
      credentialId,
    });

    console.log('[useDocumentUpload] Complete:', { storagePath, credentialId });
    return true;

  }, []); // Empty dependency array as optionsRef.current is stable within the callback

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({ status: 'idle', progress: 0 });
  }, []);

  return { state, upload, reset };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Fetch user's documents
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserDocuments(): Promise<{ data: UploadedDocument[]; error: string | null }> {
  const { data, error } = await supabase
    .from('user_documents')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: (data as UploadedDocument[]) ?? [], error: error?.message ?? null };
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('identity-docs')
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function deleteDocument(docKey: string, storagePath: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Remove from storage
  const { error: storageErr } = await supabase.storage
    .from('identity-docs')
    .remove([storagePath]);

  if (storageErr) {
    console.error('[deleteDocument] Storage removal error:', storageErr.message);
    return { error: `Storage removal failed: ${storageErr.message}` };
  }

  // Remove metadata record
  await supabase
    .from('user_documents')
    .delete()
    .eq('user_id', user.id)
    .eq('doc_key', docKey);

  return { error: null };
}
