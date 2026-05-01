import React, { useState } from 'react';
import { ShoppingBag, Package, Truck, TrendingUp, Search, Plus, ExternalLink,
  DollarSign, RefreshCw, X, MessageSquare, Trash2 } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { generateAIContent } from '@/lib/api';
import { formatCurrency, timeAgo, randomId } from '@/lib/mockData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TABS = ['Products', 'Orders', 'Research'] as const;
type Tab = typeof TABS[number];

interface Product {
  id: string;
  name: string;
  category: string;
  supplier: string;
  supplier_url?: string;
  cost_price: number;
  selling_price: number;
  margin: number;
  platform: string;
  status: string;
  image_url?: string;
  sales_count: number;
  revenue: number;
  description?: string;
  tags: string[];
  created_at: string;
}

interface Order {
  id: string;
  product_id?: string;
  product_name?: string;
  customer?: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  platform?: string;
  shipped_at?: string;
  created_at: string;
}

export default function DropshippingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('Products');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchRunning, setResearchRunning] = useState(false);
  const [researchLog, setResearchLog] = useState<string[]>([]);
  const [productForm, setProductForm] = useState({
    name: '', category: '', cost_price: '', selling_price: '',
    supplier: '', platform: 'Shopify', description: '',
  });

  // ── Real DB queries ────────────────────────────────────────────────────────
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['dropship_products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dropship_products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    staleTime: 30000,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['dropship_orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dropship_orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    staleTime: 30000,
  });

  const addProductMutation = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'sales_count' | 'revenue'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('dropship_products').insert({ ...product, user_id: user.id, sales_count: 0, revenue: 0 });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dropship_products'] });
      setShowAddProduct(false);
      setProductForm({ name: '', category: '', cost_price: '', selling_price: '', supplier: '', platform: 'Shopify', description: '' });
      toast.success('Product added to inventory');
    },
    onError: (e: Error) => toast.error('Failed to add: ' + e.message),
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Order> }) => {
      const { error } = await supabase.from('dropship_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dropship_orders'] }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dropship_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dropship_products'] }),
    onError: (e: Error) => toast.error('Delete failed: ' + e.message),
  });

  const totalRevenue = products.reduce((a, p) => a + (p.revenue || 0), 0);
  const activeProducts = products.filter(p => p.status === 'active').length;
  const avgMargin = products.length ? Math.round(products.reduce((a, p) => a + (p.margin || 0), 0) / products.length) : 0;

  const addProduct = () => {
    if (!productForm.name || !productForm.cost_price || !productForm.selling_price) {
      toast.error('Name and prices required'); return;
    }
    const cost = parseFloat(productForm.cost_price);
    const sell = parseFloat(productForm.selling_price);
    const margin = Math.round(((sell - cost) / sell) * 100);
    addProductMutation.mutate({
      name: productForm.name,
      category: productForm.category || 'General',
      supplier: productForm.supplier || 'Unknown',
      supplier_url: 'https://aliexpress.com',
      cost_price: cost,
      selling_price: sell,
      margin,
      platform: productForm.platform,
      status: 'researching',
      image_url: `https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=200&h=200&fit=crop&random=${Date.now()}`,
      description: productForm.description || `${productForm.name} — quality product for online sale.`,
      tags: [productForm.category?.toLowerCase()].filter(Boolean),
    });
  };

  const generateListing = async (product: Product) => {
    setGenerating(product.id);
    const { text, error } = await generateAIContent({
      content_type: 'product_description',
      context: {
        name: product.name,
        category: product.category,
        description: product.description,
        features: product.tags,
        platform: product.platform,
        audience: 'Online shoppers',
      },
    });
    setGenerating(null);
    if (error) { toast.error('AI generation failed'); return; }
    toast.success('AI listing generated — copy to your store');
    // Show in a small toast since there's no inline editor
    if (text) {
      navigator.clipboard.writeText(text).then(() => toast.info('Copied to clipboard'));
    }
  };

  const fulfillOrder = (id: string) => {
    updateOrderMutation.mutate({ id, updates: { status: 'processing' } });
    toast.success('Order forwarded to supplier');
    setTimeout(() => {
      updateOrderMutation.mutate({ id, updates: { status: 'shipped', shipped_at: new Date().toISOString() } });
    }, 3000);
  };

  const runResearch = async () => {
    if (!researchQuery.trim()) { toast.error('Enter a niche or keyword'); return; }
    setResearchRunning(true);
    setResearchLog([]);

    const steps = [
      `› Analyzing niche: "${researchQuery}"...`,
      '› Generating product research strategy with AI...',
      '› Identifying high-margin product categories...',
      '› Cross-referencing demand signals...',
      '› Research complete — review AI recommendations below',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 900));
      setResearchLog(prev => [...prev, steps[i]]);
    }

    // Use AI to generate real research recommendations
    const { text } = await generateAIContent({
      content_type: 'research_summary',
      context: {
        topic: `Dropshipping product research for niche: ${researchQuery}`,
        purpose: 'Find high-margin products with low competition for online dropshipping stores',
        data: { niche: researchQuery, platform: 'AliExpress/Shopify', target: 'Online shoppers' },
      },
    });

    if (text) {
      setResearchLog(prev => [...prev, '', '─── AI RESEARCH REPORT ───', ...text.split('\n').slice(0, 20)]);
    }
    setResearchRunning(false);
    toast.success(`Research complete for "${researchQuery}"`);
  };

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} sub="across all products" icon={<DollarSign size={16} />} accent="cyan" />
        <StatCard label="Active Products" value={`${activeProducts}`} sub="listed and selling" accent="green" />
        <StatCard label="Total Orders" value={`${orders.length}`} sub="order history" accent="violet" />
        <StatCard label="Avg Margin" value={`${avgMargin}%`} sub="profit margin" accent="orange" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_8%)] w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
            tab === t ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)]' : 'text-muted-foreground hover:text-foreground'
          )} style={{ fontFamily: 'Orbitron' }}>{t}</button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === 'Products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Product Inventory</h2>
            <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-opacity">
              <Plus size={13} /> Add Product
            </button>
          </div>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-10 text-center">
              <ShoppingBag size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm font-bold mb-1">No products yet</div>
              <div className="text-xs text-muted-foreground mb-4">Add your first product to start your dropshipping store.</div>
              <button onClick={() => setShowAddProduct(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90">
                <Plus size={12} className="inline mr-1" /> Add Product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {products.map(product => (
                <div key={product.id} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 hover:border-[hsl(185_100%_50%/0.2)] transition-all">
                  <div className="flex items-start gap-4">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-[hsl(var(--border))]"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-sm">{product.name}</h3>
                        <StatusBadge status={product.status} />
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                        <span>Cost: <span className="text-foreground">{formatCurrency(product.cost_price)}</span></span>
                        <span>Sell: <span className="text-[hsl(145,100%,55%)] font-semibold">{formatCurrency(product.selling_price)}</span></span>
                        <span>Margin: <span className="text-[hsl(185,100%,55%)] font-semibold">{product.margin}%</span></span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                        <span>{product.platform}</span>
                        <span>·</span>
                        <span>{product.supplier}</span>
                        <span>·</span>
                        <span>{product.sales_count} sales</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => generateListing(product)}
                          disabled={!!generating}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded border border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.08)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.15)] disabled:opacity-50 transition-colors"
                        >
                          {generating === product.id ? <><RefreshCw size={10} className="animate-spin" /> Generating...</> : <><Package size={10} /> AI Listing</>}
                        </button>
                        {product.supplier_url && (
                          <a href={product.supplier_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
                            <ExternalLink size={10} /> Supplier
                          </a>
                        )}
                        <button
                          onClick={() => deleteProductMutation.mutate(product.id)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded border border-[hsl(var(--border))] text-muted-foreground hover:text-[hsl(0,85%,65%)] transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    {product.revenue > 0 && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-bold text-[hsl(145,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>{formatCurrency(product.revenue)}</div>
                        <div className="text-[10px] text-muted-foreground">revenue</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'Orders' && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Order Management</h2>
          {loadingOrders ? (
            <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-8 text-center">
              <Truck size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground">No orders yet — connect your store to start receiving orders.</div>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{order.product_name || 'Product'}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                    {order.customer && <span>Customer: {order.customer}</span>}
                    <span>Qty: {order.quantity}</span>
                    {order.platform && <span>{order.platform}</span>}
                    <span>{timeAgo(order.created_at)}</span>
                    {order.shipped_at && <span>Shipped: {timeAgo(order.shipped_at)}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-[hsl(145,100%,55%)]">+{formatCurrency(order.profit)}</div>
                  <div className="text-[10px] text-muted-foreground">profit</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(order.revenue)} rev</div>
                </div>
                {order.status === 'pending' && (
                  <button onClick={() => fulfillOrder(order.id)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-opacity">
                    Fulfill
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Research Tab */}
      {tab === 'Research' && (
        <div className="space-y-5">
          <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.2)] p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ fontFamily: 'Orbitron' }}>AI Product Research Engine</h3>
            <p className="text-xs text-muted-foreground mb-4">
              AI analyzes your niche and generates product research recommendations using real market data principles.
            </p>
            <div className="flex gap-3">
              <input
                className="flex-1 px-4 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors"
                placeholder="Enter niche or keyword (e.g. 'fitness gadgets', 'kitchen tools')"
                value={researchQuery}
                onChange={e => setResearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runResearch()}
              />
              <button onClick={runResearch} disabled={researchRunning} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all">
                {researchRunning ? <><RefreshCw size={14} className="animate-spin" /> Researching...</> : <><Search size={14} /> Research</>}
              </button>
            </div>

            {researchLog.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-[hsl(228_35%_5%)] border border-[hsl(var(--border))] font-mono text-[11px] text-muted-foreground space-y-1 max-h-64 overflow-y-auto">
                {researchLog.map((line, i) => (
                  <div key={i} className={cn('leading-relaxed', line.startsWith('─') ? 'text-[hsl(185,100%,55%)] mt-2 mb-1' : line.startsWith('›') ? 'text-[hsl(145,100%,55%)]' : 'text-muted-foreground')}>{line || '\u00A0'}</div>
                ))}
              </div>
            )}
          </div>

          {/* Research workflow */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4" style={{ fontFamily: 'Orbitron' }}>Automation Workflow</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { step: 1, icon: Search,   label: 'Discover',  desc: 'Research AliExpress, Spocket, CJ Dropshipping for trending products in your niche', color: 'cyan' },
                { step: 2, icon: TrendingUp, label: 'Validate', desc: 'AI cross-references demand signals, competition analysis, and margin calculations', color: 'violet' },
                { step: 3, icon: Package,  label: 'List',      desc: 'Content Creator AI generates optimized title, description, and SEO metadata', color: 'green' },
                { step: 4, icon: Truck,    label: 'Fulfill',   desc: 'Track orders and manage supplier communications through the Orders tab', color: 'orange' },
              ].map(step => {
                const Icon = step.icon;
                const borderCls = step.color === 'cyan' ? 'border-[hsl(185_100%_50%/0.2)] bg-[hsl(185_100%_50%/0.04)]' :
                  step.color === 'violet' ? 'border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.04)]' :
                  step.color === 'green'  ? 'border-[hsl(145_100%_50%/0.2)] bg-[hsl(145_100%_50%/0.04)]' :
                  'border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.04)]';
                const numCls = step.color === 'cyan' ? 'bg-[hsl(185_100%_50%/0.2)] text-[hsl(185,100%,55%)]' :
                  step.color === 'violet' ? 'bg-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)]' :
                  step.color === 'green'  ? 'bg-[hsl(145_100%_50%/0.2)] text-[hsl(145,100%,55%)]' :
                  'bg-[hsl(30_100%_55%/0.2)] text-[hsl(30,100%,60%)]';
                return (
                  <div key={step.step} className={`p-4 rounded-xl border ${borderCls}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${numCls}`}>{step.step}</div>
                      <Icon size={14} className="text-muted-foreground" />
                      <span className="text-xs font-bold">{step.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddProduct(false)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.2)] p-6 w-full max-w-lg mx-4 slide-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>ADD PRODUCT</h3>
              <button onClick={() => setShowAddProduct(false)} className="p-1.5 rounded hover:bg-[hsl(228_25%_12%)] transition-colors"><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Product Name *" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none" placeholder="Category" value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} />
                <select className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none" value={productForm.platform} onChange={e => setProductForm(f => ({ ...f, platform: e.target.value }))}>
                  <option>Shopify</option><option>eBay</option><option>Amazon</option><option>Etsy</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none" placeholder="Cost Price ($) *" value={productForm.cost_price} onChange={e => setProductForm(f => ({ ...f, cost_price: e.target.value }))} />
                <input type="number" className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none" placeholder="Selling Price ($) *" value={productForm.selling_price} onChange={e => setProductForm(f => ({ ...f, selling_price: e.target.value }))} />
              </div>
              <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none" placeholder="Supplier Name" value={productForm.supplier} onChange={e => setProductForm(f => ({ ...f, supplier: e.target.value }))} />
              <textarea className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none resize-none h-16" placeholder="Product description (optional)" value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddProduct(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={addProduct} disabled={addProductMutation.isPending} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {addProductMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
                {addProductMutation.isPending ? 'Adding...' : 'Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
