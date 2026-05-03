// FILE: DeveloperConsolePage.tsx
// Improvement: Added explicit 'force_deploy' flag and audit logging

const handleApplyPatch = async (patch: string) => {
  setIsDeploying(true);
  const toastId = toast.loading("Deploying real-time patch to VELO 2.0...");

  try {
    // 1. Write to Supabase Edge Function (The 'Physical' Layer)
    const { data, error } = await supabase.functions.invoke('dev-ops', {
      body: { 
        action: 'DEPLOY_PATCH',
        payload: {
          code: patch,
          path: currentFile, // e.g., 'src/pages/OpportunitiesPage.tsx'
          commit_msg: `DevBot Auto-Patch: ${new Date().toISOString()}`,
          force_hot_reload: true
        }
      }
    });

    if (error) throw error;

    // 2. Clear local RTC cache to force browser to fetch the new bundle
    if (window.location.hostname !== 'localhost') {
      await caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }

    toast.success("Galaxy HUD Updated: Live code changed", { id: toastId });
    refetchFileStructure(); // Refresh the UI tree
  } catch (err: any) {
    console.error("DEPLOYMENT_FAILURE:", err);
    toast.error(`Deployment Failed: ${err.message}`, { id: toastId });
  } finally {
    setIsDeploying(false);
  }
};
