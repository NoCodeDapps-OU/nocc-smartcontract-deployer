import { Button, useToast, Text, Box } from '@chakra-ui/react';
import { useState } from 'react';
import { getUserSession, hasEnoughNOCC } from '../utils/stacks';
import { velarDeploymentService } from '../services/velar-deployment';
import { validateClarityCode } from '../utils/helper';
import { DeploymentModal } from './DeploymentModal';

interface SwapEstimate {
  noccAmount: number;
  route?: string[];
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

interface CustomError extends Error {
  type?: string;
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
      
      // Check NOCC balance before proceeding
      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
      const hasNOCC = await hasEnoughNOCC(senderAddress, 0.1); // Check for minimum balance
      
      if (!hasNOCC) {
        toast({
            title: 'Insufficient NOCC Balance',
            description: 'You need NOCC tokens to deploy contracts. Please acquire some NOCC tokens before proceeding.',
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
    console.log('Modal confirmed with:', { fee, swapEstimate });
    await handleDeploy(fee, swapEstimate);
  };  
  
  const handleDeploy = async (fee: number, swapEstimate: SwapEstimate) => {
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
    
      if (!swapEstimate) {
        throw new Error('No swap estimate available');
      }
    
      setIsDeploying(true);
      setDeploymentStep('Preparing deployment...');
    
      const userData = userSession.loadUserData();
      const senderAddress = userData.profile.stxAddress.mainnet;
    
      console.log('Deploying with address:', senderAddress);
    
      if (!senderAddress || !senderAddress.startsWith('SP')) {
        throw new Error('Invalid wallet address. Please ensure you are connected with a mainnet wallet.');
      }
    
      setDeploymentStep('Initiating NOCC swap for deployment fees...');
      
      const result = await velarDeploymentService.deployContract({
        contractName: contractData.name,
        contractCode: contractData.code,
        senderAddress: senderAddress,
        senderKey: userData.appPrivateKey || '',
        selectedFee: fee,
        swapEstimate: swapEstimate
      });

      onDeploymentStart({
        contractId: result.contractId,
        swapTxId: result.swapTxId,
        deployTxId: result.deployTxId,
        timestamp: Date.now()
      });

      toast({
        title: 'Deployment Process Started',
        description: 'Check the status cards below for live updates.',
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });

    } catch (error: unknown) {
      console.error('Deployment error:', error);
      
      const customError = error as CustomError;
      
      if (customError?.type === 'CANCELLED') {
        toast({
          title: 'Transaction Cancelled',
          description: 'The deployment process was cancelled by user.',
          status: 'info',
          duration: 5000,
          isClosable: true,
          position: 'bottom-right',
        });
        return;
      }
      
      toast({
        title: 'Deployment Failed',
        description: customError.message || 'An error occurred during deployment',
        status: 'error',
        duration: 7000,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsDeploying(false);
      setDeploymentStep('');
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