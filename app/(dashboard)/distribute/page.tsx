"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAccount, useNetwork } from "@starknet-react/core";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { cairo, Call } from "starknet";
import { validateDistribution } from "@/utils/validation";
import { toast } from "react-hot-toast";
import { parseUnits } from "ethers";
import { Switch } from "@/components/ui/switch";
import TokenDistributionWallet from "@/components/ui/distribute/TokenDistributionWallet";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import DistributeSkeleton from "@/components/ui/distribute/DistributeSkeleton";
import CartridgeWalletInfo from "@/components/ui/distribute/CartridgeWalletInfo";
import { useCartridge } from "@/lib/hooks/useCartridge";
import { DistributionData } from "@/lib/types/distribution";
import { TokenOption } from "@/lib/types/token";
import { MAINNET_CONTRACT_ADDRESS, TESTNET_CONTRACT_ADDRESS, MAINNET_SUPPORTED_TOKENS, TESTNET_SUPPORTED_TOKENS } from "@/lib/constants/tokens";
import { useDistribution } from "@/lib/hooks/useDistribution";
import { DistributionList } from '@/components/ui/distribute/DistributionList';

// Add proper type for CSV parsing result
type CSVRow = [string, string];

export default function DistributePage() {
  const { isMounted, hasPrevWallet } = useIsMounted();
  const { address, status, account } = useAccount();
  const { isCartridgeConnected } = useCartridge();
  const { chain } = useNetwork();
  
  const {
    distributions,
    distributionType,
    equalAmount,
    lumpSum,
    selectedToken,
    amountInputType,
    isLoading,
    totalRecipients,
    totalAmount,
    setDistributionType,
    setEqualAmount,
    setLumpSum,
    setSelectedToken,
    setAmountInputType,
    setIsLoading,
    updateDistribution,
    removeDistribution,
    addDistribution,
    clearDistributions
  } = useDistribution();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingDistribution, setPendingDistribution] = useState<{
    totalAmount: string;
    recipientCount: number;
  } | null>(null);
  const [protocolFeePercentage, setProtocolFeePercentage] = useState<number>(0);
  const [isMainnet, setIsMainnet] = useState<boolean>(true);

  // Derive current contract address and supported tokens based on network
  const CONTRACT_ADDRESS = isMainnet ? MAINNET_CONTRACT_ADDRESS : TESTNET_CONTRACT_ADDRESS;
  const SUPPORTED_TOKENS = isMainnet ? MAINNET_SUPPORTED_TOKENS : TESTNET_SUPPORTED_TOKENS;

  // Initialize selected token after we know which network we're on
  useEffect(() => {
    if (SUPPORTED_TOKENS && !selectedToken) {
      setSelectedToken(SUPPORTED_TOKENS.STRK);
    }
  }, [SUPPORTED_TOKENS, selectedToken, setSelectedToken]);

  // Add new useEffect for chain checking
  useEffect(() => {
    if (!isMounted || !chain) return;
    
    if (chain.network !== "mainnet") {
      setIsMainnet(false);
      toast.error(
        "You are currently on Starknet Testnet. Switch to Starknet Mainnet to real-value distributions.",
        {
          duration: 5000,
          icon: '🔄'
        }
      );
    } else {
      setIsMainnet(true);
      toast.dismiss();
    }
  }, [chain, isMounted]);

  useEffect(() => {
    const fetchProtocolFee = async () => {
      if (!account || !isMounted) return;

      try {
        const response = await account.callContract({
          contractAddress: CONTRACT_ADDRESS,
          entrypoint: "get_protocol_fee_percent",
          calldata: [],
        });
        
        // Handle both array and object response formats
        const result = Array.isArray(response) ? response : (response as { result: string[] }).result;
        console.log("result", result);
        
        const resultValue = result[0];
        const decimalValue = parseInt(resultValue, 16);
        setProtocolFeePercentage(decimalValue);
      } catch (error) {
        console.error("Error fetching protocol fee:", error);
        toast.error("Failed to fetch protocol fee");
      }
    };

    fetchProtocolFee();
  }, [account, isMounted, CONTRACT_ADDRESS]);

  const calculateTotalAmount = () => {
    return distributions
      .reduce((sum, dist) => {
        return sum + parseFloat(dist.amount);
      }, 0)
      .toString();
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      Papa.parse<CSVRow>(file, {
        complete: (results) => {
          const parsedDistributions = results.data
            .filter((row) => row[0])
            .map((row) => ({
              address: row[0],
              amount: row[1] || equalAmount,
            }));
          clearDistributions();
          parsedDistributions.forEach(dist => addDistribution(dist.address, dist.amount));
        },
        header: false,
      });
    },
    [equalAmount, addDistribution, clearDistributions]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  // Memoize the contract address and supported tokens
  const contractConfig = useMemo(() => ({
    address: isMainnet ? MAINNET_CONTRACT_ADDRESS : TESTNET_CONTRACT_ADDRESS,
    tokens: isMainnet ? MAINNET_SUPPORTED_TOKENS : TESTNET_SUPPORTED_TOKENS,
  }), [isMainnet]);

  // Memoize the protocol fee calculation
  const protocolFee = useMemo(() => {
    if (!selectedToken || !totalAmount) return "0";
    const baseAmount = parseFloat(totalAmount);
    const fee = (baseAmount * protocolFeePercentage) / 10000;
    return fee.toString();
  }, [totalAmount, protocolFeePercentage, selectedToken]);

  // Memoize the total amount with fee
  const totalAmountWithFee = useMemo(() => {
    if (!totalAmount || !protocolFee) return "0";
    return (parseFloat(totalAmount) + parseFloat(protocolFee)).toString();
  }, [totalAmount, protocolFee]);

  const handleDistribute = async (): Promise<void> => {
    if (status !== "connected" || !address || !account) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!selectedToken) {
      toast.error("No token selected");
      return;
    }

    try {
      if (distributions.length === 0) {
        toast.error("No distributions added");
        return;
      }

      // Check for duplicate addresses
      const addressCounts = distributions.reduce((acc, dist) => {
        acc[dist.address] = (acc[dist.address] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const duplicateAddresses = Object.entries(addressCounts)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, count]) => count > 1)
        .map(([address]) => address);

      if (duplicateAddresses.length > 0) {
        toast.error(
          <div>
            Duplicate addresses found:
            <ul className="list-disc pl-4 mt-2">
              {duplicateAddresses.map((addr, i) => (
                <li key={i} className="text-sm">
                  {addr}
                </li>
              ))}
            </ul>
          </div>
        );
        return;
      }

      // Validation based on distribution type
      if (distributionType === "equal") {
        const firstAmount = distributions[0].amount;
        const hasInvalidAmount = distributions.some(
          (dist) => dist.amount !== firstAmount
        );
        if (hasInvalidAmount) {
          toast.error(
            "All distributions must have the same amount for equal distribution"
          );
          return;
        }
      }

      // Check if there are any distributions
      const validationErrors: string[] = [];
      distributions.forEach((dist, index) => {
        const validation = validateDistribution(dist.address, dist.amount);
        if (!validation.isValid && validation.error) {
          validationErrors.push(`Row ${index + 1}: ${validation.error}`);
        }
      });

      if (validationErrors.length > 0) {
        toast.error(
          <div>
            Invalid distributions:
            <ul className="list-disc pl-4 mt-2">
              {validationErrors.map((error, i) => (
                <li key={i} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        );
        return;
      }

      // Calculate total amount including protocol fee
      const baseAmount = calculateTotalAmount();
      const baseAmountBigInt = BigInt(
        parseUnits(baseAmount, selectedToken.decimals)
      );
      const protocolFeeBigInt =
        (baseAmountBigInt * BigInt(protocolFeePercentage)) / BigInt(10000);
      const totalAmountWithFee = baseAmountBigInt + protocolFeeBigInt;
      const totalAmountString = (
        Number(totalAmountWithFee) /
        10 ** selectedToken.decimals
      ).toString();

      // Show confirmation modal with total amount including fee
      setPendingDistribution({
        totalAmount: totalAmountString,
        recipientCount: distributions.length,
      });
      setShowConfirmModal(true);
    } catch (error) {
      console.error("Error getting contract ABI:", error);
      toast.error("Failed to initialize contract");
      return;
    }
  };

  const handleConfirmDistribution = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);

    try {
      if (!selectedToken) {
        throw new Error("No token selected");
      }

      toast.loading("Processing distributions...", { duration: Infinity });

      const recipients = distributions.map((dist) => dist.address);

      let tx;
      if (!account) {
        throw new Error("Account not found");
      }

      if (distributionType === "equal") {
        const token = selectedToken;
        const amounts = distributions.map((dist) =>
          BigInt(parseUnits(dist.amount, token.decimals))
        );
        const totalAmount = amounts.reduce(
          (sum, amount) => sum + BigInt(amount),
          BigInt(0)
        );

        // Calculate protocol fee
        const protocolFee =
          (totalAmount * BigInt(protocolFeePercentage)) / BigInt(10000);
        const totalAmountWithFee = totalAmount + protocolFee;

        console.log("Base Amount:", totalAmount.toString());
        console.log("Protocol Fee:", protocolFee.toString());
        console.log("Total Amount with Fee:", totalAmountWithFee.toString());

        const low =
          totalAmountWithFee & BigInt("0xffffffffffffffffffffffffffffffff");
        const high = totalAmountWithFee >> BigInt(128);

        try {
          const amountPerRecipient = cairo.uint256(amounts[0]);

          const calls: Call[] = [
            {
              entrypoint: "approve",
              contractAddress: token.address,
              calldata: [CONTRACT_ADDRESS, low.toString(), high.toString()],
            },
            {
              entrypoint: "distribute",
              contractAddress: CONTRACT_ADDRESS,
              calldata: [
                amountPerRecipient.low,
                amountPerRecipient.high,
                recipients.length.toString(),
                ...recipients,
                token.address,
              ],
            },
          ];
          const result = await account.execute(calls);
          tx = result.transaction_hash;
        } catch (error) {
          console.error("Error during contract calls:", error);
          throw new Error(
            error instanceof Error
              ? `Contract interaction failed: ${error.message}`
              : "Contract interaction failed with unknown error"
          );
        }
      } else {
        console.log("Weighted distribution");
        const token = selectedToken;
        const amounts = distributions.map((dist) =>
          parseUnits(dist.amount, token.decimals)
        );
        const totalAmount = amounts.reduce(
          (sum, amount) => sum + BigInt(amount),
          BigInt(0)
        );

        // Calculate protocol fee
        const protocolFee =
          (totalAmount * BigInt(protocolFeePercentage)) / BigInt(10000);
        const totalAmountWithFee = totalAmount + protocolFee;

        console.log("Base Amount:", totalAmount.toString());
        console.log("Protocol Fee:", protocolFee.toString());
        console.log("Total Amount with Fee:", totalAmountWithFee.toString());

        const low =
          totalAmountWithFee & BigInt("0xffffffffffffffffffffffffffffffff");
        const high = totalAmountWithFee >> BigInt(128);

        const calls: Call[] = [
          {
            entrypoint: "approve",
            contractAddress: token.address,
            calldata: [CONTRACT_ADDRESS, low.toString(), high.toString()],
          },
          {
            entrypoint: "distribute_weighted",
            contractAddress: CONTRACT_ADDRESS,
            calldata: [
              amounts.length.toString(),
              ...amounts.flatMap((amount) => {
                const uint256Value = cairo.uint256(amount);
                return [uint256Value.low, uint256Value.high];
              }),
              recipients.length.toString(),
              ...recipients,
              token.address,
            ],
          },
        ];
        const result = await account.execute(calls);
        tx = result.transaction_hash;
      }

      // Wait for receipt
      const receiptStatus = await account.waitForTransaction(tx);

      if (receiptStatus.statusReceipt === "success") {
        // Create distribution record
        try {
          const baseAmount = calculateTotalAmount();
          const protocolFee = (Number(baseAmount) * protocolFeePercentage) / 10000;
          const token = selectedToken;
          
          await fetch('/api/distributions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_address: address,
              transaction_hash: tx,
              token_address: token.address,
              token_symbol: token.symbol,
              token_decimals: token.decimals,
              total_amount: baseAmount,
              fee_amount: protocolFee.toString(),
              total_recipients: distributions.length,
              distribution_type: distributionType.toUpperCase(),
              network: isMainnet ? "MAINNET" : "TESTNET",
              status: "COMPLETED",
              metadata: {
                recipients: distributions.map(d => ({ address: d.address, amount: d.amount }))
              }
            }),
          });
        } catch (error) {
          console.error("Failed to save distribution record:", error);
          // Don't throw here - we still want to show success for the actual distribution
        }

        toast.dismiss();
        toast.success(
          `Successfully distributed tokens to ${recipients.length} addresses`,
          { duration: 10000 }
        );
        clearDistributions();
      } else {
        toast.error("Distribution failed");
      }
    } catch (error) {
      console.error("Distribution process failed:", error);
      toast.dismiss();
      toast.error(
        `Distribution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) {
    return <DistributeSkeleton />;
  }

  if (!hasPrevWallet && status === "disconnected") {
    return <TokenDistributionWallet />;
  }

  if (!selectedToken) {
    return <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#5b21b6] via-[#0d0019] to-[#0d0019]">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-5xl font-bric font-bold text-white mb-8">
          Loading Token Information...
        </h1>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#5b21b6] via-[#0d0019] to-[#0d0019]">
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bric font-bold text-white">
            Token Distribution
          </h1>
          
          {/* Network Indicator */}
          <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
            isMainnet ? 'bg-green-700' : 'bg-yellow-600'
          }`}>
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              isMainnet ? 'bg-green-400' : 'bg-yellow-300'
            }`}></div>
            <span className="font-semibold text-white">
              {isMainnet ? 'Mainnet' : 'Testnet'}
            </span>
          </div>
        </div>

        {isCartridgeConnected && <CartridgeWalletInfo />}

        {/* Token Selection Dropdown */}
        <div className="mb-8 bg-[#0d0019] bg-opacity-50 p-6 rounded-lg border border-[#5b21b6] border-opacity-20">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Select Token
          </h2>
          <select
            value={selectedToken?.symbol || ''}
            onChange={(e) => {
              if (SUPPORTED_TOKENS[e.target.value]) {
                setSelectedToken(SUPPORTED_TOKENS[e.target.value]);
              }
            }}
            className="w-full bg-[#1a1a1a] text-white border border-[#5b21b6] border-opacity-40 rounded-lg px-4 py-2 focus:outline-none focus:border-[#B102CD]"
          >
            {Object.values(SUPPORTED_TOKENS).map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Distribution Type Toggle */}
        <div className="mb-8 bg-[#0d0019] bg-opacity-50 p-6 rounded-lg border border-[#5b21b6] border-opacity-20">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Distribution Type
          </h2>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 ${
                distributionType === "equal"
                  ? "text-white font-semibold"
                  : "text-[#DADADA]"
              }`}
            >
              <label htmlFor="distribution-type">Equal</label>
              {distributionType === "equal" && (
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#440495] to-[#B102CD]" />
              )}
            </div>

            <Switch
              id="distribution-type"
              checked={distributionType === "equal"}
              onCheckedChange={(checked) => {
                setDistributionType(checked ? "equal" : "weighted");
              }}
            />

            <div
              className={`flex items-center gap-2 ${
                distributionType === "weighted"
                  ? "text-white font-semibold"
                  : "text-[#DADADA]"
              }`}
            >
              <label>Weighted</label>
              {distributionType === "weighted" && (
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#440495] to-[#B102CD]" />
              )}
            </div>
          </div>
        </div>

        {/* Add Equal Amount Input when type is 'equal' */}
        {distributionType === "equal" && (
          <div className="mb-8 bg-[#0d0019] bg-opacity-50 p-6 rounded-lg border border-[#5b21b6] border-opacity-20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Amount Distribution</h2>
              <select
                value={amountInputType}
                onChange={(e) => setAmountInputType(e.target.value as "perAddress" | "lumpSum")}
                className="bg-[#1a1a1a] text-white border border-[#5b21b6] border-opacity-40 rounded-lg px-4 py-2 focus:outline-none focus:border-[#B102CD]"
              >
                <option value="perAddress">Amount per Address</option>
                <option value="lumpSum">Lump Sum</option>
              </select>
            </div>

            <div className="space-y-4">
              {amountInputType === "lumpSum" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Lump Sum to Distribute</label>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="Enter total amount to distribute"
                      value={lumpSum}
                      onChange={(e) => setLumpSum(e.target.value)}
                      className="flex-1 bg-starknet-purple bg-opacity-50 rounded-lg px-4 py-2 text-black placeholder-gray-400"
                    />
                    <button
                      onClick={() => {
                        if (distributions.length === 0) {
                          toast.error("Add some addresses first");
                          return;
                        }
                        if (!lumpSum || isNaN(Number(lumpSum))) {
                          toast.error("Please enter a valid lump sum amount");
                          return;
                        }
                        const perAddressAmount = (Number(lumpSum) / distributions.length).toFixed(2);
                        setEqualAmount(perAddressAmount);
                        addDistribution("", perAddressAmount);
                        toast.success(`Calculated ${perAddressAmount} per address for ${distributions.length} addresses`);
                      }}
                      className="px-6 py-2 bg-gradient-to-r from-[#440495] to-[#B102CD] hover:from-[#B102CD] hover:to-[#440495] text-white font-bold rounded-lg transition-all"
                    >
                      Calculate
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount per Address</label>
                  <input
                    type="text"
                    placeholder="Amount to distribute per address"
                    value={equalAmount}
                    onChange={(e) => {
                      setEqualAmount(e.target.value);
                      addDistribution("", e.target.value);
                    }}
                    className="w-full bg-starknet-purple bg-opacity-50 rounded-lg px-4 py-2 text-black placeholder-gray-400"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* CSV Upload Section */}
        <div
          {...getRootProps()}
          className={`border-2 border-starknet-cyan rounded-lg p-8 mb-8 text-center cursor-pointer
            ${isDragActive ? "bg-starknet-purple bg-opacity-20" : ""}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the CSV file here...</p>
          ) : (
            <div>
              <p className="text-white">
                Drag and drop a CSV file here, or click to select a file
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {distributionType === "equal"
                  ? "CSV format: address (one per line)"
                  : "CSV format: address,amount (one per line)"}
              </p>
            </div>
          )}
        </div>

        {/* Manual Input Section */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Manual Input</h2>
            <button
              onClick={() => addDistribution("", "")}
              className="px-6 py-3 bg-gradient-to-r from-[#440495] to-[#B102CD] hover:from-[#B102CD] hover:to-[#440495] text-white font-bold rounded-full transition-all"
            >
              Add Row
            </button>
          </div>
          <DistributionList
            distributions={distributions}
            onUpdate={updateDistribution}
            onRemove={removeDistribution}
          />
        </div>

        {/* Distribution Button */}
        <button
          onClick={handleDistribute}
          disabled={isLoading || distributions.length === 0}
          className={`w-full px-6 py-3 bg-gradient-to-r from-[#440495] to-[#B102CD] text-white font-bold rounded-full
            ${
              isLoading || distributions.length === 0
                ? "opacity-50 cursor-not-allowed from-gray-500 to-gray-600"
                : "hover:from-[#B102CD] hover:to-[#440495]"
            }
            transition-all`}
        >
          {isLoading ? "Processing..." : "Distribute Tokens"}
        </button>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmDistribution}
        totalAmount={pendingDistribution?.totalAmount || "0"}
        recipientCount={pendingDistribution?.recipientCount || 0}
        selectedToken={selectedToken?.symbol || ""}
        protocolFeePercentage={protocolFeePercentage}
      />
    </div>
  );
} 