import { Box, Container, Text, HStack, Link, Icon } from '@chakra-ui/react';
import { Github, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <Box 
      as="footer" 
      bg="nocc.header" 
      borderTop="1px" 
      borderColor="whiteAlpha.200"
      py={6}
      mt="auto"
    >
      <Container maxW="container.xl">
        <HStack justify="space-between" align="center">
          <Text color="gray.400" fontSize="sm">
            © {new Date().getFullYear()} NOCC Deployer. All rights reserved.
          </Text>
          
          <HStack spacing={4}>
            <Link 
              href="https://github.com/NoCodeClarity-OU" 
              isExternal
              color="gray.400"
              _hover={{ color: "white" }}
            >
              <Icon as={Github} boxSize={5} />
            </Link>
            <Link 
              href="https://x.com/nocodeclarity" 
              isExternal
              color="gray.400"
              _hover={{ color: "white" }}
            >
              <Icon as={Twitter} boxSize={5} />
            </Link>
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}
