import { AppSidebar } from '@/components/shared/AppSidebar';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { AIChatBubble } from '@/components/shared/AIChatBubble';
import { PWAProvider } from '@/components/providers/PWAProvider';
import { SWRProvider } from '@/components/providers/SWRProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <PWAProvider />
      <TooltipProvider>
        <div className="flex min-h-screen overflow-x-hidden bg-background">
          <AppSidebar />
          <CommandPalette />
          <main className="relative ml-0 flex-1 overflow-x-hidden md:ml-[280px]">
            {/* Top gradient accent line */}
            <div className="gradient-accent-line sticky top-0 z-30 hidden h-[2px] w-full md:block" />
            {/* Content area with dot grid pattern */}
            <div className="min-h-screen overflow-x-hidden bg-dot-grid px-4 py-5 pt-20 sm:px-5 md:px-8 md:py-6 md:pt-6">{children}</div>
          </main>
          <AIChatBubble />
        </div>
      </TooltipProvider>
      <Toaster richColors position="top-center" />
    </SWRProvider>
  );
}
