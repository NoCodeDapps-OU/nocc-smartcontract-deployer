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

// Transaction stages in order
const TX_STAGES = ['mempool', 'contract', 'mining', 'anchor'];

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
  }>({
    currentStage: 0,
    isConfirmed: false,
    isFailed: false,
    startTime: Date.now()
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
        return 'Transaction failed: STX balance check failed';
      }
      if (errorString.includes('ft-transfer')) {
        return 'Transaction failed: Token transfer check failed';
      }
      if (errorString.includes('nft-transfer')) {
        return 'Transaction failed: NFT transfer check failed';
      }
      return 'Transaction failed: Post condition check failed';
    }

    // Smart Contract Errors
    if (errorString.includes('ERR_')) {
      const errorMap: { [key: string]: string } = {
        'ERR_INSUFFICIENT_BALANCE': 'Insufficient balance',
        'ERR_NOT_AUTHORIZED': 'Not authorized to perform this action',
        'ERR_STACKING_THRESHOLD': 'Amount below stacking threshold',
        'ERR_TRANSFER_FAILED': 'Token transfer failed',
        'ERR_INVALID_AMOUNT': 'Invalid amount specified',
        'ERR_MAX_IN_RATIO': 'Swap exceeds maximum input amount',
        'ERR_MIN_OUT_RATIO': 'Swap output below minimum amount',
        'ERR_SLIPPAGE_EXCEEDED': 'Price slippage exceeded',
        'ERR_DEADLINE_EXPIRED': 'Transaction deadline expired',
        'ERR_POOL_NOT_FOUND': 'Liquidity pool not found',
        'ERR_INSUFFICIENT_LIQUIDITY': 'Insufficient liquidity',
        'ERR_ZERO_AMOUNT': 'Amount cannot be zero',
        'ERR_SAME_TOKEN': 'Cannot swap same token',
        'ERR_CONTRACT_ALREADY_EXISTS': 'Contract already exists',
        'ERR_CONTRACT_NOT_FOUND': 'Contract not found',
        'ERR_INVALID_PARAMETER': 'Invalid parameter provided'
      };

      for (const [key, message] of Object.entries(errorMap)) {
        if (errorString.includes(key)) {
          return `Transaction failed: ${message}`;
        }
      }
    }

    // Swap Operation Results
    if (errorString.includes('(ok (tuple')) {
      const extractValue = (key: string) => {
        const regex = new RegExp(`${key} u(\\d+)`);
        const match = errorString.match(regex);
        return match ? parseInt(match[1]) : null;
      };

      const amtIn = extractValue('amt-in');
      const amtInMax = extractValue('amt-in-max');
      const amtOut = extractValue('amt-out');

      if (amtIn && amtOut) {
        const stxAmount = amtOut / 1_000_000;
        const noccAmount = amtIn / 1_000;

        if (amtInMax && amtIn > amtInMax) {
          return `Transaction failed: Required ${noccAmount.toFixed(3)} NOCC to get ${stxAmount.toFixed(3)} STX for gas fee, but exceeded maximum allowed amount of ${(amtInMax/1_000).toFixed(3)} NOCC`;
        }

        return `Transaction failed: Insufficient NOCC balance - needed ${noccAmount.toFixed(3)} NOCC to get ${stxAmount.toFixed(3)} STX for gas fee`;
      }
    }

    // Generic Clarity Errors
    if (errorString.includes('(err')) {
      const errorMatch = errorString.match(/\(err\s*[u"]?([^)"]+)[u"]?\)/);
      if (errorMatch) {
        return `Transaction failed: ${errorMatch[1]}`;
      }
    }

    // Runtime Errors
    if (errorString.includes('runtime_error')) {
      if (errorString.includes('NoSuchContract')) {
        return 'Transaction failed: Contract not found';
      }
      if (errorString.includes('BadFunctionName')) {
        return 'Transaction failed: Function not found in contract';
      }
      return 'Transaction failed: Runtime error occurred';
    }

    // Analysis Errors
    if (errorString.includes('analysis_error')) {
      return 'Transaction failed: Contract analysis error';
    }

    // Serialization Errors
    if (errorString.includes('serialization_error')) {
      return 'Transaction failed: Invalid transaction format';
    }

    // If we can't specifically parse it, clean it up
    return errorString
      .replace(/[()]/g, '')
      .replace(/u\d+/g, match => parseInt(match.slice(1)).toString())
      .replace(/\s+/g, ' ')
      .trim();
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`https://api.hiro.so/extended/v1/tx/${txId}`);
        const data = await response.json();

        // Get the raw error message directly from the transaction data
        let errorReason = '';
        if (data.tx_status.startsWith('abort')) {
          // Get the raw error message and format it
          if (data.tx_result?.repr) {
            errorReason = formatClarityError(data.tx_result.repr);
          } else if (data.tx_result?.raw_result) {
            errorReason = formatClarityError(data.tx_result.raw_result);
          }
        }

        // Update status based on tx data
        setTxStatus(prev => ({
          currentStage: data.tx_status === 'success' ? TX_STAGES.length - 1 : 
            data.tx_status === 'pending' ? 1 : 0,
          isConfirmed: data.tx_status === 'success',
          isFailed: data.tx_status.startsWith('abort'),
          startTime: prev.startTime,
          burnBlockHeight: data.burn_block_height,
          errorReason: errorReason || 'Transaction failed' // Default message if no specific error
        }));
      } catch (error) {
        console.error('Error fetching tx status:', error);
      }
    };

    const interval = setInterval(checkStatus, 10000);
    checkStatus();

    return () => clearInterval(interval);
  }, [txId]);

  const getStageInfo = (stage: string) => {
    if (txStatus.isFailed && stage !== 'mempool') {
      return {
        title: 'Failed',
        description: type === 'swap' ? 'Token swap failed' : 'Contract deployment failed',
        isError: true
      };
    }

    switch(stage) {
      case 'mempool':
        return {
          title: 'Mempool',
          description: 'Transaction submitted',
          isError: false
        };
      case 'contract':
        return {
          title: 'Contract',
          description: type === 'swap' ? 'Token swap in progress' : 'Contract deployment',
          isError: false
        };
      case 'mining': 
        return {
          title: 'Mining',
          description: 'Block confirmation',
          isError: false
        };
      case 'anchor':
        return {
          title: 'Anchored',
          description: `Block #${txStatus.burnBlockHeight || '...'}`,
          isError: false
        };
      default:
        return { title: '', description: '', isError: false };
    }
  };

  return (
    <Box p={6}>
      <Flex align="center" justify="space-between">
        {TX_STAGES.map((stage, index) => {
          const { title, description, isError } = getStageInfo(stage);
          const isActive = index <= txStatus.currentStage || (txStatus.isFailed && index === 1);
          const isComplete = index < txStatus.currentStage || (index === txStatus.currentStage && txStatus.isConfirmed);
          const showError = txStatus.isFailed && index > 0;
          
          return (
            <Flex key={stage} align="center">
              {/* Stage node */}
              <VStack 
                spacing={2}
                opacity={isActive ? 1 : 0.5}
              >
                <Box
                  w="40px"
                  h="40px"
                  rounded="full"
                  bg={showError ? "red.500" : 
                     isComplete ? "green.500" : 
                     isActive ? "orange.500" : 
                     "gray.600"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {showError ? (
                    <AlertTriangle className="text-white" />
                  ) : isComplete ? (
                    <CheckCircle className="text-white" />
                  ) : (
                    <Clock className="text-white" />
                  )}
                </Box>
                <Text 
                  fontWeight="bold" 
                  color={showError ? "red.300" : "white"}
                >
                  {title}
                </Text>
                <Text 
                  fontSize="sm" 
                  color={showError ? "red.300" : "gray.400"}
                >
                  {description}
                </Text>
              </VStack>

              {/* Connector arrow */}
              {index < TX_STAGES.length - 1 && !txStatus.isFailed && (
                <Box w="100px" opacity={isActive ? 1 : 0.3}>
                  <ArrowRight className="text-gray-400" />
                </Box>
              )}
            </Flex>
          );
        })}
      </Flex>

      {/* Error Message */}
      {txStatus.isFailed && txStatus.errorReason && (
        <Alert status="error" mt={4} bg="red.900" borderRadius="md">
          <AlertIcon color="red.300" />
          <AlertDescription fontSize="sm" color="red.300">
            {txStatus.errorReason}
          </AlertDescription>
        </Alert>
      )}
    </Box>
  );
};

export default TransactionFlow;