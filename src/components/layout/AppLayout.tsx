import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StarfieldCanvas from './StarfieldCanvas';
import OnboardingFlow from '@/components/features/OnboardingFlow';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useTaskEarnings } from '@/hooks/useTaskEarnings';
import type { User } from '@/types';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EnginesPage = lazy(() => import('@/pages/EnginesPage'));
const AutopilotsPage = lazy(() => import('@/pages/AutopilotsPage'));
const OpportunitiesPage = lazy(() => import('@/pages/OpportunitiesPage'));
const MissionControlPage = lazy(() => import('@/pages/MissionControlPage'));
const WalletPage = lazy(() => import('@/pages/WalletPage'));
const VaultPage = lazy(() => import('@/pages/VaultPage'));
const IdentityStudioPage = lazy(() => import('@/pages/IdentityStudioPage'));
const ContentCreatorPage = lazy(() => import('@/pages/ContentCreatorPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const SafetyPage = lazy(() => import('@/pages/SafetyPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const CryptoProfitPage = lazy(() => import('@/pages/CryptoProfitPage'));
const DropshippingPage = lazy(() => import('@/pages/DropshippingPage'));
const MatchingSystemPage = lazy(() => import('@/pages/MatchingSystemPage'));
const BrowserAutomationPage = lazy(() => import('@/pages/BrowserAutomationPage'));
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'));
const PlatformRegistryPage = lazy(() => import('@/pages/PlatformRegistryPage'));
const DeveloperConsolePage = lazy(() => import('@/pages/DeveloperConsolePage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
    </div>
  );
}

interface AppLayoutProps {
  user: User;
  onLogout: () => void;
  pathname: string;
}

export default function AppLayout({ user, onLogout, pathname }: AppLayoutProps) {
  const { needsOnboarding, isLoading: onboardingLoading, completeStep, skipOnboarding } = useOnboarding();
  // Real-world earnings pipeline — auto-logs wallet entries when sessions complete
  useTaskEarnings(true);

  return (
    <div className="flex h-screen overflow-hidden relative">
      <StarfieldCanvas />

      {/* Onboarding overlay */}
      {!onboardingLoading && needsOnboarding && (
        <OnboardingFlow onComplete={skipOnboarding} onSkip={skipOnboarding} />
      )}

      <Sidebar user={user} onLogout={onLogout} />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <TopBar user={user} pathname={pathname} />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/engines" element={<EnginesPage />} />
              <Route path="/autopilots" element={<AutopilotsPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/matching" element={<MatchingSystemPage />} />
              <Route path="/mission-control" element={<MissionControlPage />} />
              <Route path="/automation" element={<BrowserAutomationPage />} />
              <Route path="/identity" element={<IdentityStudioPage />} />
              <Route path="/content" element={<ContentCreatorPage />} />
              <Route path="/crypto" element={<CryptoProfitPage />} />
              <Route path="/dropshipping" element={<DropshippingPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/vault" element={<VaultPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/safety" element={<SafetyPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/platforms" element={<PlatformRegistryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dev-console" element={<DeveloperConsolePage />} />
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
