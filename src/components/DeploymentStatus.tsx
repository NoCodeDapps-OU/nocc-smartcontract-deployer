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
import { ExternalLinkIcon, CheckIcon, Clock } from 'lucide-react';
import TransactionFlow from './DeploymentFlow';
import { TimeDisplay } from './DeploymentFlow';
  
  interface StatusIndicatorProps {
    isConfirmed: boolean;
    timestamp: number;
    estimatedTime?: number;
  }
  
  interface TransactionCardProps {
    txId: string;
    type: 'swap' | 'deploy';
    isConfirmed: boolean;
    timestamp: number;
    progress: number;
    estimatedTime: number;
  }
  
  interface DeploymentStatusProps {
    contractId: string;
    swapTxId: string;
    deployTxId: string;
    timestamp: number;
  }
  
  const SWAP_ESTIMATED_TIME = 600; // 10 minutes
  const DEPLOY_ESTIMATED_TIME = 600; // 10 minutes
  
  const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isConfirmed, timestamp, estimatedTime }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (isConfirmed) {
      setElapsed(Math.floor((Date.now() - timestamp) / 1000));
      return;
    }

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timestamp) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [timestamp, isConfirmed]);

  const remainingTime = estimatedTime ? Math.max(0, estimatedTime - elapsed) : 0;

  return (
    <HStack spacing={3} align="center">
      <motion.div
        animate={{
          scale: isConfirmed ? 1 : [1, 1.2, 1],
          opacity: isConfirmed ? 1 : [1, 0.7, 1],
        }}
        transition={{
          duration: 2,
          repeat: isConfirmed ? 0 : Infinity,
        }}
      >
        <Box
          w="12px"
          h="12px"
          borderRadius="full"
          bg={isConfirmed ? "green.400" : "orange.400"}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {isConfirmed && <CheckIcon size={8} color="white" />}
        </Box>
      </motion.div>

      <HStack spacing={2}>
        <Text
          fontSize="sm"
          fontWeight="medium"
          color={isConfirmed ? "green.300" : "orange.300"}
        >
          {isConfirmed ? 'Confirmed' : `In Progress`}
        </Text>
        
        <Tooltip
          label={isConfirmed ? 
            `Confirmed in ${elapsed}s` : 
            `Estimated ${Math.ceil(remainingTime / 60)} minutes remaining`
          }
          placement="right"
        >
          <HStack spacing={1} color={isConfirmed ? "green.300" : "orange.300"}>
            <Clock size={14} />
            <Text fontSize="xs" fontFamily="mono">
              <TimeDisplay elapsed={elapsed} />
              {!isConfirmed && remainingTime > 0 && ` / ~${Math.ceil(remainingTime / 60)}m`}
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
    timestamp, 
    progress,
    estimatedTime
  }) => {
  const { hasCopied, onCopy } = useClipboard(txId);

  return (
    <Box
      bg="gray.800"
      borderRadius="xl"
      p={6}
      border="1px solid"
      borderColor={isConfirmed ? "green.500/20" : "orange.500/20"}
      transition="all 0.3s"
      _hover={{
        transform: "translateY(-2px)",
        borderColor: isConfirmed ? "green.500/40" : "orange.500/40"
      }}
      role="group"
    >
      <VStack spacing={4} align="stretch">
        <Flex justify="space-between" align="center">
          <HStack spacing={4}>
            <StatusIndicator 
              isConfirmed={isConfirmed} 
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

const DeploymentStatus: React.FC<DeploymentStatusProps> = ({
    contractId,
    swapTxId,
    deployTxId,
    timestamp
  }) => {
  const [swapConfirmed, setSwapConfirmed] = useState<boolean>(false);
  const [deployConfirmed, setDeployConfirmed] = useState<boolean>(false);
  const [swapProgress, setSwapProgress] = useState<number>(0);
  const [deployProgress, setDeployProgress] = useState<number>(0);

  const checkTransactionStatus = async (txId: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/tx/${txId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.tx_status === 'success';
    } catch (error) {
      console.error('Error checking transaction status:', error);
      return false;
    }
  };

  useEffect(() => {
    const progressInterval = setInterval(() => {
      if (!swapConfirmed) {
        const elapsed = (Date.now() - timestamp) / 1000;
        const newProgress = Math.min(95, (elapsed / SWAP_ESTIMATED_TIME) * 100);
        setSwapProgress(newProgress);
      }
      if (!deployConfirmed && swapConfirmed) {
        const elapsed = (Date.now() - timestamp) / 1000;
        const newProgress = Math.min(95, (elapsed / DEPLOY_ESTIMATED_TIME) * 100);
        setDeployProgress(newProgress);
      }
    }, 1000);

    return () => clearInterval(progressInterval);
  }, [swapConfirmed, deployConfirmed, timestamp]);

  useEffect(() => {
    const checkStatus = async () => {
      if (!swapConfirmed) {
        const swapStatus = await checkTransactionStatus(swapTxId);
        if (swapStatus) {
          setSwapConfirmed(true);
          setSwapProgress(100);
        }
      }
      if (!deployConfirmed && swapConfirmed) {
        const deployStatus = await checkTransactionStatus(deployTxId);
        if (deployStatus) {
          setDeployConfirmed(true);
          setDeployProgress(100);
        }
      }
    };

    const interval = setInterval(checkStatus, 5000);
    checkStatus();
    return () => clearInterval(interval);
  }, [swapTxId, deployTxId, swapConfirmed, deployConfirmed]);

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
              timestamp={timestamp}
              progress={swapProgress}
              estimatedTime={SWAP_ESTIMATED_TIME}
            />
            <TransactionCard
              txId={deployTxId}
              type="deploy"
              isConfirmed={deployConfirmed}
              timestamp={timestamp}
              progress={deployProgress}
              estimatedTime={DEPLOY_ESTIMATED_TIME}
            />
          </VStack>
        </VStack>
      </Box>
    </Container>
  );
}

export default DeploymentStatus;