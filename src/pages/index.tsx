import { Box, Container, Heading, Text, Button, VStack, Image } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useConnect } from '@stacks/connect-react';
import { getUserSession } from '../utils/stacks';
import { useRouter } from 'next/router';

export default function Home() {
  const { doOpenAuth } = useConnect();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userSession = getUserSession();
      if (userSession?.isUserSignedIn()) {
        router.push('/deployer');
      } else {
        setIsLoading(false);
      }
    }
  }, [router]);

  if (isLoading) {
    return null;
  }

  return (
    <Box 
      minH="100vh" 
      bg="nocc.background"
      display="flex" 
      alignItems="center" 
      justifyContent="center"
      position="relative"
      py={16}
    >
      <Container maxW="container.md">
        <VStack spacing={12}>
          <Image
            src="/nocc-logo.png"
            alt="NOCC Logo"
            width={200}
            height={200}
            mb={6}
            objectFit="contain"
          />
          
          <VStack spacing={6}>
            <Heading variant="gradient"> 
              Welcome to NOCC Smart Contract Deployer
            </Heading>
            
            <Text variant="description">
              Now you can deploy your smart contracts utilizing your NOCC 
              tokens. Connect your wallet to get started with seamless 
              contract deployment.
            </Text>

            <Button
              variant="primary"
              size="lg"
              onClick={() => doOpenAuth()}
              px={8}
              py={6}
              fontSize="lg"
              mt={4}
              bg="#FF9F0A"
              color="black"
              _hover={{
                bg: '#FFB340'
              }}
              _active={{
                bg: '#F59300'
              }}
            >
              Connect Wallet
            </Button>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
