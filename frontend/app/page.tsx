import Link from "next/link";
import { Leaf, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white mb-6">
        <Leaf size={28} />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">AgroTwin</h1>
      <p className="mt-2 text-muted-foreground max-w-md">
        Your Field. Your Digital Twin. Your Insights.
      </p>
      <p className="mt-4 max-w-lg text-sm text-muted-foreground">
        A local-first agricultural digital twin platform. Visualize drone surveys,
        explore your fields in 3D, and track crop health — starting with soybean.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
      >
        Open Dashboard <ArrowRight size={16} />
      </Link>
    </div>
  );
}
