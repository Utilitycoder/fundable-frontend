import { memo } from 'react';
import { DistributionData } from '@/lib/types/distribution';

interface DistributionListProps {
  distributions: DistributionData[];
  onUpdate: (index: number, field: keyof DistributionData, value: string) => void;
  onRemove: (index: number) => void;
}

const DistributionRow = memo(({ 
  distribution, 
  index, 
  onUpdate, 
  onRemove 
}: { 
  distribution: DistributionData; 
  index: number;
  onUpdate: (index: number, field: keyof DistributionData, value: string) => void;
  onRemove: (index: number) => void;
}) => (
  <div key={index} className="flex gap-4">
    <input
      type="text"
      placeholder="Address"
      value={distribution.address}
      onChange={(e) => onUpdate(index, "address", e.target.value)}
      className="flex-1 bg-starknet-purple bg-opacity-50 rounded-lg px-4 py-2 text-black placeholder-gray-400"
    />
    <input
      type="text"
      placeholder="Amount"
      value={distribution.amount}
      onChange={(e) => onUpdate(index, "amount", e.target.value)}
      className="w-32 bg-starknet-purple bg-opacity-50 rounded-lg px-4 py-2 text-black placeholder-gray-400"
    />
    <button
      onClick={() => onRemove(index)}
      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-all"
    >
      Remove
    </button>
  </div>
));

DistributionRow.displayName = 'DistributionRow';

export const DistributionList = memo(({ distributions, onUpdate, onRemove }: DistributionListProps) => (
  <div className="space-y-4">
    {distributions.map((distribution, index) => (
      <DistributionRow
        key={`${distribution.address}-${index}`}
        distribution={distribution}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
    ))}
  </div>
));

DistributionList.displayName = 'DistributionList'; 