import { Box, Flex, Text, Button, useClipboard, HStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { getUserSession, getNOCCBalance, formatNOCCAmount, getSTXBalance, formatSTXAmount } from '../utils/stacks';

const Header = () => {
  const [noccBalance, setNoccBalance] = useState<string>('0');
  const [stxBalance, setStxBalance] = useState<string>('0');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [showSTX, setShowSTX] = useState<boolean>(false);
  const { hasCopied, onCopy } = useClipboard(walletAddress);
  
  useEffect(() => {
    const userSession = getUserSession();
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    async function fetchBalances() {
      if (userSession?.isUserSignedIn()) {
        try {
          const address = userSession.loadUserData().profile.stxAddress.mainnet;
          if (!isMounted) return;
          setWalletAddress(address);
          
          // Fetch both balances concurrently
          const [noccBal, stxBal] = await Promise.all([
            getNOCCBalance(address),
            getSTXBalance(address)
          ]);

          if (!isMounted) return;
          
          setNoccBalance(noccBal);
          setStxBalance(stxBal);
        } catch (error) {
          console.warn('Error fetching balances:', error);
        }
      }
    }

    // Initial fetch
    fetchBalances();
    
    // Set up polling interval for live updates
    intervalId = setInterval(fetchBalances, 10000); // Poll every 10 seconds
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleDisconnect = () => {
    const userSession = getUserSession();
    if (userSession?.isUserSignedIn()) {
      userSession.signUserOut();
      window.location.href = '/';
    }
  };

  const toggleBalance = () => {
    setShowSTX(prev => !prev);
  };

  // Format the balance display with proper decimals
  const displayBalance = showSTX ? 
    `${formatSTXAmount(stxBalance)} STX` : 
    `${formatNOCCAmount(noccBalance)} NOCC`;

  return (
    <Box 
      as="header" 
      bg="nocc.header" 
      position="fixed" 
      top={0} 
      left={0} 
      right={0} 
      zIndex={10}
      borderBottom="1px"
      borderColor="whiteAlpha.200"
    >
      <Flex 
        maxW="1200px" 
        mx="auto" 
        px={4} 
        py={3} 
        alignItems="center" 
        justifyContent="space-between"
      >
        <Text variant="logo">
          NOCC
        </Text>

        {walletAddress && (
          <Flex alignItems="center" gap={4}>
            <Flex alignItems="center">
              <Text color="gray.300" mr={1}>Balance:</Text>
              <Text 
                as="button"
                fontWeight="bold" 
                color={showSTX ? "purple.400" : "nocc.text.orange"}
                onClick={toggleBalance}
                cursor="pointer"
                _hover={{ opacity: 0.8 }}
                transition="opacity 0.2s"
              >
                {displayBalance}
              </Text>
            </Flex>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCopy}
              color="nocc.text.secondary"
              fontFamily="mono"
              fontSize="sm"
              _hover={{ bg: 'whiteAlpha.100' }}
            >
              {hasCopied ? 'Copied!' : formatAddress(walletAddress)}
            </Button>
            <Button
              size="sm"
              variant="disconnect"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </Flex>
        )}
      </Flex>
    </Box>
  );
};

export default Header;