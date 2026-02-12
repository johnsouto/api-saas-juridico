import { PlatformGuard } from "@/components/platform/PlatformGuard";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformGuard>{children}</PlatformGuard>;
}
