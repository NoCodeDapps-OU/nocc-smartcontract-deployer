import { VelarSDK } from '@velarprotocol/velar-sdk';

export const VELAR_CONFIG = {
  TOKENS: {
    NOCC: 'NOCC',
    STX: 'STX'
  }
};

// Initialize Velar SDK
export const velarSDK = new VelarSDK();