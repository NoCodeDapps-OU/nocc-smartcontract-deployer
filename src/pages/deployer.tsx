import { Box, Container, VStack, Text, Divider } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import ContractInput from '../components/ContractInput';
import DeployButton from '../components/DeployButton';
import DeploymentStatus from '../components/DeploymentStatus';
import { getUserSession } from '../utils/stacks';

interface DeploymentInfo {
  contractId: string;
  swapTxId: string;
  deployTxId: string;
  timestamp: number;
}

interface DeploymentHistory {
  deployments: DeploymentInfo[];
}

export default function Deployer() {
  const router = useRouter();
  const [contractData, setContractData] = useState({
    name: '',
    code: ''
  });
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentInfo[]>([]);

  useEffect(() => {
    const userSession = getUserSession();
    if (!userSession?.isUserSignedIn()) {
      router.push('/');
      return;
    }

    // Get address of connected wallet
    const address = userSession.loadUserData().profile.stxAddress.mainnet;
    
    // Load deployment history from localStorage for this address
    const historyKey = `deployment-history-${address}`;
    const savedHistory = localStorage.getItem(historyKey);
    if (savedHistory) {
      setDeploymentHistory(JSON.parse(savedHistory));
    }
  }, [router]);

  const handleDeploymentStart = (info: DeploymentInfo) => {
    setDeploymentInfo(info);
    
    // Add to history
    const userSession = getUserSession();
    if (userSession?.isUserSignedIn()) {
      const address = userSession.loadUserData().profile.stxAddress.mainnet;
      const historyKey = `deployment-history-${address}`;
      const newHistory = [info, ...deploymentHistory];
      setDeploymentHistory(newHistory);
      localStorage.setItem(historyKey, JSON.stringify(newHistory));
    }
  };

  return (
    <Box minH="100vh" bg="nocc.background">
      <Header />
      <Container maxW="container.xl" pt="80px" pb={10}>
        <VStack spacing={8} align="stretch">
          {/* Contract Editor Card */}
          <Box 
            bg="#1E1E1E" // VS Code-like dark background
            borderRadius="xl" 
            overflow="hidden"
            border="1px"
            borderColor="gray.700"
            boxShadow="xl"
          >
            <Box p={6} bg="#1E1E1E">
              <VStack spacing={4} align="stretch">
                {/* Label styling */}
                <ContractInput
                  values={contractData}
                  onChange={setContractData}
                />
              </VStack>
            </Box>
            <Box 
              p={4} 
              borderTop="1px" 
              borderColor="gray.700"
              bg="#1E1E1E"
              sx={{
                '& button': {
                  bg: 'nocc.primary', // Orange primary color
                  color: 'gray.900', // Dark text on orange
                  fontWeight: 'bold',
                  _hover: {
                    bg: 'orange.400',
                    transform: 'translateY(-1px)',
                    boxShadow: 'md',
                  },
                  _active: {
                    bg: 'orange.500',
                    transform: 'translateY(0)',
                  },
                  _disabled: {
                    bg: 'gray.600',
                    opacity: 0.7,
                    cursor: 'not-allowed',
                    _hover: {
                      bg: 'gray.600',
                      transform: 'none',
                      boxShadow: 'none',
                    }
                  }
                }
              }}
            >
              <DeployButton 
                contractData={contractData} 
                onDeploymentStart={handleDeploymentStart}
              />
            </Box>
          </Box>

          {/* Current Deployment Status - remains the same */}
          {deploymentInfo && (
            <Box 
              bg="#1E1E1E"
              borderRadius="xl"
              p={0}
              overflow="hidden"
              border="1px"
              borderColor="gray.700"
            >
              <DeploymentStatus {...deploymentInfo} />
            </Box>
          )}

          {/* Deployment History - remains the same but with updated background */}
          {deploymentHistory.length > 0 && (
            <>
              <Divider my={8} borderColor="gray.700" />
              <Text
                fontSize="xl"
                fontWeight="bold"
                color="gray.200"
                mb={4}
              >
                Previous Deployments
              </Text>
              <VStack spacing={6}>
                {deploymentHistory.map((deployment, index) => (
                  <Box 
                    key={`${deployment.deployTxId}-${index}`}
                    bg="#1E1E1E"
                    borderRadius="xl"
                    p={0}
                    overflow="hidden"
                    border="1px"
                    borderColor="gray.700"
                  >
                    <DeploymentStatus {...deployment} />
                  </Box>
                ))}
              </VStack>
            </>
          )}
        </VStack>
      </Container>
    </Box>
  );
}