import { createStandaloneToast } from '@chakra-ui/react';

const { toast } = createStandaloneToast();

export const ensureStacksProvider = () => {
  if (typeof window === 'undefined') return;

  try {
    if (!(window as any).StacksProvider) {
      Object.defineProperty(window, 'StacksProvider', {
        configurable: true,
        writable: true,
        value: null
      });
    }
  } catch (error) {
    toast({
      title: 'Provider Notice',
      description: 'Stacks provider already exists',
      status: 'info',
      duration: 3000,
      isClosable: true,
      position: 'bottom-right'
    });
  }
};

export const getStacksProvider = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    return (window as any).StacksProvider || 
           (window as any).LeatherProvider || 
           (window as any)?.XverseProviders?.StacksProvider;
  } catch (error) {
    toast({
      title: 'Provider Error',
      description: 'Error accessing Stacks provider',
      status: 'error',
      duration: 5000,
      isClosable: true,
      position: 'bottom-right'
    });
    return null;
  }
}; 