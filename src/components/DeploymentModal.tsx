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
  Input,
  Alert,
  AlertIcon,
  Spinner,
  Tooltip
} from '@chakra-ui/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { VelarSDK, SwapType, SwapResponse, ISwapService } from '@velarprotocol/velar-sdk';
import { getUserSession } from '../utils/stacks';
import { StacksMainnet } from '@stacks/network';
import { openContractCall, openContractDeploy } from '@stacks/connect';
import { PostConditionMode } from '@stacks/transactions';
import _debounce from 'lodash/debounce';
import memoize from 'lodash/memoize';
import { createStandaloneToast } from '@chakra-ui/react';

const { toast } = createStandaloneToast();

interface SwapState {
  from: number;
  to: number;
  fromToken: string;
  toToken: string;
}

// Define tokens exactly like the example
const Names: any = {
  'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx': 'STX',
  'SP12JCJYJJ31C59MV94SNFFM4687H9A04Q3BHTAJM.NoCodeClarity-Token': 'NOCC'
};

const [TOKEN0, TOKEN1] = Object.keys(Names);
const sdk = new VelarSDK();

// Add this after the existing interfaces
interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (stxAmount: number, swapData: { 
    noccAmount: number; 
    route: any[];
    swapTxId?: string;
    deployTxId?: string;
  }) => void;
  contractData?: any;
}

const GAS_FEE_OPTIONS = {
  low: 0.5,      // 0.5 STX
  standard: 0.75, // 0.75 STX
  high: 2.0      // 2 STX
};

// Add this component at the top of the file
const RateSpinner = () => (
  <HStack spacing={2} color="gray.400" height="20px" alignItems="center">
    <Spinner 
      size="xs" 
      speed="0.65s"
      color="orange.500"
      emptyColor="gray.600"
    />
    <Text fontSize="sm" fontFamily="mono">
      Loading rate...
    </Text>
  </HStack>
);

export const DeploymentModal: React.FC<DeploymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  contractData,
}) => {
  const [state, setState] = useState<SwapState>({
    from: 0,
    to: 0,
    fromToken: TOKEN1,
    toToken: TOKEN0
  });
  const [selectedFee, setSelectedFee] = useState<'low' | 'standard' | 'high' | 'custom'>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | JSX.Element | null>(null);
  const [feeRates, setFeeRates] = useState<{[key: string]: number}>({
    low: 0,
    standard: 0,
    high: 0
  });
  const [slippage, setSlippage] = useState<number>(4); // Default 4%
  const [showSlippageTooltip, setShowSlippageTooltip] = useState(false);

  // Add a ref to store the last update timestamp
  const lastUpdateRef = useRef<number>(Date.now());
  const swapInstanceRef = useRef<ISwapService>(null);

  // Cache for rates at different slippages
  const ratesCache = useRef<Map<number, { [key: string]: number }>>(new Map());

  // Memoized function to calculate rates for a specific slippage
  const calculateRatesForSlippage = memoize(async (slippageValue: number, baseRates: { [key: string]: number }) => {
    const rates: { [key: string]: number } = {};
    
    Object.entries(baseRates).forEach(([key, baseRate]) => {
      // Add slippage amount to base rate
      rates[key] = baseRate + slippageValue;
    });
    
    return rates;
  });

  // Prefetch rates for all slippage values
  const prefetchRates = async (baseRates: { [key: string]: number }) => {
    const slippageValues = [1, 2, 3, 4, 5];
    
    // Calculate rates for all slippage values concurrently
    await Promise.all(
      slippageValues.map(async (slippageValue) => {
        const rates = await calculateRatesForSlippage(slippageValue, baseRates);
        ratesCache.current.set(slippageValue, rates);
      })
    );
  };

  // Add new state for error message timeout
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      // Initialize state when modal opens
      setState({
        from: 0,
        to: 0,
        fromToken: TOKEN1,
        toToken: TOKEN0
      });
      setSelectedFee('standard');
      setIsLoading(false);
      setError(null);
      setSlippage(4);
      
      // Initialize rates
      const userSession = getUserSession();
      if (userSession?.isUserSignedIn()) {
        const address = userSession.loadUserData().profile.stxAddress.mainnet;
        init(address);
        calculatePredefinedRates(address);
      }
    }

    // Cleanup on modal close
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const calculatePredefinedRates = async (address: string) => {
    try {
      const swapInstance = swapInstanceRef.current || await sdk.getSwapInstance({
        account: address,
        inToken: state.fromToken,
        outToken: state.toToken,
      });

      // Calculate base rates without slippage
      const baseRates = await Promise.all(
        Object.entries(GAS_FEE_OPTIONS).map(async ([key, stxAmount]) => {
          try {
            const result = await swapInstance.getComputedAmount({
              type: SwapType.TWO,
              amount: stxAmount,
              slippage: 0
            });
            
            return [key, Number(result.value || 0)] as [string, number];
          } catch (error) {
            return [key, feeRates[key]] as [string, number];
          }
        })
      );

      const baseRatesObj = Object.fromEntries(baseRates);
      
      // Prefetch rates for all slippage values
      await prefetchRates(baseRatesObj);
      
      // Get rates for current slippage from cache or calculate if not cached
      const currentRates = ratesCache.current.get(slippage) || await calculateRatesForSlippage(slippage, baseRatesObj);

      setFeeRates(currentRates);
      
      if (selectedFee !== 'custom') {
        setState(prev => ({
          ...prev,
          from: currentRates[selectedFee] || 0,
          to: GAS_FEE_OPTIONS[selectedFee]
        }));
      }
    } catch (error) {
      console.warn('Error calculating rates:', error);
      if (!Object.values(feeRates).some(rate => rate > 0)) {
        setError('Failed to calculate swap rates');
      }
    }
  };

  const init = async (stxAddress: string) => {
    try {
      const swapInstance = await sdk.getSwapInstance({
        account: stxAddress,
        inToken: state.fromToken,
        outToken: state.toToken,
      });
      (swapInstanceRef as any).current = swapInstance;
    } catch (err) {
      toast({
        title: 'Swap Error',
        description: 'Failed to initialize swap',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right'
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedFee !== 'custom') return;

    const value = e.target.value;
    const name = e.target.name;

    // Allow empty input for better UX
    if (value === '') {
      setState(prev => ({ ...prev, [name]: 0, to: 0 }));
      return;
    }

    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setIsLoading(true);
      setState(prev => ({ ...prev, [name]: numValue }));
      debounceInputFn({ name, value: numValue });
    }
  };

  const handleDebounceInputFn = async (e: { name: string; value: number }) => {
    if (!swapInstanceRef.current) return;

    try {
      const amount: any = await swapInstanceRef.current.getComputedAmount({
        type: SwapType.ONE,
        amount: e.value,
      });
      setState(prev => ({ ...prev, [e.name]: e.value, to: Number(amount.value) }));
      setIsLoading(false);
    } catch (err) {
      toast({
        title: 'Computation Error',
        description: 'Failed to compute swap amount',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right'
      });
      setIsLoading(false);
    }
  };

  const debounceInputFn = useCallback(
    _debounce(handleDebounceInputFn, 300),
    []
  );

  const handleSwapAndDeploy = async () => {
    if (!swapInstanceRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const userSession = getUserSession();
      const address = userSession?.loadUserData().profile.stxAddress.mainnet;
      
      // Calculate the actual swap amount with slippage
      const swapOptions: SwapResponse = await swapInstanceRef.current.swap({
        amount: state.from,
        type: SwapType.ONE,
        slippage: slippage / 100 // Convert percentage to decimal
      });

      const provider = 
        (window as any).LeatherProvider || 
        (window as any)?.XverseProviders?.StacksProvider;

      const network = new StacksMainnet();

      return new Promise((resolve, reject) => {
        const options = {
          ...swapOptions,
          network,
          appDetails: {
            name: "NOCC Contract Deployer",
            icon: "/nocc-logo.png"
          },
          onFinish: async (swapData: any) => {
            // Immediately call onConfirm with the swap txId
            const swapTxId = swapData.txId;
            
            // After swap success, trigger the contract deployment
            const deploymentOptions = {
              contractName: contractData.name,
              codeBody: contractData.code,
              network,
              postConditionMode: PostConditionMode.Allow,
              fee: state.to,
              appDetails: {
                name: "NOCC Contract Deployer",
                icon: "/nocc-logo.png"
              },
              onFinish: (deployData: any) => {
                const deployTxId = deployData.txId;
                
                // Update with both transaction IDs
                onConfirm(state.to, {
                  noccAmount: state.from,
                  route: [],
                  swapTxId,
                  deployTxId
                });
                
                setState({ ...state, from: 0, to: 0 });
                setIsLoading(false);
                onClose();
                resolve({ swapTxId, deployTxId });
              },
              onCancel: () => {
                setIsLoading(false);
                const cancelMessage = (
                  <Alert 
                    status="info" 
                    variant="subtle"
                    bg="gray.800"
                    borderRadius="md"
                    color="white"
                  >
                    <AlertIcon color="blue.300" />
                    <Box>
                      <Text fontWeight="medium">Swap Cancelled</Text>
                      <Text fontSize="sm" color="gray.300" mt={1}>
                        The swap transaction was cancelled. You can try again with a different amount or rate.
                      </Text>
                    </Box>
                  </Alert>
                );
                setError(cancelMessage);

                // Clear error message after 7 seconds
                if (errorTimeoutRef.current) {
                  clearTimeout(errorTimeoutRef.current);
                }
                errorTimeoutRef.current = setTimeout(() => {
                  setError(null);
                }, 7000);

                reject(new Error('Swap cancelled'));
              }
            };

            openContractDeploy(deploymentOptions);
          },
          onCancel: () => {
            setIsLoading(false);
            const errorMessage = (
              <Alert 
                status="error" 
                variant="subtle"
                bg="gray.800"
                borderRadius="md"
                color="white"
              >
                <AlertIcon color="red.300" />
                <Box>
                  <Text fontWeight="medium">Transaction Failed</Text>
                  <Text fontSize="sm" color="gray.300" mt={1}>
                    {error instanceof Error ? error.message : 'Failed to process transaction. Please try again.'}
                  </Text>
                </Box>
              </Alert>
            );
            setError(errorMessage);

            // Clear error message after 7 seconds
            if (errorTimeoutRef.current) {
              clearTimeout(errorTimeoutRef.current);
            }
            errorTimeoutRef.current = setTimeout(() => {
              setError(null);
            }, 7000);

            reject(new Error('Swap cancelled'));
          }
        };

        openContractCall(options, provider);
      });

    } catch (error) {
      console.error('Transaction error:', error);
      setIsLoading(false);
      const errorMessage = (
        <Alert 
          status="error" 
          variant="subtle"
          bg="gray.800"
          borderRadius="md"
          color="white"
        >
          <AlertIcon color="red.300" />
          <Box>
            <Text fontWeight="medium">Transaction Failed</Text>
            <Text fontSize="sm" color="gray.300" mt={1}>
              {error instanceof Error ? error.message : 'Failed to process transaction. Please try again.'}
            </Text>
          </Box>
        </Alert>
      );
      setError(errorMessage);

      // Clear error message after 7 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setError(null);
      }, 7000);

      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleSwapAndDeploy();
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleFeeOptionSelect = (option: 'low' | 'standard' | 'high' | 'custom') => {
    setSelectedFee(option);
    if (option !== 'custom') {
      // Set values for predefined options
      setState({
        ...state,
        from: Number(feeRates[option] || 0),
        to: Number(GAS_FEE_OPTIONS[option])
      });
    } else {
      // Clear values when switching to custom
      setState({
        ...state,
        from: 0,
        to: 0
      });
    }
  };

  const handleSlippageChange = (newSlippage: number) => {
    setSlippage(newSlippage);
    
    // Get rates from cache if available
    const cachedRates = ratesCache.current.get(newSlippage);
    if (cachedRates) {
      setFeeRates(cachedRates);
      if (selectedFee !== 'custom') {
        setState(prev => ({
          ...prev,
          from: cachedRates[selectedFee] || 0,
          to: GAS_FEE_OPTIONS[selectedFee]
        }));
      }
    } else {
      // If not in cache, calculate new rates
      const userSession = getUserSession();
      if (userSession?.isUserSignedIn()) {
        const address = userSession.loadUserData().profile.stxAddress.mainnet;
        calculatePredefinedRates(address);
      }
    }
  };

  const SlippageSelector = () => (
    <Box
      w="full"
      p={4}
      bg="gray.800"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.700"
    >
      <HStack justify="space-between" mb={4}>
        <Text color="white" fontWeight="medium">Slippage Tolerance</Text>
        <HStack spacing={2}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              bg={slippage === value ? "orange.500" : "gray.700"}
              color={slippage === value ? "white" : "gray.400"}
              _hover={{
                bg: slippage === value ? "orange.600" : "gray.600"
              }}
              onClick={() => handleSlippageChange(value)}
            >
              {value}%
            </Button>
          ))}
        </HStack>
      </HStack>

      {slippage < 4 && (
        <Alert
          status="warning"
          variant="subtle"
          bg="gray.900"
          borderRadius="md"
          mt={4}
          borderLeft="4px"
          borderLeftColor="orange.500"
        >
          <AlertIcon color="orange.400" />
          <Box>
            <Text color="white" fontWeight="medium">Low Slippage Warning</Text>
            <Text color="gray.400" fontSize="sm" mt={1}>
              Transaction may fail due to price movement. Consider using 4% or higher for better success rate.
            </Text>
          </Box>
        </Alert>
      )}
    </Box>
  );

  // Update the FadingText component
  const FadingText: React.FC<{ value: number; isLoading?: boolean }> = ({ value, isLoading }) => {
    const [prevValue, setPrevValue] = useState(value);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showGhost, setShowGhost] = useState(false);

    useEffect(() => {
      if (value !== prevValue) {
        setIsUpdating(true);
        setShowGhost(true);
        
        const ghostTimer = setTimeout(() => {
          setPrevValue(value);
          setShowGhost(false);
        }, 150);

        const updateTimer = setTimeout(() => {
          setIsUpdating(false);
        }, 300);

        return () => {
          clearTimeout(ghostTimer);
          clearTimeout(updateTimer);
        };
      }
    }, [value, prevValue]);

    // Show spinner when loading or value is 0 during initial fetch
    if (isLoading || (value === 0 && !prevValue)) {
      return <RateSpinner />;
    }

    return (
      <Box position="relative" height="20px">
        {showGhost && (
          <Text
            position="absolute"
            color="gray.400"
            fontSize="sm"
            fontFamily="mono"
            opacity={0.3}
            transform="translateY(-4px)"
            transition="all 0.3s ease-in-out"
          >
            {prevValue.toFixed(3)} NOCC
          </Text>
        )}
        
        <Text
          color="gray.400"
          fontSize="sm"
          fontFamily="mono"
          transition="all 0.3s ease-in-out"
          transform={isUpdating ? 'translateY(0)' : 'translateY(0)'}
          opacity={isUpdating ? 0.8 : 1}
          position="relative"
          zIndex={1}
        >
          {value.toFixed(3)} NOCC
        </Text>
      </Box>
    );
  };

  // Add cleanup for error timeout
  const handleClose = () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="gray.900" border="1px" borderColor="gray.700">
        <ModalHeader borderBottom="1px" borderColor="gray.700">
          Swap NOCC for Contract Deployment
        </ModalHeader>

        <ModalBody py={6}>
          <VStack spacing={6}>
            {error && (
              <Box w="full">
                {typeof error === 'string' ? (
                  <Alert 
                    status="error" 
                    variant="subtle"
                    bg="gray.800"
                    borderRadius="md"
                    color="white"
                  >
                    <AlertIcon color="red.300" />
                    <Text>{error}</Text>
                  </Alert>
                ) : error}
              </Box>
            )}

            {/* Fee Options */}
            <Box w="full">
              <Text mb={4} color="gray.400">Select Gas Fee You Will select While deploying Contract</Text>
              <VStack spacing={3}>
                {Object.entries(GAS_FEE_OPTIONS).map(([option, stxAmount]) => (
                  <Box
                    key={option}
                    w="full"
                    p={4}
                    bg={selectedFee === option ? "gray.700" : "gray.800"}
                    borderRadius="lg"
                    cursor="pointer"
                    onClick={() => handleFeeOptionSelect(option as any)}
                    border="1px solid"
                    borderColor={selectedFee === option ? "orange.500" : "transparent"}
                    _hover={{ borderColor: "orange.500" }}
                    transition="all 0.2s ease-in-out"
                  >
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <Text color="white" textTransform="capitalize">{option}</Text>
                        <Box overflow="hidden" w="full">
                          <FadingText 
                            value={feeRates[option] || 0} 
                            isLoading={!feeRates[option] && feeRates[option] !== 0}
                          />
                        </Box>
                      </VStack>
                      <Text color="white" fontWeight="bold">
                        {stxAmount} STX
                      </Text>
                    </HStack>
                  </Box>
                ))}

                {/* Custom Option */}
                <Box
                  w="full"
                  p={4}
                  bg={selectedFee === 'custom' ? "gray.700" : "gray.800"}
                  borderRadius="lg"
                  cursor="pointer"
                  onClick={() => handleFeeOptionSelect('custom')}
                  border="1px solid"
                  borderColor={selectedFee === 'custom' ? "orange.500" : "transparent"}
                  _hover={{ borderColor: "orange.500" }}
                >
                  <Text color="white" mb={3}>Custom Amount</Text>
                  <HStack spacing={4}>
                    <Box flex={1}>
                      <Input
                        name="from"
                        value={selectedFee === 'custom' ? (state.from || '') : ''}
                        onChange={handleInputChange}
                        placeholder="Enter NOCC amount"
                        bg="gray.700"
                        color="white"
                        _hover={{ borderColor: "orange.500" }}
                        _focus={{ 
                          borderColor: "orange.500", 
                          boxShadow: "0 0 0 1px var(--chakra-colors-orange-500)" 
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFeeOptionSelect('custom');
                        }}
                      />
                    </Box>
                    <Box flex={1}>
                      <Input
                        name="to"
                        value={selectedFee === 'custom' ? (state.to || '') : ''}
                        isReadOnly
                        placeholder="STX amount"
                        bg="gray.700"
                        color="white"
                      />
                    </Box>
                  </HStack>
                </Box>
              </VStack>
            </Box>

            {/* Add Slippage Selector before the button */}
            <SlippageSelector />

            {isLoading && (
              <HStack>
                <Spinner size="sm" />
                <Text>Calculating swap...</Text>
              </HStack>
            )}

            <Button
              type="submit"
              w="full"
              isDisabled={isLoading || !state.from || !state.to}
              bg="#FF9F0A"
              color="black"
              _hover={{ bg: '#FFB340' }}
              isLoading={isLoading}
              onClick={handleSubmit}
            >
              Confirm Swap & Deploy
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};