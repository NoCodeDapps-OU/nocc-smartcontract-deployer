import { 
  PostConditionMode,
  Pc,
} from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';
import { 
  SwapType, 
  VelarSDK,
  ISwapService,
} from '@velarprotocol/velar-sdk';
import { getUserSession, openContractCall, openContractDeploy } from '@stacks/connect';  // Add openContractDeploy
import { fetchAccountNonce } from '../utils/stacks';
import { SwapEstimate } from './DeploymentService';
import { velarSDK } from '@/config/velar';
import { hasEnoughNOCC } from '../utils/stacks';

export interface DeploymentOptions {
  contractName: string;
  contractCode: string;
  senderAddress: string;
  senderKey: string;
  selectedFee: number;
  swapEstimate: { // Remove optional marker
    noccAmount: number;
    route?: string[];
  };
}

export interface DeploymentResult {
  swapTxId: string;
  deployTxId: string;
  contractId: string;
}

interface SwapPayload {
  amount: number;
  type: SwapType;
  slippage?: number;
}

class VelarDeploymentService {
  private sdk: VelarSDK;
  private network: StacksMainnet;
  
  private readonly NOCC_CONTRACT: `${string}.${string}` = 'SP12JCJYJJ31C59MV94SNFFM4687H9A04Q3BHTAJM.NoCodeClarity-Token';
  private readonly NOCC_SYMBOL = 'NOCC';
  private readonly STX_SYMBOL = 'STX';
  private readonly NOCC_MICRO_MULTIPLIER = 1_000; // NOCC has 3 decimal places
  private readonly STX_MICRO_MULTIPLIER = 1_000_000; // STX has 6 decimal places
  private readonly slippageTolerance = 0.05; // 5% slippage

  
  constructor() {
    this.sdk = new VelarSDK();
    this.network = new StacksMainnet();
  }



  async getSwapInstance(senderAddress: string): Promise<ISwapService> {
    if (!senderAddress || !senderAddress.startsWith('SP')) {
      throw new Error('Invalid sender address format');
    }

    try {
      return await this.sdk.getSwapInstance({
        account: senderAddress,
        inToken: this.NOCC_SYMBOL,
        outToken: this.STX_SYMBOL
      });
    } catch (error) {
      console.error('Error creating swap instance:', error);
      throw new Error('Failed to initialize swap service');
    }
  }

  private calculateBaseFee(byteLength: number): number {
    const BASE_FEE = 0.001 * this.NOCC_MICRO_MULTIPLIER;
    const BYTE_FEE = 0.00001 * this.NOCC_MICRO_MULTIPLIER;
    return Math.ceil(BASE_FEE + (byteLength * BYTE_FEE));
  }  

  validateGasFee(fee: number) {
    const minFee = 1000; // Minimum fee in microSTX
    
    if (fee < minFee) {
      return {
        isValid: false,
        warning: 'Gas fee too low - transaction likely to fail'
      };
    }
  
    if (fee < minFee * 2) {
      return {
        isValid: true,
        warning: 'Low gas fee may result in longer confirmation time'
      };
    }
  
    return { isValid: true };
  }
  
  async estimateNOCCSwap(stxAmount: number): Promise<number> {
    try {
      const userSession = getUserSession();
      if (!userSession?.isUserSignedIn()) {
        throw new Error('No wallet connected');
      }
  
      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
  
      const swapInstance = await this.sdk.getSwapInstance({
        account: senderAddress,
        inToken: this.NOCC_SYMBOL,
        outToken: this.STX_SYMBOL
      });
  
      const stxAmountStandard = stxAmount / this.STX_MICRO_MULTIPLIER;
  
      const result = await swapInstance.getComputedAmount({
        amount: stxAmountStandard,
        type: SwapType.TWO, // Type 2 for exact output
        slippage: 0.05
      });
  
      if (!result?.value) {
        console.warn('No swap value returned, using 1:1 ratio');
        return stxAmountStandard;
      }
  
      // NOCC amount is already in standard units
      return Number(result.value);
  
    } catch (error) {
      console.error('NOCC swap estimation error:', error);
      return stxAmount / this.STX_MICRO_MULTIPLIER;
    }
  }  
  
  private calculatePriceImpact(noccAmount: number, stxAmount: number): number {
    const EXPECTED_RATE = 1; // Base exchange rate (1 NOCC = 1 STX)
    const actualRate = stxAmount / noccAmount;
    return Math.min(Math.abs((actualRate - EXPECTED_RATE) / EXPECTED_RATE) * 100, 100);
  }

  private async getNetworkCongestion() {
    try {
      const response = await fetch('https://api.mainnet.hiro.so/extended/v2/tx/mempool');
      const data = await response.json();
      const mempoolSize = data.total || 0;
      
      return {
        low: mempoolSize < 100 ? '~10 mins' : '~30 mins',
        standard: '~5 mins',
        high: '~2 mins'
      };
    } catch (error) {
      console.error('Error fetching congestion:', error);
      return {
        low: '~20 mins',
        standard: '~10 mins',
        high: '~5 mins'
      };
    }
  }
  
  async estimateGasFees(contractCode: string) {
    const byteLength = new TextEncoder().encode(contractCode).length;
    const baseFee = this.calculateBaseFee(byteLength);

    try {
      const congestion = await this.getNetworkCongestion();
      
      const low = Math.round(baseFee * 0.8);
      const standard = baseFee;
      const high = Math.round(baseFee * 1.5);

      const estimates = {
        low: {
          fee: low,
          time: congestion.low,
          noccAmount: await this.estimateNOCCSwap(low)
        },
        standard: {
          fee: standard,
          time: congestion.standard,
          noccAmount: await this.estimateNOCCSwap(standard)
        },
        high: {
          fee: high,
          time: congestion.high,
          noccAmount: await this.estimateNOCCSwap(high)
        }
      };

      return estimates;
    } catch (error) {
      console.error('Fee estimation error:', error);
      throw error;
    }
  }
  
  async estimateSwap(stxAmount: number): Promise<SwapEstimate> {
    try {
      const userSession = getUserSession();
      if (!userSession?.isUserSignedIn()) {
        throw new Error('No wallet connected');
      }
  
      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
      
      const swapInstance: ISwapService = await this.sdk.getSwapInstance({
        account: senderAddress,
        inToken: this.NOCC_SYMBOL,
        outToken: this.STX_SYMBOL,
      });
  
      const result = await swapInstance.getComputedAmount({
        amount: stxAmount / this.STX_MICRO_MULTIPLIER,
        type: SwapType.TWO,
        slippage: 0.05
      });      
  
      if (!result?.value) {
        throw new Error('Failed to compute swap amount');
      }
  
      const noccAmount = Number(result.value);
      const priceImpact = this.calculatePriceImpact(noccAmount, stxAmount);
  
      return {
        noccAmount,
        stxAmount,
        priceImpact,
        minimumReceived: stxAmount * 0.95, // 5% slippage
        route: result.route || []
      };
    } catch (error) {
      console.error('Swap estimation error:', error);
      throw error;
    }
  }


  private validateAddress(address: string | undefined): boolean {
    if (!address) {
      console.error('No address provided for validation');
      return false;
    }

    // Log the address being validated
    console.log('Validating address:', address);

    // Check if it's a valid Stacks address format (mainnet or testnet)
    // Updated length check to allow for both 39 and 40 character addresses after prefix
    const isValid = (address.startsWith('SP') || address.startsWith('ST')) && 
                   (address.length >= 39 && address.length <= 41) && 
                   /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(address);

    if (!isValid) {
      console.error('Invalid address format:', {
        startsWithSPorST: address.startsWith('SP') || address.startsWith('ST'),
        length: address.length,
        validLength: address.length >= 39 && address.length <= 41,
        address
      });
    } else {
      console.log('Address validation successful:', address);
    }

    return isValid;
  }

  private async executeNOCCSwap(
    selectedFee: number,
    swapEstimate: { noccAmount: number; route?: string[] }
  ): Promise<string> {
    try {
      const userSession = getUserSession();
      if (!userSession?.isUserSignedIn()) {
        throw new Error('No wallet connected');
      }

      const senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;

      const swapInstance = await velarSDK.getSwapInstance({
        account: senderAddress,
        inToken: 'NOCC',
        outToken: 'STX'
      });

      // Convert STX amount to standard units for the swap
      const stxInStandard = selectedFee / this.STX_MICRO_MULTIPLIER;

      console.log('Executing swap with:', {
        stxAmount: stxInStandard,
        noccEstimate: swapEstimate.noccAmount,
        route: swapEstimate.route || []
      });

      // Get swap response with exact output amount
      const swapResponse = await swapInstance.swap({
        amount: stxInStandard,
        type: SwapType.TWO, // Exact output
        slippage: 0.05, // 5% slippage tolerance
        route: swapEstimate.route || [] // Include the route
      } as SwapPayload);

      // Create post condition using the amt-in-max from swap response
      const amtInMax = swapResponse.functionArgs[6]; // amt-in-max UIntCV
      const amtInMaxValue = Number(amtInMax.value);

      console.log('Swap response:', {
        amtInMaxValue,
        functionArgs: swapResponse.functionArgs,
        route: swapEstimate.route || []
      });

      const postCondition = Pc.principal(senderAddress)
        .willSendGte(amtInMaxValue)
        .ft(this.NOCC_CONTRACT, 'nocc');

      return new Promise((resolve, reject) => {
        openContractCall({
          ...swapResponse,
          network: 'mainnet',
          postConditionMode: PostConditionMode.Deny,
          postConditions: [postCondition],
          appDetails: {
            name: "NOCC Contract Deployer",
            icon: "/nocc-logo.png"
          },
          onFinish: data => resolve(data.txId),
          onCancel: () => reject(new Error('Swap cancelled by user')),
        });
      });
    } catch (error) {
      console.error('Swap execution error:', error);
      throw error;
    }
  }

  private async validateNOCCBalance(senderAddress: string, requiredAmount: number): Promise<void> {
    const hasBalance = await hasEnoughNOCC(senderAddress, requiredAmount);
    if (!hasBalance) {
      throw new Error('Insufficient NOCC balance to execute the swap');
    }
  }

  async deployContract(options: DeploymentOptions): Promise<DeploymentResult> {
    const { contractName, contractCode, selectedFee, swapEstimate } = options;
  
    // Get the address from userSession if not provided in options
    let senderAddress = options.senderAddress;
    if (!senderAddress) {
      const userSession = getUserSession();
      if (!userSession?.isUserSignedIn()) {
        throw new Error('No wallet connected');
      }
      senderAddress = userSession.loadUserData().profile.stxAddress.mainnet;
    }

    console.log('Attempting deployment with address:', senderAddress);

    if (!this.validateAddress(senderAddress)) {
      throw new Error(
        `Invalid sender address format: ${senderAddress}. ` +
        `Address must be a valid Stacks address starting with SP (mainnet) or ST (testnet) ` +
        `and be between 39-41 characters long.`
      );
    }
  
    // Add validation to ensure swapEstimate exists
    if (!swapEstimate || typeof swapEstimate.noccAmount !== 'number') {
      throw new Error('Invalid swap estimate provided');
    }
  
    try {
      // Validate NOCC balance before proceeding
      await this.validateNOCCBalance(senderAddress, swapEstimate.noccAmount);
      
      const swapTxId = await this.executeNOCCSwap(selectedFee, swapEstimate);
      console.log('Swap transaction broadcast:', swapTxId);
  
      const currentNonce = await fetchAccountNonce(senderAddress);
      await new Promise(r => setTimeout(r, 2000));
  
      return new Promise((resolve, reject) => {
        openContractDeploy({
          contractName: contractName,
          codeBody: contractCode,
          network: 'mainnet',
          postConditionMode: PostConditionMode.Allow,
          nonce: Number(currentNonce) + 1,
          fee: selectedFee,
          appDetails: {
            name: "NOCC Contract Deployer",
            icon: "/nocc-logo.png"
          },
          onFinish: data => {
            const result: DeploymentResult = {
              swapTxId,
              deployTxId: data.txId,
              contractId: `${senderAddress}.${contractName}`
            };
            resolve(result);
          },
          onCancel: () => reject(new Error('Contract deployment cancelled by user')),
        });
      });
  
    } catch (error) {
      console.error('Deployment error:', error);
      if (error instanceof Error) {
        throw new Error(`Deployment failed: ${error.message}`);
      }
      throw error;
    }
  }
}

export const velarDeploymentService = new VelarDeploymentService();