import { Button, useToast } from '@chakra-ui/react';
import { useConnect } from '@stacks/connect-react';
import { getUserSession } from '../utils/stacks';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function useWalletConnect() {
  const { doOpenAuth } = useConnect();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userSession = getUserSession();
      if (userSession?.isUserSignedIn()) {
        // Start transition
        setIsTransitioning(true);
        
        // Pre-load the deployer page
        router.prefetch('/deployer');
        
        // Smooth transition with animation
        setTimeout(() => {
          router.replace('/deployer', undefined, { 
            shallow: true,
            scroll: false 
          });
        }, 100);
      } else {
        setIsLoading(false);
      }
    }
  }, [router]);

  const handleConnect = async () => {
    try {
      setIsTransitioning(true);
      await doOpenAuth();
      
      // After successful auth, transition smoothly
      document.body.style.transition = 'opacity 0.5s ease-in-out';
      document.body.style.opacity = '0.98';
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Navigate
      await router.replace('/deployer', undefined, { 
        shallow: true,
        scroll: false 
      });
      
      // Restore opacity
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });
    } catch (error) {
      setIsTransitioning(false);
      document.body.style.opacity = '1';
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect wallet. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  const handleDisconnect = () => {
    const userSession = getUserSession();
    if (userSession?.isUserSignedIn()) {
      setIsTransitioning(true);
      userSession.signUserOut();
      
      // Smooth transition out
      document.body.style.transition = 'opacity 0.5s ease-in-out';
      document.body.style.opacity = '0.98';
      
      setTimeout(() => {
        router.replace('/', undefined, { 
          shallow: true,
          scroll: false 
        });
      }, 100);
    }
  };

  return {
    handleConnect,
    handleDisconnect,
    isLoading,
    isTransitioning
  };
}

export default function ConnectWallet() {
  const { handleConnect, isLoading, isTransitioning } = useWalletConnect();

  if (isLoading) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="primary"
          size="lg"
          onClick={handleConnect}
          px={8}
          py={6}
          fontSize="lg"
          mt={4}
          bg="#FF9F0A"
          color="black"
          opacity={isTransitioning ? 0.7 : 1}
          transition="all 0.3s ease-in-out"
          _hover={{
            bg: '#FFB340',
            transform: 'translateY(-2px)'
          }}
          _active={{
            bg: '#F59300',
            transform: 'translateY(0)'
          }}
          disabled={isTransitioning}
        >
          Connect Wallet
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
