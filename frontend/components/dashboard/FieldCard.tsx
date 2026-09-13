import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { FieldSummary } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MethodBadge, MockDataBadge, statusOverall } from "./StatusPill";

const STATUS_CLASS = {
  healthy: "border-healthy/40 bg-healthy/10 text-healthy",
  attention: "border-attention/40 bg-attention/10 text-attention",
  problem: "border-problem/40 bg-problem/10 text-problem",
};

export function FieldCard({ field }: { field: FieldSummary }) {
  const status = statusOverall(
    field.healthy_area_percent,
    field.attention_area_percent,
    field.problem_area_percent
  );

  return (
    <Card className="gap-4">
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{field.crop_type}</div>
          <h3 className="font-semibold text-lg leading-tight">{field.name}</h3>
          {field.area_hectares != null && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> {field.area_hectares} ha
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MethodBadge method={field.analysis_method} />
          {field.analysis_is_mock && <MockDataBadge />}
        </div>
      </CardHeader>

      <CardContent>
        {field.healthy_area_percent != null ? (
          <div className="space-y-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="bg-healthy" style={{ width: `${field.healthy_area_percent}%` }} />
              <div className="bg-attention" style={{ width: `${field.attention_area_percent}%` }} />
              <div className="bg-problem" style={{ width: `${field.problem_area_percent}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>🟢 {field.healthy_area_percent}% Healthy</span>
              <span>🟡 {field.attention_area_percent}%</span>
              <span>🔴 {field.problem_area_percent}%</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No analysis yet — run processing on a survey.</div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between text-xs">
        <Badge variant="outline" className={STATUS_CLASS[status.kind]}>
          {status.label}
        </Badge>
        <Link
          href={`/fields/${field.id}/digital-twin`}
          className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
        >
          View Digital Twin <ArrowRight size={14} />
        </Link>
      </CardFooter>
    </Card>
  );
}
