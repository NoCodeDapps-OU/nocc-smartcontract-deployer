import { useRouter } from 'next/router';
import { useEffect } from 'react';

export const usePageTransitions = () => {
  const router = useRouter();

  useEffect(() => {
    const handleStart = () => {
      // Smoother fade out
      document.body.style.transition = 'opacity 0.5s ease-in-out';
      document.body.style.opacity = '0.98';
      document.body.style.pointerEvents = 'none';
    };

    const handleComplete = () => {
      // Smoother fade in with RAF
      requestAnimationFrame(() => {
        document.body.style.transition = 'opacity 0.5s ease-in-out';
        document.body.style.opacity = '1';
        document.body.style.pointerEvents = 'auto';
      });
    };

    const handleError = () => {
      // Reset on error
      document.body.style.transition = 'opacity 0.3s ease-in-out';
      document.body.style.opacity = '1';
      document.body.style.pointerEvents = 'auto';
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    // Preload routes for faster transitions
    router.prefetch('/deployer');
    router.prefetch('/');

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
      
      // Cleanup styles
      document.body.style.transition = '';
      document.body.style.opacity = '1';
      document.body.style.pointerEvents = 'auto';
    };
  }, [router]);
}; 