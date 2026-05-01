import React, { useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, DollarSign, RefreshCw, Send } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import { withdrawFunds } from '@/lib/api';
import { useTransactions, QUERY_KEYS } from '@/hooks/useSharedData';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'earning' | 'withdrawal' | 'bonus' | 'fee';
  amount: number;
  currency: string;
  description: string;
  status: string;
  created_at: string;
}

function formatCurrency(n: number) {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WalletPage() {
  const qc = useQueryClient();
  const { data: rawTxns = [], isLoading: loading } = useTransactions();
  const transactions = rawTxns as Transaction[];

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDesc, setWithdrawDesc] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const confirmed = transactions.filter(t => t.status === 'confirmed');
  const totalEarned = confirmed.filter(t => ['earning', 'bonus'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = confirmed.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0);
  const pendingEarnings = transactions.filter(t => t.status === 'pending' && ['earning', 'bonus'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const availableBalance = totalEarned - totalWithdrawn;

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > availableBalance) { toast.error('Insufficient balance'); return; }
    setWithdrawing(true);
    const { data, error } = await withdrawFunds(amount, withdrawDesc || 'Manual withdrawal');
    if (error) {
      toast.error('Withdrawal failed: ' + error);
    } else {
      toast.success(`Withdrawal of ${formatCurrency(amount)} initiated`);
      setShowWithdraw(false);
      setWithdrawAmount('');
      qc.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
    }
    setWithdrawing(false);
  };

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Earned"  value={formatCurrency(totalEarned)}        sub="all-time profits"       icon={<DollarSign size={16} />} accent="green" />
        <StatCard label="Available"     value={formatCurrency(availableBalance)}    sub="ready to withdraw"      accent="cyan" />
        <StatCard label="Pending"       value={formatCurrency(pendingEarnings)}     sub="awaiting confirmation"  accent="orange" />
        <StatCard label="Withdrawn"     value={formatCurrency(totalWithdrawn)}      sub="total paid out"         accent="violet" />
      </div>

      {/* Balance card */}
      <div className="glass-panel rounded-2xl border border-[hsl(185_100%_50%/0.2)] p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 pointer-events-none" />
        <div className="relative">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1" style={{ fontFamily: 'Orbitron' }}>Available Balance</div>
          <div className="text-5xl font-black text-neon-cyan mb-1" style={{ fontFamily: 'Orbitron' }}>
            {formatCurrency(availableBalance)}
          </div>
          <div className="text-sm text-muted-foreground mb-5">
            + {formatCurrency(pendingEarnings)} pending
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWithdraw(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-all"
            >
              <Send size={14} /> Withdraw
            </button>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: QUERY_KEYS.transactions })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>Transaction Ledger</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-10 text-center">
            <Wallet size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
            <div className="text-sm text-muted-foreground">No transactions yet. Complete tasks to earn profits.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-4">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  ['earning', 'bonus'].includes(tx.type) ? 'bg-[hsl(145_100%_50%/0.15)]' :
                  tx.type === 'withdrawal' ? 'bg-[hsl(0_85%_60%/0.12)]' : 'bg-[hsl(265_80%_55%/0.12)]'
                )}>
                  {tx.type === 'withdrawal'
                    ? <ArrowUpRight size={15} className="text-[hsl(0,85%,65%)]" />
                    : <ArrowDownLeft size={15} className="text-[hsl(145,100%,55%)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-0.5 truncate">{tx.description || tx.type}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{tx.type}</span>
                    <span>·</span>
                    <span>{timeAgo(tx.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={tx.status} />
                  <div className={cn(
                    'text-base font-black',
                    tx.type === 'withdrawal' ? 'text-[hsl(0,85%,65%)]' : 'text-[hsl(145,100%,55%)]'
                  )} style={{ fontFamily: 'Orbitron' }}>
                    {tx.type === 'withdrawal' ? '-' : '+'}{formatCurrency(tx.amount)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{tx.currency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw modal */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowWithdraw(false)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.2)] p-6 w-full max-w-sm mx-4 slide-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4 text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>WITHDRAW FUNDS</h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Amount (USD)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground mt-1">Available: {formatCurrency(availableBalance)}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Description (optional)</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors"
                  placeholder="Withdrawal reason..."
                  value={withdrawDesc}
                  onChange={e => setWithdrawDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowWithdraw(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleWithdraw} disabled={withdrawing} className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {withdrawing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {withdrawing ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
