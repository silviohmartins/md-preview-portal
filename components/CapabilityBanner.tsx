"use client";

type CapabilityBannerProps = {
  visible: boolean;
};

export function CapabilityBanner({ visible }: CapabilityBannerProps) {
  if (!visible) return null;

  return (
    <div
      className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300"
      data-testid="fs-capability-banner"
      role="status"
    >
      Neste browser o salvamento baixa uma cópia; no Chrome/Edge grava no arquivo
      original.
    </div>
  );
}
