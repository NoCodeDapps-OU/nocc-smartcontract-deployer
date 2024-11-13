import { useState, useEffect } from 'react';
import { Box, HStack, VStack, Text, Flex, Link, Alert, AlertIcon, AlertDescription } from '@chakra-ui/react';
import { ArrowRight, CheckCircle, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { cvToString, deserializeCV, ClarityValue } from '@stacks/transactions';

// Add TimeDisplay component in the same file
export const TimeDisplay: React.FC<{ elapsed: number }> = ({ elapsed }) => {
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const format = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return <>{`${hours}:${format(minutes)}:${format(seconds)}`}</>;
  } else if (minutes > 0) {
    return <>{`${minutes}:${format(seconds)}`}</>;
  } else {
    return <>{`0:${format(seconds)}`}</>;
  }
};

// Add these constants at the top of the file
const TX_STAGES = ['mempool', 'contract', 'mining', 'anchor'];

// Add the calculateStage function
const calculateStage = (txStatus: string): number => {
  if (!txStatus) return 0;
  
  switch (txStatus) {
    case 'pending':
      return 1; // Contract stage
    case 'success':
      return TX_STAGES.length - 1; // Anchored stage
    case 'dropped':
    case 'abort_by_response':
    case 'abort_by_post_condition':
      return 1; // Failed at contract stage
    default:
      if (txStatus.startsWith('abort')) {
        return 1; // Any other abort is at contract stage
      }
      return 0; // Default to mempool
  }
};

interface TransactionFlowProps {
  txId: string;
  type: 'swap' | 'deploy';
}

const TransactionFlow = ({ txId, type }: TransactionFlowProps) => {
  const [txStatus, setTxStatus] = useState<{
    currentStage: number;
    isConfirmed: boolean;
    isFailed: boolean;
    startTime: number;
    burnBlockHeight?: number;
    errorReason?: string;
    failedStage?: number;
  }>({
    currentStage: 0,
    isConfirmed: false,
    isFailed: false,
    startTime: Date.now(),
    failedStage: undefined
  });

  const formatClarityError = (errorString: string): string => {
    try {
      // Try to parse as Clarity value first
      if (errorString.startsWith('0x')) {
        try {
          const clarityValue = deserializeCV(Buffer.from(errorString.slice(2), 'hex'));
          const parsed = cvToString(clarityValue);
          return formatParsedClarityError(parsed);
        } catch (e) {
          console.error('Error deserializing Clarity value:', e);
        }
      }

      return formatParsedClarityError(errorString);
    } catch (e) {
      console.error('Error formatting error:', e);
      return errorString;
    }
  };

  const formatParsedClarityError = (errorString: string): string => {
    // Post Condition Failures
    if (errorString.includes('post-condition')) {
      if (errorString.includes('STX')) {
        const match = errorString.match(/expected\s+u(\d+)/i);
        const expected = match ? parseInt(match[1]) / 1_000_000 : null;
        return expected 
          ? `Transaction failed: STX balance check failed - Required ${expected} STX`
          : 'Transaction failed: STX balance check failed';
      }
      if (errorString.includes('ft-transfer')) {
        const match = errorString.match(/expected\s+u(\d+)/i);
        const expected = match ? parseInt(match[1]) / 1_000 : null;
        return expected 
          ? `Transaction failed: Token transfer check failed - Required ${expected} NOCC`
          : 'Transaction failed: Token transfer check failed';
      }
      if (errorString.includes('nft-transfer')) {
        return 'Transaction failed: NFT transfer check failed';
      }
      return 'Transaction failed: Post condition check failed';
    }

    // Swap-specific Errors
    if (errorString.includes('swap')) {
      const errorMap: { [key: string]: string } = {
        'ERR_INSUFFICIENT_POOL_BALANCE': 'Insufficient liquidity in pool',
        'ERR_MAX_SLIPPAGE': 'Price impact too high',
        'ERR_MIN_RECEIVED': 'Output amount below minimum accepted',
        'ERR_MAX_IN_RATIO': 'Input amount exceeds maximum allowed',
        'ERR_INVALID_PAIR': 'Invalid trading pair',
        'ERR_ZERO_AMOUNT': 'Amount cannot be zero',
        'ERR_SAME_TOKEN': 'Cannot swap same token',
        'ERR_EXPIRED': 'Swap deadline expired',
        'ERR_PRICE_IMPACT': 'Price impact exceeds safety limit',
        'ERR_POOL_LOCKED': 'Pool is temporarily locked',
        'ERR_INSUFFICIENT_Y': 'Insufficient token Y liquidity',
        'ERR_INSUFFICIENT_X': 'Insufficient token X liquidity',
        'ERR_K': 'Invalid K-value in pool',
        'ERR_BAD_RESERVE': 'Invalid reserve values',
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorString.includes(key)) {
          return `Swap failed: ${message}`;
        }
      }
    }

    // Contract Deployment Errors
    if (errorString.includes('deploy') || errorString.includes('contract')) {
      const errorMap: { [key: string]: string } = {
        'ERR_CONTRACT_EXISTS': 'Contract already exists with this name',
        'ERR_CONTRACT_SIZE': 'Contract code exceeds size limit',
        'ERR_INVALID_SYNTAX': 'Contract contains invalid Clarity syntax',
        'ERR_UNAUTHORIZED': 'Not authorized to deploy contract',
        'ERR_INVALID_NAME': 'Invalid contract name',
        'ERR_ANALYSIS_FAILED': 'Contract analysis failed',
        'ERR_WASM_VALIDATION': 'Contract validation failed',
        'ERR_CLARITY_VERSION': 'Unsupported Clarity version',
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorString.includes(key)) {
          return `Deployment failed: ${message}`;
        }
      }
    }

    // Balance and Authorization Errors
    if (errorString.includes('balance') || errorString.includes('auth')) {
      const errorMap: { [key: string]: string } = {
        'ERR_INSUFFICIENT_BALANCE': 'Insufficient balance to complete transaction',
        'ERR_UNAUTHORIZED': 'Not authorized to perform this action',
        'ERR_STACKING_THRESHOLD': 'Amount below stacking threshold',
        'ERR_TRANSFER_FAILED': 'Token transfer failed',
        'ERR_INVALID_AMOUNT': 'Invalid amount specified',
        'ERR_SENDER_EQUALS_RECIPIENT': 'Sender and recipient are the same',
        'ERR_BELOW_MINIMUM': 'Amount below minimum required',
        'ERR_ABOVE_MAXIMUM': 'Amount exceeds maximum allowed',
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorString.includes(key)) {
          return `Transaction failed: ${message}`;
        }
      }
    }

    // Network and Transaction Errors
    if (errorString.includes('tx') || errorString.includes('transaction')) {
      const errorMap: { [key: string]: string } = {
        'ERR_MEMPOOL_FULL': 'Network mempool is full',
        'ERR_NONCE_TOO_LOW': 'Transaction nonce too low',
        'ERR_NONCE_TOO_HIGH': 'Transaction nonce too high',
        'ERR_FEE_TOO_LOW': 'Transaction fee too low',
        'ERR_BAD_SIGNATURE': 'Invalid transaction signature',
        'ERR_EXPIRED': 'Transaction expired',
        'ERR_DUPLICATE': 'Duplicate transaction',
        'ERR_VALIDATION': 'Transaction validation failed',
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorString.includes(key)) {
          return `Transaction failed: ${message}`;
        }
      }
    }

    // Clarity Runtime Errors
    if (errorString.includes('runtime')) {
      const errorMap: { [key: string]: string } = {
        'NoSuchContract': 'Contract not found',
        'NoSuchPublicFunction': 'Function not found in contract',
        'BadFunctionName': 'Invalid function name',
        'BadTypeConstruction': 'Invalid type construction',
        'ArithmeticOverflow': 'Arithmetic overflow occurred',
        'ArithmeticUnderflow': 'Arithmetic underflow occurred',
        'DivisionByZero': 'Division by zero error',
        'InvalidStackOperation': 'Invalid stack operation',
        'InvalidStorageOperation': 'Invalid storage operation',
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorString.includes(key)) {
          return `Runtime error: ${message}`;
        }
      }
    }

    // Parse Clarity tuple responses
    if (errorString.includes('(ok (tuple')) {
      try {
        const extractValue = (key: string) => {
          const regex = new RegExp(`${key} u(\\d+)`);
          const match = errorString.match(regex);
          return match ? parseInt(match[1]) : null;
        };

        const amtIn = extractValue('amt-in');
        const amtInMax = extractValue('amt-in-max');
        const amtOut = extractValue('amt-out');

        if (amtIn && amtOut) {
          const stxAmount = amtOut / 1_000_000; // Convert microSTX to STX
          const noccAmount = amtIn / 1_000; // Convert microNOCC to NOCC
          const maxAllowed = amtInMax ? amtInMax / 1_000 : null;

          // If post condition failed
          if (maxAllowed && noccAmount > maxAllowed) {
            return `Transaction failed: Insufficient NOCC balance. Need ${noccAmount.toFixed(3)} NOCC for gas fee. To fix this:\n` +
                   `1. Get more NOCC tokens\n` +
                   `2. Try a lower gas fee\n` +
                   `3. Ensure you have extra NOCC to cover slippage`;
          }

          // For insufficient balance
          if (errorString.includes('ERR_INSUFFICIENT_BALANCE')) {
            return `Transaction failed: Insufficient NOCC balance. Required ${noccAmount.toFixed(3)} NOCC for ${stxAmount.toFixed(3)} STX gas fee. To fix this:\n` +
                   `1. Get more NOCC tokens\n` +
                   `2. Try a lower gas fee`;
          }

          // For slippage/price impact issues
          if (errorString.includes('ERR_MAX_SLIPPAGE') || errorString.includes('ERR_PRICE_IMPACT')) {
            return `Transaction failed: Price impact too high for swapping ${noccAmount.toFixed(3)} NOCC to ${stxAmount.toFixed(3)} STX. To fix this:\n` +
                   `1. Try a smaller amount\n` +
                   `2. Try again when pool has more liquidity`;
          }

          // Default swap message with guidance
          return `Transaction failed: Unable to swap ${noccAmount.toFixed(3)} NOCC for ${stxAmount.toFixed(3)} STX gas fee. To fix this:\n` +
                 `1. Ensure you have enough NOCC tokens\n` +
                 `2. Try a lower gas fee\n` +
                 `3. Check pool liquidity`;
        }
      } catch (e) {
        console.error('Error parsing tuple:', e);
      }
    }

    // Simplify other error messages
    if (errorString.includes('ERR_INSUFFICIENT_BALANCE')) {
      return 'Insufficient balance';
    }

    if (errorString.includes('ERR_MAX_SLIPPAGE')) {
      return 'Price impact too high';
    }

    if (errorString.includes('ERR_POOL_LOCKED') || errorString.includes('ERR_INSUFFICIENT_POOL')) {
      return 'Insufficient liquidity';
    }

    // Default error message
    return 'Transaction failed';
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const POLL_INTERVAL = 5000;

    const checkStatus = async () => {
      if (!isMounted || !txId?.trim()) return;

      try {
        const response = await fetch(`/api/check-transaction?txId=${txId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (isMounted) {
          // Update status
          const newStatus = {
            ...txStatus,
            isConfirmed: data.tx_status === 'success',
            isFailed: data.tx_status?.startsWith('abort') || data.tx_status === 'dropped',
            burnBlockHeight: data.burn_block_height,
            currentStage: calculateStage(data.tx_status),
          };

          setTxStatus(newStatus);

          // Stop polling if transaction is complete
          if (newStatus.isConfirmed || newStatus.isFailed) {
            return;
          }

          // Reset retry count on successful response
          retryCount = 0;
        }
      } catch (error) {
        console.warn('Error checking tx status:', error);
        retryCount++;
        
        if (retryCount >= MAX_RETRIES) {
          return; // Stop polling after max retries
        }
      }

      // Continue polling if needed
      if (isMounted && !txStatus.isConfirmed && !txStatus.isFailed) {
        timeoutId = setTimeout(checkStatus, POLL_INTERVAL);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [txStatus, txId]);

  const getStageInfo = (stage: string, index: number) => {
    // If transaction failed, mark all subsequent stages as failed
    if (txStatus.isFailed) {
      const stageIndex = TX_STAGES.indexOf(stage);
      if (stageIndex >= (txStatus.failedStage ?? 0)) {
        return {
          title: 'Failed',
          description: type === 'swap' ? 'Token swap failed' : 'Contract deployment failed',
          isError: true
        };
      }
    }

    switch(stage) {
      case 'mempool':
        return {
          title: 'Mempool',
          description: 'Transaction submitted',
          isError: txStatus.isFailed && txStatus.failedStage === 0
        };
      case 'contract':
        return {
          title: 'Contract',
          description: type === 'swap' ? 'Token swap in progress' : 'Contract deployment',
          isError: txStatus.isFailed && txStatus.failedStage === 1
        };
      case 'mining': 
        return {
          title: 'Mining',
          description: 'Block confirmation',
          isError: txStatus.isFailed && txStatus.failedStage === 2
        };
      case 'anchor':
        return {
          title: 'Anchored',
          description: `Block #${txStatus.burnBlockHeight || '...'}`,
          isError: txStatus.isFailed && txStatus.failedStage === 3
        };
      default:
        return { title: '', description: '', isError: false };
    }
  };

  return (
    <Box p={6}>
      <Flex align="center" justify="space-between">
        {TX_STAGES.map((stage, index) => {
          const { title, description, isError } = getStageInfo(stage, index);
          const isActive = txStatus.isConfirmed || index <= txStatus.currentStage;
          const isComplete = txStatus.isConfirmed || (index < txStatus.currentStage && !txStatus.isFailed);
          
          return (
            <Flex key={stage} align="center">
              <VStack spacing={2} opacity={isActive ? 1 : 0.5}>
                <Box
                  w="40px"
                  h="40px"
                  rounded="full"
                  bg={isError ? "red.500" : 
                     isComplete ? "green.500" : 
                     isActive ? "orange.500" : 
                     "gray.600"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {isError ? (
                    <AlertTriangle size={20} className="text-white" />
                  ) : isComplete ? (
                    <CheckCircle size={20} className="text-white" />
                  ) : (
                    <Clock size={20} className="text-white" />
                  )}
                </Box>
                <Text fontWeight="bold" color={isError ? "red.300" : "white"}>
                  {title}
                </Text>
                <Text fontSize="sm" color={isError ? "red.300" : "gray.400"}>
                  {description}
                </Text>
              </VStack>

              {/* Only show connector if not the last stage and not failed */}
              {index < TX_STAGES.length - 1 && (!txStatus.isFailed || index < (txStatus.failedStage ?? 0)) && (
                <Box w="100px" opacity={isActive ? 1 : 0.3}>
                  <ArrowRight className="text-gray-400" />
                </Box>
              )}
            </Flex>
          );
        })}
      </Flex>

      {/* Error Message with more details */}
      {txStatus.isFailed && txStatus.errorReason && (
        <Alert 
          status="error" 
          mt={4} 
          bg="red.900" 
          borderRadius="md"
          flexDirection="column"
          alignItems="flex-start"
        >
          <HStack spacing={2} mb={2}>
            <AlertIcon color="red.300" />
            <Text fontWeight="bold" color="red.300">
              Transaction Failed
            </Text>
          </HStack>
          <Text color="red.300" fontSize="sm">
            {txStatus.errorReason}
          </Text>
          {txStatus.errorReason.includes('gas') && (
            <Text color="red.300" fontSize="sm" mt={2}>
              Try increasing the gas fee or reducing contract size
            </Text>
          )}
        </Alert>
      )}
    </Box>
  );
};

export default TransactionFlow;