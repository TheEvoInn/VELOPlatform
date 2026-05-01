import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/AuthPage";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AppRoutes() {
  const { user, loading, login, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Stars */}
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="star absolute"
            style={{
              width: `${Math.random() * 2 + 0.5}px`,
              height: `${Math.random() * 2 + 0.5}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              '--duration': `${Math.random() * 4 + 2}s`,
              '--delay': `${Math.random() * 3}s`,
            } as React.CSSProperties}
          />
        ))}
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-6 relative float-anim">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 opacity-80 blur-md" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
              <span className="text-2xl font-black text-black" style={{ fontFamily: 'Orbitron' }}>V</span>
            </div>
          </div>
          <div className="text-xl font-black text-neon-cyan mb-2" style={{ fontFamily: 'Orbitron' }}>VELO 2.0</div>
          <div className="text-sm text-muted-foreground font-mono">INITIALIZING SYSTEMS<span className="cursor-blink">_</span></div>
          <div className="flex gap-1 justify-center mt-4">
            {[0.0, 0.1, 0.2].map(d => (
              <div key={d} className="w-1.5 h-1.5 rounded-full bg-[hsl(185,100%,55%)] animate-pulse" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onLogin={login} />} />
      <Route
        path="/*"
        element={
          user
            ? <AppLayout user={user} onLogout={logout} pathname={location.pathname} />
            : <Navigate to="/auth" replace />
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import React from 'react';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors closeButton />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
