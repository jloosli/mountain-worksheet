"use client";

import { useState, useEffect } from "react";

export function useTempUnit() {
  const [useFahrenheit, setUseFahrenheit] = useState(false);

  useEffect(() => {
    setUseFahrenheit(localStorage.getItem("tempUnit") === "F");
  }, []);

  const toggleTempUnit = () => {
    const next = !useFahrenheit;
    localStorage.setItem("tempUnit", next ? "F" : "C");
    setUseFahrenheit(next);
  };

  return { useFahrenheit, toggleTempUnit };
}
