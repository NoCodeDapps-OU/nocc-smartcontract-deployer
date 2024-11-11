import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  Box,
  HStack,
  RadioGroup,
  Radio,
  Alert,
  AlertIcon,
  NumberInput,
  NumberInputField,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { velarSDK } from '../config/velar';
import { getUserSession } from '../utils/stacks';
import { SwapType } from '@velarprotocol/velar-sdk';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fee: number, swapEstimate: { noccAmount: number; route?: string[] }) => void;
  contractData: {
    name: string;
    code: string;
  };
}

const GAS_FEE_OPTIONS = {
  low: 0.5,      // 0.5 STX
  standard: 0.75, // 0.75 STX
  high: 2.0      // 2.0 STX
};

export const DeploymentModal: React.FC<DeploymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  contractData,
}) => {
  const [selectedFee, setSelectedFee] = useState<'low' | 'standard' | 'high' | 'custom'>('standard');
  const [customFee, setCustomFee] = useState<string>('0.75');
  const [swapEstimates, setSwapEstimates] = useState<{
    [key: string]: { noccAmount: number; route?: string[] }
  }>({});
  const [customSwapEstimate, setCustomSwapEstimate] = useState<{ noccAmount: number; route?: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSwapAmount = async (stxAmount: number) => {
    try {
      const userSession = getUserSession();
      if (!userSession?.isUserSignedIn()) return null;

      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
      
      const swapInstance = await velarSDK.getSwapInstance({
        account: senderAddress,
        inToken: 'NOCC',
        outToken: 'STX'
      });

      const result = await swapInstance.getComputedAmount({
        amount: stxAmount,
        type: SwapType.TWO,
        slippage: 0.05
      });

      if (!result) {
        throw new Error('Invalid swap result');
      }

      const noccAmount = Number(result.value || 0) * 1000 * 1000;

      console.log('Swap amount computed:', {
        stxAmount,
        noccAmount,
        route: result.route,
        rawValue: result.value
      });

      return {
        noccAmount,
        route: result.route || []
      };
    } catch (error) {
      console.error('Error fetching swap amount:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchEstimates = async () => {
      try {
        const estimates = await Promise.all(
          Object.entries(GAS_FEE_OPTIONS).map(async ([level, stxAmount]) => {
            const result = await fetchSwapAmount(stxAmount);
            return [level, result];
          })
        );

        const validEstimates = Object.fromEntries(
          estimates.filter(([_, result]) => result !== null)
        );

        setSwapEstimates(validEstimates);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching estimates:', error);
        setError('Failed to fetch swap estimates');
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchEstimates();
    }
  }, [isOpen]);

  const handleCustomFeeChange = async (valueString: string) => {
    setCustomFee(valueString);
    const numValue = parseFloat(valueString);
    
    if (!isNaN(numValue) && numValue > 0) {
      const estimate = await fetchSwapAmount(numValue);
      if (estimate) {
        setCustomSwapEstimate(estimate);
      }
    } else {
      setCustomSwapEstimate(null);
    }
  };

  const handleConfirm = () => {
    let fee: number;
    let estimate: { noccAmount: number; route?: string[] } | null;

    if (selectedFee === 'custom') {
      fee = parseFloat(customFee) * 1_000_000; // Convert to microSTX
      estimate = customSwapEstimate;
    } else {
      fee = GAS_FEE_OPTIONS[selectedFee] * 1_000_000;
      estimate = swapEstimates[selectedFee];
    }

    if (estimate) {
      onConfirm(fee, estimate);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="gray.900" border="1px" borderColor="gray.700">
        <ModalHeader borderBottom="1px" borderColor="gray.700">
          Deploy Contract
        </ModalHeader>

        <ModalBody py={6}>
          {error ? (
            <Alert status="error" variant="left-accent">
              <AlertIcon />
              {error}
            </Alert>
          ) : isLoading ? (
            <Text>Loading swap rates...</Text>
          ) : (
            <RadioGroup value={selectedFee} onChange={(value: any) => setSelectedFee(value)}>
              <VStack spacing={3} align="stretch">
                {Object.entries(GAS_FEE_OPTIONS).map(([speed, stxAmount]) => (
                  <Box
                    key={speed}
                    p={4}
                    border="1px"
                    borderRadius="lg"
                    borderColor={selectedFee === speed ? "orange.500" : "gray.700"}
                    bg={selectedFee === speed ? "gray.800" : "gray.900"}
                    cursor="pointer"
                    onClick={() => setSelectedFee(speed as any)}
                  >
                    <HStack justify="space-between">
                      <Radio value={speed} colorScheme="orange">
                        <Text textTransform="capitalize" color="white">{speed}</Text>
                      </Radio>
                      <VStack align="end" spacing={1}>
                        <Text color="white">{stxAmount.toFixed(2)} STX</Text>
                        <Text fontSize="sm" color="gray.400">
                          ≈ {(swapEstimates[speed]?.noccAmount || 0).toFixed(2)} NOCC
                        </Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}

                {/* Custom Fee Option */}
                <Box
                  p={4}
                  border="1px"
                  borderRadius="lg"
                  borderColor={selectedFee === 'custom' ? "orange.500" : "gray.700"}
                  bg={selectedFee === 'custom' ? "gray.800" : "gray.900"}
                  cursor="pointer"
                  onClick={() => setSelectedFee('custom')}
                >
                  <HStack justify="space-between" align="start">
                    <Radio value="custom" colorScheme="orange">
                      <Text color="white">Custom</Text>
                    </Radio>
                    <VStack align="end" spacing={1}>
                      <NumberInput
                        value={customFee}
                        onChange={handleCustomFeeChange}
                        min={0.1}
                        precision={2}
                        step={0.1}
                        isDisabled={selectedFee !== 'custom'}
                      >
                        <NumberInputField
                          bg="gray.800"
                          border="1px"
                          borderColor="gray.600"
                          color="white"
                          w="120px"
                          textAlign="right"
                        />
                      </NumberInput>
                      {selectedFee === 'custom' && customSwapEstimate && (
                        <Text fontSize="sm" color="gray.400">
                          ≈ {(customSwapEstimate.noccAmount || 0).toFixed(2)} NOCC
                        </Text>
                      )}
                    </VStack>
                  </HStack>
                </Box>
              </VStack>
            </RadioGroup>
          )}
        </ModalBody>

        <ModalFooter borderTop="1px" borderColor="gray.700" gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            isDisabled={isLoading || !!error || (selectedFee === 'custom' && !customSwapEstimate)}
            bg="#FF9F0A"
            color="black"
            _hover={{ bg: '#FFB340' }}
          >
            Confirm & Deploy
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};