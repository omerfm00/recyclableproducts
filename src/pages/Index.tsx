import CameraView from "@/components/CameraView";
import { Scan } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border px-4 py-3 flex items-center gap-2">
        <Scan className="w-4 h-4 text-primary" />
        <h1 className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
          Vision Detect
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center py-6">
        <CameraView />
      </main>
    </div>
  );
};

export default Index;
