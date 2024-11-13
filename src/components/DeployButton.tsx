import { Button, useToast, Text, Box } from '@chakra-ui/react';
import { useState } from 'react';
import { getUserSession, hasEnoughNOCC } from '../utils/stacks';
import { validateClarityCode } from '../utils/helper';
import { DeploymentModal } from './DeploymentModal';

interface SwapEstimate {
  noccAmount: number;
  route?: string[];
  swapTxId?: string;
  deployTxId?: string;
}

interface DeploymentInfo {
  contractId: string;
  swapTxId: string;
  deployTxId: string;
  timestamp: number;
}

interface DeployButtonProps {
  contractData: {
    name: string;
    code: string;
  };
  onDeploymentStart: (info: DeploymentInfo) => void;
}

export default function DeployButton({ contractData, onDeploymentStart }: DeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const toast = useToast();

  const validateContract = () => {
    if (!contractData.name?.trim()) {
      throw new Error('Please provide a contract name');
    }

    if (!contractData.name.match(/^[a-zA-Z][\w-]*$/)) {
      throw new Error('Contract name must start with a letter and contain only letters, numbers, and hyphens');
    }

    if (!contractData.code?.trim()) {
      throw new Error('Please provide contract code');
    }

    if (!validateClarityCode(contractData.code)) {
      throw new Error('Invalid Clarity contract code');
    }
  };

  const handleModalOpen = async () => {
    if (!window.navigator.onLine) {
      toast({
        title: 'Network Error',
        description: 'Please check your internet connection before deploying',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }

    const userSession = getUserSession();
    
    if (!userSession?.isUserSignedIn()) {
      toast({
        title: 'Authentication Required',
        description: 'Please connect your wallet to deploy contracts.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }

    try {
      validateContract();
      
      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
      const hasNOCC = await hasEnoughNOCC(senderAddress, 0.1);
      
      if (!hasNOCC) {
        toast({
          title: 'Insufficient NOCC Balance',
          description: 'You need NOCC tokens to deploy contracts.',
          status: 'error',
          duration: 7000,
          isClosable: true,
          position: 'bottom-right',
        });
        return;
      }
      
      setIsModalOpen(true);
    } catch (error: any) {
      toast({
        title: 'Validation Failed',
        description: error.message || 'Please check your contract',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  const handleConfirmFromModal = async (fee: number, swapEstimate: SwapEstimate) => {
    if (!window.navigator.onLine) {
      toast({
        title: 'Network Error',
        description: 'Please check your internet connection before deploying',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }

    const userSession = getUserSession();
    
    if (!userSession?.isUserSignedIn()) {
      toast({
        title: 'Authentication Required',
        description: 'Please connect your wallet to deploy contracts.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
      return;
    }
  
    try {
      validateContract();
      setIsDeploying(true);
      setDeploymentStep('Preparing deployment...');
    
      const userData = userSession.loadUserData();
      const senderAddress = userData.profile.stxAddress.mainnet;
    
      if (!senderAddress || !senderAddress.startsWith('SP')) {
        throw new Error('Invalid wallet address');
      }
    
      setDeploymentStep('Initiating deployment...');

      const contractId = `${senderAddress}.${contractData.name}`;
      
      if (swapEstimate.swapTxId && swapEstimate.deployTxId) {
        onDeploymentStart({
          contractId,
          swapTxId: swapEstimate.swapTxId,
          deployTxId: swapEstimate.deployTxId,
          timestamp: Date.now()
        });
      }

      toast({
        title: 'Deployment Process Started',
        description: 'Check the status cards below for live updates.',
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });

    } catch (error: any) {
      toast({
        title: 'Deployment Error',
        description: error.message || 'An error occurred during deployment',
        status: 'error',
        duration: 7000,
        isClosable: true,
        position: 'bottom-right'
      });
    } finally {
      setIsDeploying(false);
      setDeploymentStep('');
      setIsModalOpen(false);
    }
  };

  return (
    <Box width="full">
      <Button
        variant="primary"
        size="lg"
        width="full"
        onClick={handleModalOpen}
        isLoading={isDeploying}
        loadingText={deploymentStep || "Deploying..."}
        height="54px"
        fontSize="md"
        disabled={!contractData.name || !contractData.code || isDeploying}
        _disabled={{
          opacity: 0.6,
          cursor: 'not-allowed',
          _hover: { bg: 'nocc.button.primary' }
        }}
        _loading={{
          opacity: 0.8,
        }}
      >
        Deploy Contract
      </Button>

      <DeploymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmFromModal}
        contractData={contractData}
      />
      
      {deploymentStep && (
        <Text 
          fontSize="sm" 
          color="nocc.text.secondary"
          textAlign="center"
          fontStyle="italic"
          mt={4}
        >
          {deploymentStep}
        </Text>
      )}
    </Box>
  );
}