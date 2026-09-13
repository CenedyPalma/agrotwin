import { Check, Loader2, Circle, X } from "lucide-react";
import type { ProcessingJob, ProcessingStep } from "@/lib/types";

function StepRow({ step, isCurrent }: { step: ProcessingStep; isCurrent: boolean }) {
  const icon =
    step.status === "complete" ? (
      <Check size={16} className="text-healthy" />
    ) : step.status === "failed" ? (
      <X size={16} className="text-problem" />
    ) : isCurrent ? (
      <Loader2 size={16} className="animate-spin text-attention" />
    ) : (
      <Circle size={14} className="text-muted-foreground" />
    );

  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      {icon}
      <span className={step.status === "pending" ? "text-muted-foreground" : ""}>{step.label}</span>
    </div>
  );
}

export function ProcessingProgress({ job, title = "Creating Digital Twin" }: { job: ProcessingJob; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">{job.status}</span>
      </div>
      <div>
        {job.steps.map((step) => (
          <StepRow key={step.key} step={step} isCurrent={job.current_step === step.key} />
        ))}
      </div>
    </div>
  );
}
