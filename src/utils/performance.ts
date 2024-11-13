export const optimizePerformance = () => {
  if (typeof window === 'undefined') return;

  // Preload critical resources
  const preloadResources = () => {
    // Preload deployer page
    const deployer = document.createElement('link');
    deployer.rel = 'prefetch';
    deployer.href = '/deployer';
    document.head.appendChild(deployer);

    // Preload key images
    const logo = document.createElement('link');
    logo.rel = 'preload';
    logo.as = 'image';
    logo.href = '/nocc-logo.png';
    document.head.appendChild(logo);
  };

  // Execute preloading after initial load
  if (document.readyState === 'complete') {
    preloadResources();
  } else {
    window.addEventListener('load', preloadResources);
  }
}; 