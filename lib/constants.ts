// Function to get the explorer URL based on network and tx hash
export const getExplorerUrl = (network: string, txHash: string): string => {
  const baseUrl = network === 'MAINNET' 
    ? 'https://voyager.online/tx/' 
    : 'https://sepolia.voyager.online/tx/';
  
  return `${baseUrl}${txHash}`;
};