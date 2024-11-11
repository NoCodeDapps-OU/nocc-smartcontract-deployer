import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Radio,
  RadioGroup,
  Text,
  NumberInput,
  NumberInputField,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { 
  makeContractDeploy,
  ClarityVersion,
  PostConditionMode,
  fetchFeeEstimateTransaction
} from '@stacks/transactions';
import { getUserSession } from '../utils/stacks';
import { velarSDK } from '@/config/velar';

interface GasFeeSelectorProps {
  contractCode: string;
  contractData: {
    name: string;
    code: string;
  };
  onFeeSelect: (fee: number, estimate: { noccAmount: number; route?: string[] }) => void;
}

interface FeeEstimate {
  fee: number;
  noccAmount: number;
  route?: string[];
}

interface Estimates {
  low: FeeEstimate;
  standard: FeeEstimate;
  high: FeeEstimate;
}

const STX_MICRO_MULTIPLIER = 1_000_000; // STX has 6 decimals

const FALLBACK_FEES = {
  low: 0.5 * STX_MICRO_MULTIPLIER, // 0.5 STX
  standard: 0.75 * STX_MICRO_MULTIPLIER, // 0.75 STX
  high: 2 * STX_MICRO_MULTIPLIER // 2 STX
};

export const GasFeeSelector: React.FC<GasFeeSelectorProps> = ({
  contractCode,
  onFeeSelect,
  contractData,
}) => {
  const [estimates, setEstimates] = useState<Estimates | null>(null);
  const [selectedFee, setSelectedFee] = useState<'low' | 'standard' | 'high' | 'custom'>('standard');
  const [customFee, setCustomFee] = useState<string>('');
  const [customSwapEstimate, setCustomSwapEstimate] = useState<any>(null);
  const [warning, setWarning] = useState<string>('');
  const slippageTolerance = 0.01;

  useEffect(() => {
    const loadEstimates = async () => {
      try {
        const userSession = getUserSession();
        if (!userSession?.isUserSignedIn()) {
          throw new Error('User not signed in');
        }

        const userData = userSession.loadUserData();
        const senderAddress = userData.profile.stxAddress.mainnet;
        
        if (!senderAddress || !senderAddress.startsWith('SP')) {
          throw new Error('Invalid sender address format');
        }

        // Create base contract deployment transaction
        const transaction = await makeContractDeploy({
          codeBody: contractCode,
          contractName: contractData.name,
          network: 'mainnet',
          clarityVersion: ClarityVersion.Clarity2,
          postConditionMode: PostConditionMode.Allow,
          postConditions: [],
          senderKey: userData.appPrivateKey || '',
          fee: 0n,
          nonce: 0n,
        });

        // Get base size and add estimated signatures size
        const serializedTx = transaction.serialize();
        const txSize = serializedTx.length + 150; // Add buffer for signatures

        try {
          // Try to get live fee estimates
          const feeEstimates = await fetchFeeEstimateTransaction({
            payload: '0x' + Buffer.from(serializedTx).toString('hex'),
            estimatedLength: txSize,
            network: 'mainnet',
          });

          // Get live pool data from Velar for accurate swap estimates
          const swapInstance = await velarSDK.getSwapInstance({
            account: senderAddress,
            inToken: 'STX',    // We're spending STX
            outToken: 'NOCC',  // To get NOCC
          });

          const [lowNOCC, standardNOCC, highNOCC] = await Promise.all([
            swapInstance.getComputedAmount({
              amount: Number(feeEstimates[0].fee) / STX_MICRO_MULTIPLIER,
              type: 2, // SwapType.ONE for exact input
              slippage: slippageTolerance,
            }),
            swapInstance.getComputedAmount({
              amount: Number(feeEstimates[1].fee) / STX_MICRO_MULTIPLIER,
              type: 2,
              slippage: slippageTolerance,
            }),
            swapInstance.getComputedAmount({
              amount: Number(feeEstimates[2].fee) / STX_MICRO_MULTIPLIER,
              type: 2,
              slippage: slippageTolerance,
            }),
          ]);

          setEstimates({
            low: {
              fee: Number(feeEstimates[0].fee),
              noccAmount: Number(lowNOCC.value || 0),
              route: lowNOCC.route,
            },
            standard: {
              fee: Number(feeEstimates[1].fee),
              noccAmount: Number(standardNOCC.value || 0),
              route: standardNOCC.route,
            },
            high: {
              fee: Number(feeEstimates[2].fee),
              noccAmount: Number(highNOCC.value || 0),
              route: highNOCC.route,
            },
          });

          // Set standard fee as default
          const standardFeeSTX = (Number(feeEstimates[1].fee) / STX_MICRO_MULTIPLIER).toString();
          setCustomFee(standardFeeSTX);
          setSelectedFee('standard');
          onFeeSelect(Number(feeEstimates[1].fee), {
            noccAmount: Number(standardNOCC.value || 0),
            route: standardNOCC.route,
          });
        } catch (error) {
        console.warn('Using fallback fee estimates:', error);

          // Use fallback fees if API fails
          const swapInstance = await velarSDK.getSwapInstance({
            account: senderAddress,
            inToken: 'STX',    // We're spending STX
            outToken: 'NOCC',  // To get NOCC
          });

          const [lowNOCC, standardNOCC, highNOCC] = await Promise.all([
            swapInstance.getComputedAmount({
              amount: FALLBACK_FEES.low / STX_MICRO_MULTIPLIER,
              type: 1, // SwapType.ONE for exact input
              slippage: slippageTolerance,
            }),
            swapInstance.getComputedAmount({
              amount: FALLBACK_FEES.standard / STX_MICRO_MULTIPLIER,
              type: 1,
              slippage: slippageTolerance,
            }),
            swapInstance.getComputedAmount({
              amount: FALLBACK_FEES.high / STX_MICRO_MULTIPLIER,
              type: 1,
              slippage: slippageTolerance,
            }),
          ]);

          setEstimates({
            low: {
              fee: FALLBACK_FEES.low,
              noccAmount: Number(lowNOCC.value || 0),
              route: lowNOCC.route,
            },
            standard: {
              fee: FALLBACK_FEES.standard,
              noccAmount: Number(standardNOCC.value || 0),
              route: standardNOCC.route,
            },
            high: {
              fee: FALLBACK_FEES.high,
              noccAmount: Number(highNOCC.value || 0),
              route: highNOCC.route,
            },
          });

          const standardFeeSTX = (FALLBACK_FEES.standard / STX_MICRO_MULTIPLIER).toString();
          setCustomFee(standardFeeSTX);
          onFeeSelect(FALLBACK_FEES.standard, {
            noccAmount: Number(standardNOCC.value || 0),
            route: standardNOCC.route,
          });
        }
      } catch (error) {
        console.error('Error loading fee estimates:', error);
        setWarning('Failed to load fee estimates. Please try again.');
      }
    };

    if (contractCode) {
      loadEstimates();
    }
  }, [contractCode, contractData.name]);

  const handleCustomFeeChange = async (valueString: string, valueNumber: number) => {
    setCustomFee(valueString);
  
    if (valueString === '') {
      // Handle empty input
      setCustomSwapEstimate(null);
      setWarning('');
      return;
    }
  
    if (isNaN(valueNumber)) {
      // Handle invalid number
      setCustomSwapEstimate(null);
      setWarning('Please enter a valid number.');
      return;
    }
  
    if (valueNumber < 0.5) {
      setWarning('Gas fee cannot be less than 0.5 STX.');
      setCustomSwapEstimate(null);
      return;
    } else {
      setWarning('');
    }
  
    const feeInMicro = valueNumber * STX_MICRO_MULTIPLIER;
  
    try {
      const userSession = getUserSession();
      if (!userSession?.isUserSignedIn()) return;
  
      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
  
      const swapInstance = await velarSDK.getSwapInstance({
        account: senderAddress,
        inToken: 'NOCC',    // Swap from NOCC
        outToken: 'STX',    // To STX
      });
  
      // STX amount in standard units
      const stxAmountStandard = valueNumber;
  
      const swapEstimate = await swapInstance.getComputedAmount({
        amount: stxAmountStandard,
        type: 2, // SwapType.TWO for exact output
        slippage: 0.04 // 4% slippage to match Velar UI
      });
  
      const noccAmount = Number(swapEstimate.value || 0);
  
      const newSwapEstimate = {
        noccAmount,
        route: swapEstimate.route // Include route in estimate
      };
  
      setCustomSwapEstimate(newSwapEstimate);
  
      if (selectedFee === 'custom') {
        onFeeSelect(feeInMicro, newSwapEstimate);
      }
    } catch (error) {
      console.error('Error calculating custom fee swap:', error);
      setWarning('Failed to calculate swap amount');
    }
  };  

  
  // Update the standard fee selection handler
  const handleFeeSelect = (value: 'low' | 'standard' | 'high' | 'custom') => {
    setSelectedFee(value);
  
    if (value !== 'custom' && estimates) {
      const feeData = estimates[value];
      onFeeSelect(feeData.fee, {
        noccAmount: feeData.noccAmount,
        route: feeData.route
      });
      setWarning('');
    } else if (value === 'custom') {
      const valueNumber = parseFloat(customFee);
      if (customFee === '' || isNaN(valueNumber)) {
        setWarning('Please enter a valid custom fee.');
        setCustomSwapEstimate(null);
      } else if (valueNumber >= 0.5) {
        const feeInMicro = valueNumber * STX_MICRO_MULTIPLIER;
        if (customSwapEstimate) {
          onFeeSelect(feeInMicro, {
            noccAmount: customSwapEstimate.noccAmount,
            route: customSwapEstimate.route
          });
          setWarning('');
        }
      } else {
        setWarning('Gas fee cannot be less than 0.5 STX.');
        setCustomSwapEstimate(null);
      }
    }
  };  

  const handleCustomBoxClick = () => {
    handleFeeSelect('custom');
  };

  const handleInputFocus = () => {
    // Auto-select custom when the input is focused
    handleFeeSelect('custom');
  };
  
  // Keep track of currently selected box
  const getSelectedStyles = (speed: string) => {
    const isSelected = selectedFee === speed;
    return {
      borderColor: isSelected ? "orange.500" : "gray.700",
      bg: isSelected ? "gray.800" : "gray.900",
      _hover: {
        borderColor: "orange.500",
        bg: "gray.800"
      }
    };
  };

  if (!estimates) return null;

  return (
    <VStack spacing={4} align="stretch" w="full">
      <RadioGroup value={selectedFee} onChange={handleFeeSelect}>
        <VStack spacing={3} align="stretch">
          {Object.entries(estimates || {}).map(([speed, data]: [string, any]) => (
            <Box
              key={speed}
              p={4}
              border="1px"
              borderRadius="lg"
              cursor="pointer"
              transition="all 0.2s"
              {...getSelectedStyles(speed)}
              onClick={() => handleFeeSelect(speed as any)}
              role="group"
            >
              <HStack justify="space-between">
                <Text fontWeight="bold" textTransform="capitalize" color="white">{speed}</Text>
                <VStack align="end" spacing={1}>
                  <Text color="white">{(data.fee / 1000000).toFixed(2)} STX</Text>
                  <Text fontSize="sm" color="gray.400">
                    ≈ {Number(data.noccAmount).toFixed(2)} NOCC
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
            cursor="pointer"
            onClick={handleCustomBoxClick}
            {...getSelectedStyles('custom')}
          >
            <HStack justify="space-between">
              <Radio 
                value="custom" 
                colorScheme="orange"
                isChecked={selectedFee === 'custom'}
                onClick={(e) => e.stopPropagation()} // Prevent radio from handling the click
              >
                <Text color="white">Custom</Text>
              </Radio>
              <NumberInput
                value={customFee}
                onChange={(valueString, valueNumber) => handleCustomFeeChange(valueString, valueNumber)}
                min={0}
                precision={2}
                step={0.01}
                isDisabled={selectedFee !== 'custom'}
                onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to parent
              >
                <NumberInputField 
                  bg="gray.800"
                  border="1px"
                  borderColor="gray.600"
                  color="white"
                  _hover={{
                    borderColor: "orange.500"
                  }}
                  _focus={{
                    borderColor: "orange.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-orange-500)"
                  }}
                  onFocus={handleInputFocus}
                />
              </NumberInput>
            </HStack>

            {selectedFee === 'custom' && customSwapEstimate && (
              <Text fontSize="sm" color="gray.400" mt={2}>
                ≈ {Number(customSwapEstimate.noccAmount).toFixed(2)} NOCC
              </Text>
            )}
          </Box>
        </VStack>
      </RadioGroup>

      {warning && (
        <Alert 
          status="warning" 
          variant="left-accent" 
          bg="transparent"
          color="white"
          border="none"
          p={0}
        >
          <AlertIcon color="red.500" />
          <Text color="white">{warning}</Text>
        </Alert>
      )}
    </VStack>
  );
};