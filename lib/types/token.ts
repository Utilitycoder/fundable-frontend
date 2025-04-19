export interface TokenOption {
  symbol: string;
  address: string;
  decimals: number;
}

export interface TokenMap {
  [key: string]: TokenOption;
} 