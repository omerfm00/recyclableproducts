import CameraView from "@/components/CameraView";
import { Scan } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="w-full border-b border-border px-4 py-3 flex items-center gap-3">
        <Scan className="w-5 h-5 text-primary neon-text" />
        <h1 className="font-mono text-sm font-bold tracking-widest uppercase text-foreground neon-text">
          Vision Detect
        </h1>
        <span className="ml-auto font-mono text-xs text-muted-foreground">v1.0</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-8">
        <CameraView />
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border px-4 py-2 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          Heuristic AI · No external model required · Real-time analysis
        </p>
      </footer>
    </div>
  );
};

export default Index;
