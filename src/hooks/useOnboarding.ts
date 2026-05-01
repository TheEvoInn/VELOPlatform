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
  'workspace',
  'profile',
  'autopilot',
  'identity',
  'vault',
  'wallet',
  'categories',
  'engine',
];

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
            currentStep: 'workspace',
            completedSteps: [],
            isComplete: false,
          });
        } else {
          setState({
            isLoading: false,
            needsOnboarding: !data.is_complete,
            currentStep: data.current_step || 'workspace',
            completedSteps: data.completed_steps || [],
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
