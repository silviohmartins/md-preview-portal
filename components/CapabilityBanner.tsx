"use client";

type CapabilityBannerProps = {
  visible: boolean;
  onDismiss?: () => void;
};

export function CapabilityBanner({ visible, onDismiss }: CapabilityBannerProps) {
  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center gap-3 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300"
      data-testid="fs-capability-banner"
      role="status"
    >
      <span>Neste navegador, salvar baixa uma cópia e as anotações da pasta valem somente para esta abertura.</span>
      {onDismiss && <button type="button" onClick={onDismiss} className="ui-pressable min-h-10 shrink-0 rounded-md px-2 font-medium hover:bg-amber-500/10" aria-label="Dispensar aviso de compatibilidade">Entendi</button>}
    </div>
  );
}
