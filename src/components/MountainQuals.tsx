import { useState, useEffect } from "react";
import type { URLSerializable } from "@/utils/types";

export interface MountainQualsData {
  hasMountainEndorsement: boolean;
  hasMountainCertification: boolean;
}

interface MountainQualsProps {
  onUpdate: (data: URLSerializable<MountainQualsData>) => void;
  initialData: URLSerializable<MountainQualsData>;
}

const DEFAULT_DATA: URLSerializable<MountainQualsData> = {
  hasMountainEndorsement: false,
  hasMountainCertification: false,
};

export default function MountainQuals({
  onUpdate,
  initialData = DEFAULT_DATA,
}: MountainQualsProps) {
  const [data, setData] =
    useState<URLSerializable<MountainQualsData>>(initialData);

  // Sync with parent state
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  return (
    <section className="flex flex-col gap-4 w-full max-w-2xl">
      <h2>Mountain Pilot Qualifications</h2>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.hasMountainEndorsement}
            onChange={(e) => {
              const newData = {
                ...data,
                hasMountainEndorsement: e.target.checked,
              };
              setData(newData);
              onUpdate(newData);
            }}
          />
          Current CAPF 70-5 Mountain Flight Endorsement?
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.hasMountainCertification}
            onChange={(e) => {
              const newData = {
                ...data,
                hasMountainCertification: e.target.checked,
              };
              setData(newData);
              onUpdate(newData);
            }}
          />
          Current CAPF 70-91 and Mountain Flying Certification?
        </label>
      </div>
    </section>
  );
}
