import { useState, useEffect } from 'react';
import { Box, HStack, VStack, Text, Flex, Link, Alert, AlertIcon, AlertDescription } from '@chakra-ui/react';
import { ArrowRight, CheckCircle, Clock, ExternalLink, AlertTriangle } from 'lucide-react';

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

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`https://api.hiro.so/extended/v1/tx/${txId}`);
        const data = await response.json();

        // Get detailed error reason if failed
        let errorReason = '';
        if (data.tx_status === 'abort_by_response') {
          errorReason = data.tx_result?.repr || 'Transaction aborted by contract';
        } else if (data.tx_status === 'abort_by_post_condition') {
          errorReason = 'Transaction aborted by post-condition';
        }

        // Update status based on tx data
        setTxStatus(prev => ({
          currentStage: data.tx_status === 'success' ? TX_STAGES.length - 1 : 
            data.tx_status === 'pending' ? 1 : 0,
          isConfirmed: data.tx_status === 'success',
          isFailed: data.tx_status.startsWith('abort'),
          startTime: prev.startTime,
          burnBlockHeight: data.burn_block_height,
          errorReason
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
          const isComplete = index < txStatus.currentStage;
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