import { AppSidebar } from '@/components/shared/AppSidebar';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { AIChatBubble } from '@/components/shared/AIChatBubble';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <CommandPalette />
      <main className="flex-1 ml-[260px] relative">
        {/* Top gradient accent line */}
        <div className="gradient-accent-line h-[2px] w-full sticky top-0 z-30" />
        {/* Content area with dot grid pattern */}
        <div className="min-h-screen bg-dot-grid py-6 px-8">{children}</div>
      </main>
      <AIChatBubble />
    </div>
  );
}
