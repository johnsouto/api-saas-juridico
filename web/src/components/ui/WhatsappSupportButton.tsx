"use client";

const WHATSAPP_SUPPORT_URL =
  "https://api.whatsapp.com/send?phone=5521976818750&text=Ol%C3%A1!%20Preciso%20de%20suporte%20no%20Elemento%20Juris.";

export function WhatsappSupportButton() {
  return (
    <a
      href={WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte WhatsApp Elemento Juris"
      title="Falar com suporte no WhatsApp"
      className={[
        "fixed bottom-6 right-6 z-[999]",
        "inline-flex h-12 w-12 items-center justify-center rounded-full p-3",
        "bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.35)]",
        "transition-all duration-300 hover:scale-105 hover:bg-[#20bf5d]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-3"
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-current" aria-hidden="true" focusable="false">
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0 11.93 11.93 0 0 0 1.7 17.81L0 24l6.34-1.66a11.93 11.93 0 0 0 5.73 1.46h.01c6.59 0 11.94-5.35 11.95-11.93a11.85 11.85 0 0 0-3.51-8.39ZM12.08 21.78h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.76.99 1-3.67-.24-.38a9.86 9.86 0 0 1-1.5-5.24c0-5.44 4.43-9.86 9.89-9.86a9.8 9.8 0 0 1 6.99 2.9 9.8 9.8 0 0 1 2.89 6.97c0 5.45-4.43 9.87-9.88 9.87Zm5.41-7.4c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.95 1.17c-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47a8.94 8.94 0 0 1-1.66-2.07c-.17-.3-.02-.45.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.62-.92-2.23-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.04 1.01-1.04 2.47s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.1 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.31.17-1.43-.07-.13-.27-.2-.57-.35Z" />
      </svg>
      <span className="hidden text-sm font-semibold leading-none sm:inline">Suporte</span>
    </a>
  );
}
