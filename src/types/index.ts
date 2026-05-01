// VELO 2.0 - Complete Type Definitions

export type AutopilotStatus = 'active' | 'idle' | 'running' | 'paused' | 'error';
export type EngineStatus = 'active' | 'paused' | 'stopped' | 'running';
export type OpportunityCategory = 'freelance' | 'gig' | 'crypto' | 'dropshipping' | 'contest' | 'remote_job' | 'bounty';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  inviteCode?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: string;
}

export interface ProfitEngine {
  id: string;
  name: string;
  goal: string;
  config: Record<string, unknown>;
  audience: string;
  channels: string[];
  status: EngineStatus;
  totalEarned: number;
  runsCompleted: number;
  lastRun?: string;
  createdAt: string;
  category: OpportunityCategory;
}

export interface Autopilot {
  id: string;
  name: string;
  avatar: string;
  persona: string;
  tone: 'professional' | 'friendly' | 'technical' | 'creative';
  status: AutopilotStatus;
  engineId?: string;
  skills: string[];
  allowedCategories: OpportunityCategory[];
  workloadLimit: number;
  currentWorkload: number;
  totalEarned: number;
  tasksCompleted: number;
  createdAt: string;
  behaviorRules: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  platform: string;
  category: OpportunityCategory;
  estimatedValue: number;
  currency: string;
  effort: 'low' | 'medium' | 'high';
  deadline?: string;
  requirements: string[];
  confidence: ConfidenceLevel;
  url: string;
  status: 'new' | 'matched' | 'applied' | 'in_progress' | 'completed' | 'rejected';
  matchedAutopilotId?: string;
  scannedAt: string;
  description: string;
}

export interface Task {
  id: string;
  name: string;
  type: string;
  status: TaskStatus;
  autopilotId?: string;
  opportunityId?: string;
  engineId?: string;
  priority: number;
  progress: number;
  logs: TaskLog[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  retries: number;
}

export interface TaskLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface WalletTransaction {
  id: string;
  type: 'earning' | 'withdrawal' | 'bonus';
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'confirmed' | 'failed';
  relatedTaskId?: string;
  createdAt: string;
}

export interface Credential {
  id: string;
  name: string;
  type: 'login' | 'api_key' | 'wallet_key' | 'document' | 'certificate' | 'work_sample';
  platform?: string;
  isEncrypted: boolean;
  lastAccessed?: string;
  createdAt: string;
}

export interface AIIdentity {
  id: string;
  name: string;
  avatar: string;
  persona: string;
  tone: string;
  writingStyle: string;
  brandingColor: string;
  behaviorRules: string[];
  allowedCategories: OpportunityCategory[];
  workloadLimit: number;
  templates: {
    coverLetter: string;
    resume: string;
    messageTemplate: string;
  };
}

export interface WalletSummary {
  totalEarned: number;
  availableBalance: number;
  pendingEarnings: number;
  totalWithdrawn: number;
  currency: string;
}

// ─── Crypto Module ────────────────────────────────────────────────────────────
export type CryptoTaskType = 'airdrop' | 'testnet' | 'free_mint' | 'bounty' | 'quest';
export type CryptoTaskStatus = 'upcoming' | 'active' | 'in_progress' | 'completed' | 'expired' | 'claimed';

export interface CryptoTask {
  id: string;
  title: string;
  protocol: string;
  network: string;
  type: CryptoTaskType;
  estimatedValue: number;
  currency: string;
  status: CryptoTaskStatus;
  requirements: string[];
  steps: string[];
  deadline?: string;
  eligibility: 'eligible' | 'ineligible' | 'checking' | 'unknown';
  walletRequired: boolean;
  gasRequired?: string;
  confidence: ConfidenceLevel;
  claimedAt?: string;
  description: string;
  url: string;
}

export interface WalletAddress {
  id: string;
  label: string;
  address: string;
  network: string;
  balance?: string;
  isDefault: boolean;
}

// ─── Dropshipping Module ──────────────────────────────────────────────────────
export type DropshipOrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'refunded' | 'cancelled';
export type DropshipProductStatus = 'researching' | 'listed' | 'active' | 'paused' | 'discontinued';

export interface DropshipProduct {
  id: string;
  name: string;
  category: string;
  supplier: string;
  supplierUrl: string;
  costPrice: number;
  sellingPrice: number;
  margin: number;
  platform: string;
  status: DropshipProductStatus;
  imageUrl: string;
  salesCount: number;
  revenue: number;
  description: string;
  tags: string[];
  createdAt: string;
}

export interface DropshipOrder {
  id: string;
  productId: string;
  productName: string;
  customer: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  status: DropshipOrderStatus;
  platform: string;
  createdAt: string;
  shippedAt?: string;
}

export interface DropshipSupplier {
  id: string;
  name: string;
  url: string;
  country: string;
  rating: number;
  minOrder: number;
  shippingTime: string;
  categories: string[];
  productsFound: number;
}

// ─── Matching System ──────────────────────────────────────────────────────────
export interface MatchScore {
  opportunityId: string;
  autopilotId: string;
  totalScore: number;
  skillScore: number;
  categoryScore: number;
  effortScore: number;
  deadlineScore: number;
  confidence: ConfidenceLevel;
  recommendation: 'top' | 'secondary' | 'low';
  reasons: string[];
}

// ─── Browser Automation ───────────────────────────────────────────────────────
export type AutomationStatus = 'idle' | 'running' | 'completed' | 'failed' | 'captcha' | 'rate_limited';

export interface AutomationSession {
  id: string;
  name: string;
  platform: string;
  status: AutomationStatus;
  steps: AutomationStep[];
  currentStep: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retries: number;
}

export interface AutomationStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  action: 'navigate' | 'click' | 'fill' | 'upload' | 'submit' | 'extract' | 'wait' | 'screenshot';
  target?: string;
  value?: string;
  completedAt?: string;
  error?: string;
}
