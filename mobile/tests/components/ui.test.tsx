import { render, screen } from "@testing-library/react-native";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HealthLegend } from "@/components/ui/HealthIndicator";
import { DetectionZoneCard } from "@/components/analysis/DetectionZoneCard";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import type { DetectionZone, ProcessingJob } from "@/types";

const zone: DetectionZone = {
  id: "z1",
  type: "patchy_vegetation",
  severity: "medium",
  confidence: 0.64,
  geometry: { type: "Polygon", coordinates: [[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]] },
  recommended_action: "Ground inspection recommended",
};

describe("status UI never relies on colour alone", () => {
  it("StatusBadge shows an emoji marker and text", async () => {
    await render(<StatusBadge tier="attention" />);
    expect(screen.getByText("🟡")).toBeTruthy();
    expect(screen.getByText("Needs Attention")).toBeTruthy();
  });

  it("HealthLegend prints all three shares", async () => {
    await render(<HealthLegend shares={{ healthy: 66, attention: 32.2, problem: 1.7 }} />);
    expect(screen.getByText("66%")).toBeTruthy();
    expect(screen.getByText("32.2%")).toBeTruthy();
    expect(screen.getByText("1.7%")).toBeTruthy();
  });
});

describe("DetectionZoneCard", () => {
  it("translates the backend type into farmer language with priority and recommendation", async () => {
    await render(<DetectionZoneCard zone={zone} areaM2={320} locationLabel="North-West area" />);
    expect(screen.getByText(/Patchy Vegetation/)).toBeTruthy();
    expect(screen.getByText("Medium Priority")).toBeTruthy();
    expect(screen.getByText("North-West area")).toBeTruthy();
    expect(screen.getByText("≈ 320 m²")).toBeTruthy();
    expect(screen.getByText("64%")).toBeTruthy();
    expect(screen.getByText("Ground inspection recommended")).toBeTruthy();
    expect(screen.queryByText("patchy_vegetation")).toBeNull();
  });
  it("shows the raw type only in advanced mode", async () => {
    await render(<DetectionZoneCard zone={zone} advanced />);
    expect(screen.getByText("patchy_vegetation")).toBeTruthy();
  });
});

describe("ProcessingProgress", () => {
  const job: ProcessingJob = {
    id: "j1",
    survey_id: "s1",
    status: "GENERATING_ORTHOMOSAIC",
    current_step: "generating_orthomosaic",
    steps: [
      { key: "images_uploaded", label: "Images Uploaded", status: "complete" },
      { key: "metadata_extracted", label: "Metadata Extracted", status: "complete" },
      { key: "processing_field", label: "Processing Field", status: "complete" },
      { key: "generating_orthomosaic", label: "Generating Orthomosaic", status: "pending" },
      { key: "ai_analysis", label: "AI Analysis", status: "pending" },
      { key: "digital_twin_ready", label: "Digital Twin Ready", status: "pending" },
    ],
    error_message: null,
    created_at: null,
    updated_at: null,
  };
  it("lists the backend's steps and marks the current one", async () => {
    await render(<ProcessingProgress job={job} />);
    expect(screen.getByText("Creating your Digital Twin")).toBeTruthy();
    expect(screen.getByText("Generating Orthomosaic…")).toBeTruthy();
    expect(screen.getByText("AI Analysis")).toBeTruthy();
  });
  it("shows the failure message and a retry button", async () => {
    const onRetry = jest.fn();
    await render(<ProcessingProgress job={{ ...job, status: "FAILED", error_message: "rasterio missing" }} onRetry={onRetry} />);
    expect(screen.getByText("rasterio missing")).toBeTruthy();
    expect(screen.getByText("Retry processing")).toBeTruthy();
  });
});
