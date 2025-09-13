import { useState, useEffect } from "react";
import type { URLSerializable } from "@/utils/types";

export interface MountainQualsData {
  mtnEndorse: boolean;
  mtnCert: boolean;
}

interface MountainQualsProps {
  onUpdate: (data: URLSerializable<MountainQualsData>) => void;
  initialData: URLSerializable<MountainQualsData>;
}

const DEFAULT_DATA: URLSerializable<MountainQualsData> = {
  mtnEndorse: false,
  mtnCert: false,
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
            checked={data.mtnEndorse}
            onChange={(e) => {
              const newData = {
                ...data,
                mtnEndorse: e.target.checked,
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
            checked={data.mtnCert}
            onChange={(e) => {
              const newData = {
                ...data,
                mtnCert: e.target.checked,
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
