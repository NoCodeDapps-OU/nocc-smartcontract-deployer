import { Box, Container, Heading, Text, VStack, Image } from '@chakra-ui/react';
import ConnectWallet from '../components/ConnectWallet';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <Box minH="100vh" bg="nocc.background" display="flex" flexDirection="column">
      <Box flex="1">
        <Container maxW="container.xl" pt={20}>
          <VStack spacing={8} align="center" pt={20}>
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

              <ConnectWallet />
            </VStack>
          </VStack>
        </Container>
      </Box>
      <Footer />
    </Box>
  );
}
