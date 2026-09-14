import { analysisService } from "@/services/analysis";
import { setBaseUrls } from "@/services/runtimeConfig";

describe("analysisService", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    setBaseUrls({ apiUrl: "http://10.0.2.2:8000", webViewerUrl: "http://10.0.2.2:3000" });
  });

  it("treats the backend's 404 'no analysis yet' as null instead of an error", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "No analysis available for this survey yet" }), { status: 404 }));
    await expect(analysisService.get("s1")).resolves.toBeNull();
    await expect(analysisService.detectionZones("s1")).resolves.toEqual([]);
  });

  it("passes other failures through", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(analysisService.get("s1")).rejects.toMatchObject({ kind: "http", status: 500 });
  });
});
