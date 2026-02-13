import { cn } from "@/lib/utils";

export function TiltCard({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group [perspective:1200px]", className)}>
      <div
        className={cn(
          "h-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:p-6",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform",
          "group-hover:border-white/18 group-hover:shadow-[0_10px_40px_rgba(0,0,0,0.35),0_0_60px_rgba(35,64,102,0.22)]",
          "group-hover:[transform:translateY(-6px)_rotateX(6deg)_rotateY(-6deg)]",
          "motion-reduce:transition-none motion-reduce:transform-none motion-reduce:group-hover:transform-none"
        )}
      >
        {children}
      </div>
    </div>
  );
}
