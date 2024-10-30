export const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  export const validateClarityCode = (code: string): boolean => {
    // Basic validation - can be enhanced with more sophisticated checks
    if (!code.trim()) return false;
    
    // Check for basic Clarity syntax
    const hasOpeningParens = code.includes('(');
    const hasClosingParens = code.includes(')');
    const hasDefine = code.includes('define');
    
    return hasOpeningParens && hasClosingParens && hasDefine;
  };
  
  export const estimateDeploymentCost = async (contractSize: number): Promise<number> => {
    // This is a placeholder function - implement actual cost estimation logic
    const baseGas = 0.1; // Base gas cost in STX
    const sizeMultiplier = 0.001; // Additional cost per byte
    return baseGas + (contractSize * sizeMultiplier);
  };