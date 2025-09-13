import type { URLSerializable } from "@/utils/types";

interface AircraftWeightData {
  weight: number | null;
}

interface Props {
  initialData: URLSerializable<AircraftWeightData>;
  onUpdate: (data: URLSerializable<AircraftWeightData>) => void;
}

export type { AircraftWeightData };

export default function AircraftWeight({
  initialData = { weight: null },
  onUpdate,
}: Props) {
  const handleWeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value === "" ? null : Number(event.target.value);
    onUpdate({ weight: value });
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      <h2>Aircraft Takeoff Weight</h2>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={initialData.weight ?? ""}
            onChange={handleWeightChange}
            placeholder="Enter weight"
            className="p-2 border rounded"
            min={2200}
            max={3600}
          />
          <span>lbs</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Obtain from ForeFlight W&B; must be between 2200 and 3600 pounds
          <br />
          See aircraft POH for weights outside this range (Note 5)
        </p>
      </div>
    </div>
  );
}
