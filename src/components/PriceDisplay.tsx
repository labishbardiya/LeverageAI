"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  price: number | null;
  className?: string;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Huge price with flash: red on any change, then green when price drops.
 */
export function PriceDisplay({ price, className = "" }: Props) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"none" | "up" | "down">("none");

  useEffect(() => {
    if (price == null) {
      prev.current = null;
      return;
    }
    const p = prev.current;
    if (p != null && p !== price) {
      setFlash(price < p ? "down" : "up");
      const t = setTimeout(() => setFlash("none"), 900);
      prev.current = price;
      return () => clearTimeout(t);
    }
    prev.current = price;
  }, [price]);

  if (price == null) {
    return (
      <div
        className={`font-semibold tabular-nums text-5xl leading-none text-white/35 ${className}`}
      >
        —
      </div>
    );
  }

  const color =
    flash === "down"
      ? "text-[#6ee7b7] price-flash-down"
      : flash === "up"
        ? "text-[#fda4af] price-flash-up"
        : "text-white";

  return (
    <div
      className={`font-semibold tabular-nums text-5xl leading-none transition-colors duration-300 ${color} ${className}`}
    >
      {formatUsd(price)}
    </div>
  );
}
