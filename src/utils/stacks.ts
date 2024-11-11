import { AppConfig, UserSession } from '@stacks/connect';
import { StacksMainnet } from '@stacks/network';
import { 
  fetchCallReadOnlyFunction, 
  cvToString, 
  standardPrincipalCV,
  ClarityValue
} from '@stacks/transactions';

export const appConfig = new AppConfig(['store_write', 'publish_data']);

export const getUserSession = () => {
  if (typeof window !== 'undefined') {
    return new UserSession({ appConfig });
  }
  return null;
};

export const network = new StacksMainnet();

export const NOCC_TOKEN_CONTRACT = {
  address: 'SP12JCJYJJ31C59MV94SNFFM4687H9A04Q3BHTAJM',
  name: 'NoCodeClarity-Token',
  assetName: 'NOCC'
};

export async function getNOCCBalance(address: string): Promise<string> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: NOCC_TOKEN_CONTRACT.address,
        contractName: NOCC_TOKEN_CONTRACT.name,
        functionName: 'get-balance',
        functionArgs: [standardPrincipalCV(address)],
        senderAddress: address,
        network: 'mainnet',
      });
  
      if (result) {
        const balanceString = cvToString(result as ClarityValue);
        return balanceString;
      }
      return '0';
    } catch (error) {
      console.error('Error fetching NOCC balance:', error);
      return '0';
    }
  }

  export function formatNOCCAmount(balanceStr: string): string {
    try {
      // Extract the number from the clarity response
      const match = balanceStr.match(/\(ok u(\d+)\)/);
      if (!match) return '0';
      
      // Get the raw balance in micro-NOCC
      const microBalance = parseInt(match[1], 10);
      
      // Convert to NOCC (divide by 1,000 since NOCC has 3 decimals)
      const noccBalance = microBalance / 1_000;
      
      // Format with k/M/B suffixes based on NOCC amount
      if (noccBalance >= 1_000_000_000) {
        return `${(noccBalance / 1_000_000_000).toFixed(1)}B`;
      } else if (noccBalance >= 1_000_000) {
        return `${(noccBalance / 1_000_000).toFixed(1)}M`;
      } else if (noccBalance >= 1_000) {
        return `${(noccBalance / 1_000).toFixed(1)}k`;
      } else {
        return noccBalance.toFixed(1);
      }
    } catch (error) {
      console.error('Error formatting NOCC balance:', error);
      return '0';
    }
  }

export const formatWithCommas = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const validateClarityCode = (code: string): boolean => {
  if (!code.trim()) return false;
  const hasOpeningParens = code.includes('(');
  const hasClosingParens = code.includes(')');
  const hasDefine = code.includes('define');
  return hasOpeningParens && hasClosingParens && hasDefine;
};

export const estimateDeploymentCost = async (contractSize: number): Promise<number> => {
  const baseGas = 0.1;
  const sizeMultiplier = 0.001;
  return baseGas + (contractSize * sizeMultiplier);
};

export async function fetchAccountNonce(address: string): Promise<bigint> {
    try {
      const response = await fetch(`https://api.mainnet.hiro.so/v2/accounts/${address}`);
      const data = await response.json();
      return BigInt(data.nonce);
    } catch (error) {
      console.error('Error fetching nonce:', error);
      return BigInt(0);
    }
}

// Add this function to get STX balance
export async function getSTXBalance(address: string): Promise<string> {
  try {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError;

    while (retryCount < maxRetries) {
      try {
        const response = await fetch(
          `https://api.mainnet.hiro.so/extended/v1/address/${address}/stx`,
          {
            headers: {
              'Accept': 'application/json',
            },
            mode: 'cors',
          }
        );

        if (response.status === 429) {
          // Rate limited - wait and retry
          const waitTime = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.balance;
      } catch (error) {
        lastError = error;
        retryCount++;
        if (retryCount === maxRetries) break;
        
        // Wait before retrying
        const waitTime = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  } catch (error) {
    console.error('Error fetching STX balance:', error);
    return '0';
  }
}

// Add this function to format STX amount
export function formatSTXAmount(balanceStr: string): string {
  try {
    const balance = parseInt(balanceStr, 10);
    const stxBalance = balance / 1_000_000; // Convert microSTX to STX
    
    // Format with k/M/B suffixes based on STX amount
    if (stxBalance >= 1_000_000_000) {
      return `${(stxBalance / 1_000_000_000).toFixed(1)}B`;
    } else if (stxBalance >= 1_000_000) {
      return `${(stxBalance / 1_000_000).toFixed(1)}M`;
    } else if (stxBalance >= 1_000) {
      return `${(stxBalance / 1_000).toFixed(1)}k`;
    } else {
      // For values less than 1000, show up to 3 decimal places
      // but trim trailing zeros
      const formatted = stxBalance.toFixed(3);
      return formatted.replace(/\.?0+$/, '');
    }
  } catch (error) {
    console.error('Error formatting STX balance:', error);
    return '0';
  }
}

export const hasEnoughNOCC = async (address: string, requiredAmount: number): Promise<boolean> => {
  try {
    const noccBalanceStr = await getNOCCBalance(address);
    const match = noccBalanceStr.match(/\(ok u(\d+)\)/);
    if (!match) return false;
    
    const microBalance = parseInt(match[1], 10);
    const noccBalance = microBalance / 1_000; // Convert to standard units (NOCC has 3 decimals)
    return noccBalance >= requiredAmount;
  } catch (error) {
    console.error('Error checking NOCC balance:', error);
    return false;
  }
};