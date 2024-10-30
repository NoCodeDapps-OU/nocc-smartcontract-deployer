import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Text,
    useToast,
    VStack,
    Alert,
    AlertIcon,
  } from '@chakra-ui/react';
  import { useEffect, useState, useRef } from 'react';
  import { GasFeeSelector } from './GasFeeSelector';
  import { getUserSession } from '../utils/stacks';
  import { hasEnoughNOCC } from '../utils/stacks';

  interface SwapEstimate {
    noccAmount: number;
    route?: string[];
  }
  
  interface DeploymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (fee: number, swapEstimate: SwapEstimate) => void;
    contractData: {
      name: string;
      code: string;
    };
  }
  
  const STX_MICRO_MULTIPLIER = 1_000_000; // STX has 6 decimals
  
  const BalanceWarning: React.FC<{ noccAmount: number }> = ({ noccAmount }) => {
    const [hasBalance, setHasBalance] = useState<boolean>(true);
    
    useEffect(() => {
      const checkBalance = async () => {
        const userSession = getUserSession();
        if (userSession?.isUserSignedIn()) {
          const address = userSession.loadUserData().profile.stxAddress.mainnet;
          const sufficient = await hasEnoughNOCC(address, noccAmount);
          setHasBalance(sufficient);
        }
      };
      
      checkBalance();
    }, [noccAmount]);

    if (hasBalance) return null;

    return (
      <Alert status="warning" variant="left-accent">
        <AlertIcon />
        <VStack align="start" spacing={1}>
          <Text fontWeight="bold">Insufficient NOCC Balance</Text>
          <Text fontSize="sm">
            You need at least {noccAmount.toFixed(3)} NOCC tokens to proceed with this deployment.
            Please acquire NOCC tokens before attempting to deploy.
          </Text>
        </VStack>
      </Alert>
    );
  };
  
  export const DeploymentModal: React.FC<DeploymentModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    contractData,
  }) => {
    const [selectedFee, setSelectedFee] = useState<number>(0);
    const [currentSwapEstimate, setCurrentSwapEstimate] = useState<SwapEstimate | null>(null);
  
    const selectedFeeRef = useRef<number>(0);
    const currentSwapEstimateRef = useRef<SwapEstimate | null>(null);
  
    const toast = useToast();
  
    const handleFeeAndEstimateSelect = (fee: number, estimate: SwapEstimate) => {
      console.log('Selected:', { fee, noccAmount: estimate.noccAmount });
      setSelectedFee(fee);
      setCurrentSwapEstimate(estimate);
      selectedFeeRef.current = fee;
      currentSwapEstimateRef.current = estimate;
    };
  
    const feeInSTX = selectedFee / STX_MICRO_MULTIPLIER;
    const isFeeValid = feeInSTX >= 0.5;
  
    const handleConfirm = () => {
      if (!currentSwapEstimateRef.current) {
        console.error('No swap estimate available');
        toast({
            title: 'No Swap Estimate',
            description: 'Please select a gas fee to proceed.',
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'bottom-right',
        });
        return;
      }
  
      if (!isFeeValid) {
        toast({
            title: 'Invalid Gas Fee',
            description: 'Gas fee cannot be less than 0.5 STX.',
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'bottom-right',
        });
        return;
      }
  
      console.log('Confirming with exact values:', {
        selectedFee: selectedFeeRef.current,
        noccAmount: currentSwapEstimateRef.current.noccAmount,
        route: currentSwapEstimateRef.current.route,
      });
  
      onConfirm(selectedFeeRef.current, currentSwapEstimateRef.current);
      onClose();
    };
  
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
            <ModalOverlay backdropFilter="blur(4px)" />
            <ModalContent bg="gray.900" border="1px" borderColor="gray.700">
                <ModalHeader 
              borderBottom="1px" 
              borderColor="gray.700"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <VStack align="flex-start" spacing={1}>
                <Text>Deploy Contract</Text>
                <Text fontSize="sm" color="gray.400">
                  Select gas fee and confirm deployment
                </Text>
              </VStack>
            </ModalHeader>
    
            <ModalBody py={6}>
              <GasFeeSelector
                contractCode={contractData.code}
                contractData={contractData}
                onFeeSelect={handleFeeAndEstimateSelect}
              />
            </ModalBody>
    
            <ModalFooter 
        borderTop="1px" 
        borderColor="gray.700" 
        gap={3}
        px={6}
        py={4}
      >
        <Button 
          variant="ghost" 
          onClick={onClose}
          color="gray.300"
          _hover={{
            bg: 'transparent',
            color: 'red.500',
          }}
          _active={{
            bg: 'transparent',
            color: 'red.600',
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          isDisabled={!selectedFee || !currentSwapEstimate || !isFeeValid}
          height="54px"
          width="200px"
          fontSize="md"
          bg="#FF9F0A"
          color="black"
          _hover={{
            bg: '#FFB340',
            _disabled: {
              bg: '#FF9F0A',
              opacity: 0.6,
            }
          }}
          _active={{
            bg: '#F59300',
          }}
          _disabled={{
            opacity: 0.6,
            cursor: 'not-allowed',
          }}
        >
          Confirm & Deploy
        </Button>
      </ModalFooter>
    </ModalContent>
    </Modal>
  );
};