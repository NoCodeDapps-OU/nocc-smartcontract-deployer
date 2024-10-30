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
      });
  
      if (result) {
        const balanceString = cvToString(result as ClarityValue);
        // console.log('Raw balance string:', balanceString);
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
    //   console.log('Raw micro-NOCC balance:', microBalance);
      
      // Convert to NOCC (divide by 1,000,000)
      const noccBalance = microBalance / 1_000_000;
      // console.log('NOCC balance:', noccBalance);
      
      // Now format with k/M suffixes based on NOCC amount
      // 100,000 NOCC = 100M micro-NOCC
      if (noccBalance >= 100_000) {
        return `${(noccBalance / 1_000).toFixed(1)}M`;
      // 100 NOCC = 100K micro-NOCC
      } else if (noccBalance >= 100) {
        return `${noccBalance.toFixed(1)}K`;
      } else {
        return noccBalance.toFixed(1);
      }
    } catch (error) {
      console.error('Error formatting balance:', error);
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
      const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${address}/stx`);
      const data = await response.json();
      return data.balance;
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
      
      if (stxBalance >= 100_000) {
        return `${(stxBalance / 1_000).toFixed(1)}M`;
      } else if (stxBalance >= 100) {
        return `${stxBalance.toFixed(1)}K`;
      } else {
        return stxBalance.toFixed(1);
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