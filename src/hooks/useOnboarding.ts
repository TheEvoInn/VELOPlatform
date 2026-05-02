import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getOnboardingProgress, upsertOnboardingProgress } from '@/lib/api';

export interface OnboardingState {
  isLoading: boolean;
  needsOnboarding: boolean;
  currentStep: string;
  completedSteps: string[];
  isComplete: boolean;
}

const ONBOARDING_STEPS = [
  'identity_personal',
  'identity_address',
  'identity_professional',
  'identity_payment',
  'identity_security',
  'documents',
  'platforms',
  'autopilot',
  'system_check',
];

// Old onboarding steps (v1) — users who completed these need to be shown the new wizard
const LEGACY_STEPS = ['workspace', 'profile', 'engine'];

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    isLoading: true,
    needsOnboarding: false,
    currentStep: 'workspace',
    completedSteps: [],
    isComplete: false,
  });

  useEffect(() => {
    let mounted = true;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setState(s => ({ ...s, isLoading: false }));
        return;
      }
      const { data } = await getOnboardingProgress();
      if (mounted) {
        if (!data) {
          // First time user — needs onboarding
          setState({
            isLoading: false,
            needsOnboarding: true,
            currentStep: 'identity_personal',
            completedSteps: [],
            isComplete: false,
          });
        } else {
          // Check if this is a legacy completed onboarding (v1) that needs the new wizard
          const completedSteps: string[] = data.completed_steps || [];
          const hasNewSteps = completedSteps.some(s => ONBOARDING_STEPS.includes(s));
          const isLegacyComplete = data.is_complete && !hasNewSteps && completedSteps.some(s => LEGACY_STEPS.includes(s));

          setState({
            isLoading: false,
            // Legacy users always need the new onboarding; new users check is_complete
            needsOnboarding: isLegacyComplete ? false : !data.is_complete,
            currentStep: data.current_step || 'identity_personal',
            completedSteps,
            isComplete: data.is_complete || false,
          });
        }
      }
    }
    check();
    return () => { mounted = false; };
  }, []);

  const completeStep = async (step: string) => {
    const newCompleted = [...new Set([...state.completedSteps, step])];
    const stepIndex = ONBOARDING_STEPS.indexOf(step);
    const nextStep = ONBOARDING_STEPS[stepIndex + 1] || 'done';
    const isComplete = newCompleted.length >= ONBOARDING_STEPS.length;

    setState(s => ({
      ...s,
      completedSteps: newCompleted,
      currentStep: nextStep,
      isComplete,
      needsOnboarding: !isComplete,
    }));

    await upsertOnboardingProgress({
      completed_steps: newCompleted,
      current_step: nextStep,
      is_complete: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
    });
  };

  const skipOnboarding = async () => {
    setState(s => ({ ...s, needsOnboarding: false, isComplete: true }));
    await upsertOnboardingProgress({
      completed_steps: ONBOARDING_STEPS,
      current_step: 'done',
      is_complete: true,
      completed_at: new Date().toISOString(),
    });
  };

  return { ...state, completeStep, skipOnboarding, ONBOARDING_STEPS };
}
