import { openContractCall } from '@stacks/connect';
import { StacksNetwork, StacksMainnet } from '@stacks/network';
import { velarSDK } from '../config/velar';

export interface DeployContractOptions {
  contractName: string;
  contractCode: string;
  senderAddress: string;
}

export interface GasFeeEstimate {
    low: {
      fee: number;
      noccAmount: number;
    };
    standard: {
      fee: number;
      noccAmount: number;
    };
    high: {
      fee: number;
      noccAmount: number;
    };
  }
  
  export interface SwapEstimate {
    // The NOCC amount in standard units (e.g. 3324.48)
    noccAmount: number;
    
    // The STX amount in micro units (e.g. 500000)
    stxAmount: number;
    
    // The price impact percentage (e.g. 0.5)
    priceImpact: number;
    
    // The minimum tokens to receive in micro units
    minimumReceived: number;
    
    // Optional route for the swap
    route?: string[];
  }
  
  export interface FeeEstimation {
    fee: number;
    caller: string;
  }

class DeploymentService {
  private network: StacksNetwork;

  constructor() {
    this.network = new StacksMainnet();
  }

  async deployContract(options: DeployContractOptions) {
    const { contractName, contractCode, senderAddress } = options;

    try {
      // Get deployment cost estimate
      const bytecodeLength = new Blob([contractCode]).size;
      const estimatedCost = await this.estimateDeploymentCost(bytecodeLength);

      // Get deployment transaction options from Velar SDK
      const deployOptions = await (velarSDK as any).getDeployOptions({
        contractName,
        contractCode,
        senderAddress,
        estimatedCost,
        network: 'mainnet'
      });

      return openContractCall({
        ...deployOptions,
        onFinish: (data) => {
          console.log("Deployment successful:", data);
        },
        onCancel: () => {
          console.log("Deployment cancelled");
        }
      });
    } catch (error) {
      console.error("Deployment error:", error);
      throw error;
    }
  }

  private async estimateDeploymentCost(bytecodeLength: number): Promise<bigint> {
    const baseCost = BigInt(10_000_000); // 10 NOCC base cost
    const byteMultiplier = BigInt(1_000); // 0.001 NOCC per byte
    
    return baseCost + (BigInt(bytecodeLength) * byteMultiplier);
  }
}

export const deploymentService = new DeploymentService();
