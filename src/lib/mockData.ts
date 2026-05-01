/**
 * VELO 2.0 — Utility helpers only.
 * All mock/fake/placeholder data has been removed.
 * The platform runs exclusively on real backend data via Supabase.
 */

// ─── Formatting helpers ───────────────────────────────────────────────────────
export function formatCurrency(amount: number, currency = 'USD'): string {
  if (currency === 'USD' || currency === 'USD/hr') {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.abs(amount).toFixed(2)} ${currency}`;
}

export function timeAgo(isoString: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Clears all legacy localStorage mock data keys on first run.
 * Called once from main.tsx to ensure a clean real-world state.
 */
export function clearLegacyMockData(): void {
  const LEGACY_KEYS = [
    'velo_auth', 'velo_engines', 'velo_autopilots', 'velo_opportunities',
    'velo_tasks', 'velo_wallet', 'velo_transactions', 'velo_credentials',
    'velo_crypto_tasks', 'velo_wallet_addresses', 'velo_dropship_products',
    'velo_dropship_orders', 'velo_automation_sessions',
  ];
  LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
}
