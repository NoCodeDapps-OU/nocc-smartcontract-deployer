import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Flex, 
  Badge,
  Link,
  Code,
  Container,
  Tooltip,
  useClipboard
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ExternalLinkIcon, CheckIcon, Clock, AlertTriangle } from 'lucide-react';
import TransactionFlow from './DeploymentFlow';
import { TimeDisplay } from './DeploymentFlow';

interface StatusIndicatorProps {
  isConfirmed: boolean;
  isFailed: boolean;
  timestamp: number;
  estimatedTime?: number;
}

interface TransactionCardProps {
  txId: string;
  type: 'swap' | 'deploy';
  isConfirmed: boolean;
  isFailed: boolean;
  timestamp: number;
  progress: number;
  estimatedTime: number;
}

interface DeploymentStatusProps {
  contractId: string;
  swapTxId: string;
  deployTxId: string;
  timestamp: number;
  onRemove?: () => void;
}

interface TransactionState {
  status: 'pending' | 'success' | 'failed' | 'dropped';
  burnBlockHeight?: number;
  lastChecked: number;
}

const SWAP_ESTIMATED_TIME = 600; // 10 minutes
const DEPLOY_ESTIMATED_TIME = 600; // 10 minutes

// Add this interface to track transaction completion status
interface CompletedTransaction {
  status: 'success' | 'failed' | 'dropped';
  timestamp: number;
  elapsedTime: number;
}

// Create a completion cache
const completedTransactions = new Map<string, CompletedTransaction>();

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isConfirmed, isFailed, timestamp, estimatedTime }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    // For completed transactions, use cached elapsed time
    if (isConfirmed || isFailed) {
      const finalElapsed = Math.floor((Date.now() - timestamp) / 1000);
      setElapsed(finalElapsed);
      return; // Don't set up interval for completed transactions
    }

    // Only set up interval for pending transactions
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timestamp) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [timestamp, isConfirmed, isFailed]);

  const remainingTime = estimatedTime ? Math.max(0, estimatedTime - elapsed) : 0;

  if (isFailed) {
    return (
      <HStack spacing={3} align="center">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 1 }}
        >
          <Box
            w="12px"
            h="12px"
            borderRadius="full"
            bg="red.400"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <AlertTriangle size={8} color="white" />
          </Box>
        </motion.div>

        <Text
          fontSize="sm"
          fontWeight="medium"
          color="red.300"
        >
          Failed
        </Text>
      </HStack>
    );
  }

  if (isConfirmed) {
    return (
      <HStack spacing={3} align="center">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 1.1 }}
          transition={{ duration: 0.2 }}
        >
          <Box
            w="12px"
            h="12px"
            borderRadius="full"
            bg="green.400"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <CheckIcon size={8} color="white" />
          </Box>
        </motion.div>

        <Text
          fontSize="sm"
          fontWeight="medium"
          color="green.300"
        >
          Confirmed
        </Text>
      </HStack>
    );
  }

  return (
    <HStack spacing={3} align="center">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.7, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        <Box
          w="12px"
          h="12px"
          borderRadius="full"
          bg="orange.400"
          display="flex"
          alignItems="center"
          justifyContent="center"
        />
      </motion.div>

      <HStack spacing={2}>
        <Text
          fontSize="sm"
          fontWeight="medium"
          color="orange.300"
        >
          In Progress
        </Text>
        
        <Tooltip
          label={`Estimated ${Math.ceil(remainingTime / 60)} minutes remaining`}
          placement="right"
        >
          <HStack spacing={1} color="orange.300">
            <Clock size={14} />
            <Text fontSize="xs" fontFamily="mono">
              <TimeDisplay elapsed={elapsed} />
              {remainingTime > 0 && ` / ~${Math.ceil(remainingTime / 60)}m`}
            </Text>
          </HStack>
        </Tooltip>
      </HStack>
    </HStack>
  );
};

const TransactionCard: React.FC<TransactionCardProps> = ({ 
  txId, 
  type, 
  isConfirmed,
  isFailed,
  timestamp, 
  progress,
  estimatedTime
}) => {
  const { hasCopied, onCopy } = useClipboard(txId || '');

  if (!txId?.trim()) {
    return null;
  }

  return (
    <Box
      bg="gray.800"
      borderRadius="xl"
      p={6}
      border="1px solid"
      borderColor={
        isFailed ? "red.500/20" :
        isConfirmed ? "green.500/20" : 
        "orange.500/20"
      }
      transition="all 0.3s"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: isFailed ? "red.500/40" :
                   isConfirmed ? "green.500/40" : 
                   "orange.500/40"
      }}
      role="group"
    >
      <VStack spacing={4} align="stretch">
        <Flex justify="space-between" align="center">
          <HStack spacing={4}>
            <StatusIndicator 
              isConfirmed={isConfirmed}
              isFailed={isFailed}
              timestamp={timestamp}
              estimatedTime={estimatedTime}
            />
            <Text color="white" fontWeight="bold">
              {type === 'swap' ? 'NOCC Swap' : 'Contract Deployment'}
            </Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.400">TxID:</Text>
            <Code 
              onClick={onCopy}
              cursor="pointer"
              bg="gray.900"
              color="gray.300"
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
              _hover={{ bg: 'gray.700' }}
            >
              {hasCopied ? 'Copied!' : `${txId.slice(0, 6)}...${txId.slice(-4)}`}
            </Code>
            {isConfirmed && (
              <Badge
                colorScheme="green"
                variant="solid"
                px={3}
                py={1}
                borderRadius="full"
              >
                Confirmed
              </Badge>
            )}
          </HStack>
        </Flex>

        <TransactionFlow 
          type={type}
          txId={txId}
        />

        <Flex justify="flex-end" align="center">
          <Link
            href={`https://explorer.stacks.co/txid/${txId}`}
            isExternal
            color="blue.300"
            fontSize="sm"
            display="flex"
            alignItems="center"
            _hover={{ color: "blue.200" }}
          >
            View transaction
            <ExternalLinkIcon size={12} className="ml-1" />
          </Link>
        </Flex>
      </VStack>
    </Box>
  );
};

// Update the transaction state cache to be more persistent
const transactionStateCache = new Map<string, TransactionState>();

// Add a new function to get cached transaction state
const getCachedTransactionState = (txId: string): TransactionState | null => {
  const state = transactionStateCache.get(txId);
  if (!state) return null;

  // Return cached state if it's a final state
  if (['success', 'failed', 'dropped'].includes(state.status)) {
    return state;
  }

  // For pending states, check if cache is still valid (15 seconds)
  if (Date.now() - state.lastChecked < 15000) {
    return state;
  }

  return null;
};

export const DeploymentStatus: React.FC<DeploymentStatusProps> = ({
  contractId,
  swapTxId,
  deployTxId,
  timestamp,
  onRemove
}) => {
  const [swapConfirmed, setSwapConfirmed] = useState<boolean>(false);
  const [swapFailed, setSwapFailed] = useState<boolean>(false);
  const [swapDropped, setSwapDropped] = useState<boolean>(false);
  const [deployConfirmed, setDeployConfirmed] = useState<boolean>(false);
  const [deployFailed, setDeployFailed] = useState<boolean>(false);
  const [deployDropped, setDeployDropped] = useState<boolean>(false);
  const [burnBlockHeight, setBurnBlockHeight] = useState<number | undefined>();

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkTransaction = async (txId: string): Promise<TransactionState | null> => {
      // Check if transaction is already completed
      const completed = completedTransactions.get(txId);
      if (completed) {
        return {
          status: completed.status,
          lastChecked: completed.timestamp,
          burnBlockHeight: undefined
        };
      }

      // Check cache for pending transactions
      const cachedState = getCachedTransactionState(txId);
      if (cachedState) {
        return cachedState;
      }

      try {
        const response = await fetch(`/api/check-transaction?txId=${txId}`);
        if (!response.ok) return null;

        const data = await response.json();
        const newState: TransactionState = {
          status: data.tx_status === 'success' ? 'success' :
                 data.tx_status?.startsWith('abort') ? 'failed' :
                 data.tx_status === 'dropped' ? 'dropped' : 'pending',
          burnBlockHeight: data.burn_block_height,
          lastChecked: Date.now()
        };

        // If transaction is complete, add to completion cache
        if (newState.status !== 'pending') {
          completedTransactions.set(txId, {
            status: newState.status as 'success' | 'failed' | 'dropped',
            timestamp: Date.now(),
            elapsedTime: Math.floor((Date.now() - timestamp) / 1000)
          });
        }

        return newState;
      } catch (error) {
        console.warn('Error checking transaction:', error);
        return null;
      }
    };

    const updateTransactionStates = async () => {
      if (!isMounted) return;

      // Don't check if both transactions are already completed
      const swapCompleted = completedTransactions.has(swapTxId);
      const deployCompleted = completedTransactions.has(deployTxId);
      
      if (swapCompleted && deployCompleted) {
        return;
      }

      // Check swap transaction if needed
      if (swapTxId && !swapCompleted) {
        const swapState = await checkTransaction(swapTxId);
        if (swapState && isMounted) {
          setSwapConfirmed(swapState.status === 'success');
          setSwapFailed(swapState.status === 'failed');
          setSwapDropped(swapState.status === 'dropped');
        }
      }

      // Only check deploy if swap is complete or no swap
      if (deployTxId && !deployCompleted && (swapCompleted || !swapTxId)) {
        const deployState = await checkTransaction(deployTxId);
        if (deployState && isMounted) {
          setDeployConfirmed(deployState.status === 'success');
          setDeployFailed(deployState.status === 'failed');
          setDeployDropped(deployState.status === 'dropped');
          if (deployState.burnBlockHeight) {
            setBurnBlockHeight(deployState.burnBlockHeight);
          }
        }
      }

      // Only continue polling if there are incomplete transactions
      const needsMoreChecks = (!swapCompleted && swapTxId) || 
                            (!deployCompleted && deployTxId && (swapCompleted || !swapTxId));

      if (needsMoreChecks && isMounted) {
        timeoutId = setTimeout(updateTransactionStates, 15000);
      }
    };

    // Initial check
    updateTransactionStates();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [swapTxId, deployTxId, timestamp]);

  // If both transactions are dropped, don't render anything
  if (swapDropped && deployDropped) {
    return null;
  }

  return (
    <Container maxW="container.lg" p={0}>
      <Box 
        bg="gray.900"
        borderRadius="xl"
        p={8}
        boxShadow="2xl"
        border="1px solid"
        borderColor="gray.800"
      >
        <VStack spacing={6} align="stretch">
          <Flex justify="space-between" align="center">
            <Text
              fontSize="2xl"
              fontWeight="bold"
              bgGradient="linear(to-r, orange.400, purple.500)"
              bgClip="text"
            >
              Deployment Progress
            </Text>
            {swapConfirmed && deployConfirmed && (
              <Badge
                colorScheme="green"
                variant="subtle"
                px={3}
                py={1}
                borderRadius="full"
                display="flex"
                alignItems="center"
                gap={2}
              >
                <CheckIcon size={12} />
                All Confirmed
              </Badge>
            )}
          </Flex>

          <Box
            bg="gray.800"
            p={4}
            borderRadius="xl"
            borderLeft="4px"
            borderLeftColor="blue.400"
          >
            <VStack align="stretch" spacing={2}>
              <Text color="gray.400" fontSize="sm">Contract ID</Text>
              <Code
                p={2}
                borderRadius="md"
                bg="gray.900"
                color="blue.300"
                fontSize="sm"
                fontFamily="mono"
              >
                {contractId}
              </Code>
            </VStack>
          </Box>

          <VStack spacing={6} align="stretch">
            <TransactionCard
              txId={swapTxId}
              type="swap"
              isConfirmed={swapConfirmed}
              isFailed={swapFailed}
              timestamp={timestamp}
              progress={0}
              estimatedTime={SWAP_ESTIMATED_TIME}
            />
            <TransactionCard
              txId={deployTxId}
              type="deploy"
              isConfirmed={deployConfirmed}
              isFailed={deployFailed}
              timestamp={timestamp}
              progress={0}
              estimatedTime={DEPLOY_ESTIMATED_TIME}
            />
          </VStack>
        </VStack>
      </Box>
    </Container>
  );
}

export default DeploymentStatus;