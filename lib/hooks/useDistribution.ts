import { useState, useCallback, useMemo } from 'react';
import { DistributionData } from '@/lib/types/distribution';
import { TokenOption } from '@/lib/types/token';
import { useAccount } from '@starknet-react/core';

interface DistributionState {
  distributions: DistributionData[];
  distributionType: 'equal' | 'weighted';
  equalAmount: string;
  lumpSum: string;
  selectedToken: TokenOption | null;
  amountInputType: 'perAddress' | 'lumpSum';
  isLoading: boolean;
}

interface DistributionActions {
  addDistribution: (address: string, amount: string) => void;
  updateDistribution: (index: number, field: keyof DistributionData, value: string) => void;
  removeDistribution: (index: number) => void;
  setDistributionType: (type: 'equal' | 'weighted') => void;
  setEqualAmount: (amount: string) => void;
  setLumpSum: (amount: string) => void;
  setSelectedToken: (token: TokenOption | null) => void;
  setAmountInputType: (type: 'perAddress' | 'lumpSum') => void;
  setIsLoading: (loading: boolean) => void;
  clearDistributions: () => void;
}

export const useDistribution = () => {
  const { address } = useAccount();
  const [state, setState] = useState<DistributionState>({
    distributions: [],
    distributionType: 'equal',
    equalAmount: '',
    lumpSum: '',
    selectedToken: null,
    amountInputType: 'perAddress',
    isLoading: false,
  });

  // Memoize the state to prevent unnecessary re-renders
  const memoizedState = useMemo(() => state, [
    state.distributions,
    state.distributionType,
    state.equalAmount,
    state.lumpSum,
    state.selectedToken,
    state.amountInputType,
    state.isLoading,
  ]);

  const addDistribution = useCallback((address: string, amount: string) => {
    setState(prev => ({
      ...prev,
      distributions: [...prev.distributions, { address, amount }]
    }));
  }, []);

  const updateDistribution = useCallback((index: number, field: keyof DistributionData, value: string) => {
    setState(prev => {
      // Only update if the value has actually changed
      if (prev.distributions[index]?.[field] === value) {
        return prev;
      }
      const newDistributions = [...prev.distributions];
      newDistributions[index] = {
        ...newDistributions[index],
        [field]: value,
      };
      return { ...prev, distributions: newDistributions };
    });
  }, []);

  const removeDistribution = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      distributions: prev.distributions.filter((_, i) => i !== index)
    }));
  }, []);

  const setDistributionType = useCallback((type: 'equal' | 'weighted') => {
    setState(prev => {
      if (prev.distributionType === type) return prev;
      return { ...prev, distributionType: type };
    });
  }, []);

  const setEqualAmount = useCallback((amount: string) => {
    setState(prev => {
      if (prev.equalAmount === amount) return prev;
      const newDistributions = prev.distributions.map(dist => ({
        ...dist,
        amount: amount
      }));
      return { ...prev, equalAmount: amount, distributions: newDistributions };
    });
  }, []);

  const setLumpSum = useCallback((amount: string) => {
    setState(prev => {
      if (prev.lumpSum === amount) return prev;
      return { ...prev, lumpSum: amount };
    });
  }, []);

  const setSelectedToken = useCallback((token: TokenOption | null) => {
    setState(prev => {
      if (prev.selectedToken === token) return prev;
      return { ...prev, selectedToken: token };
    });
  }, []);

  const setAmountInputType = useCallback((type: 'perAddress' | 'lumpSum') => {
    setState(prev => {
      if (prev.amountInputType === type) return prev;
      return { ...prev, amountInputType: type };
    });
  }, []);

  const setIsLoading = useCallback((loading: boolean) => {
    setState(prev => {
      if (prev.isLoading === loading) return prev;
      return { ...prev, isLoading: loading };
    });
  }, []);

  const clearDistributions = useCallback(() => {
    setState(prev => {
      if (prev.distributions.length === 0) return prev;
      return { ...prev, distributions: [] };
    });
  }, []);

  // Derived state with memoization
  const totalRecipients = useMemo(() => memoizedState.distributions.length, [memoizedState.distributions]);
  
  const totalAmount = useMemo(() => {
    return memoizedState.distributions.reduce((sum, dist) => {
      const amount = parseFloat(dist.amount || '0');
      return isNaN(amount) ? sum : sum + amount;
    }, 0).toString();
  }, [memoizedState.distributions]);

  // Memoize the actions object to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    addDistribution,
    updateDistribution,
    removeDistribution,
    setDistributionType,
    setEqualAmount,
    setLumpSum,
    setSelectedToken,
    setAmountInputType,
    setIsLoading,
    clearDistributions,
  }), [
    addDistribution,
    updateDistribution,
    removeDistribution,
    setDistributionType,
    setEqualAmount,
    setLumpSum,
    setSelectedToken,
    setAmountInputType,
    setIsLoading,
    clearDistributions,
  ]);

  return {
    ...memoizedState,
    ...actions,
    totalRecipients,
    totalAmount,
  };
}; 