import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("py-14 sm:py-20", className)}>
      {children}
    </section>
  );
}
