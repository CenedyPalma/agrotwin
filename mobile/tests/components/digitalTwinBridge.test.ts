import { BRIDGE_PROTOCOL, buildViewerUrl, hostMessageScript, parseViewerMessage } from "@/components/digitalTwin/digitalTwinBridge";

describe("digitalTwinBridge", () => {
  it("builds the existing web viewer URL in embedded mode", () => {
    expect(buildViewerUrl("http://192.168.1.50:3000/", { fieldId: "4a5d296e536b", surveyId: "8dab5067ab14", mode: "3d-twin", focusZoneId: "z1" })).toBe(
      "http://192.168.1.50:3000/fields/4a5d296e536b/digital-twin?survey=8dab5067ab14&embed=1&mode=3d-twin&zone=z1"
    );
  });

  it("accepts only protocol-tagged viewer messages", () => {
    expect(parseViewerMessage(JSON.stringify({ protocol: BRIDGE_PROTOCOL, type: "ZONE_SELECTED", zoneId: "z1" }))).toEqual({ type: "ZONE_SELECTED", zoneId: "z1" });
    expect(parseViewerMessage(JSON.stringify({ type: "ZONE_SELECTED", zoneId: "z1" }))).toBeNull();
    expect(parseViewerMessage(JSON.stringify({ protocol: BRIDGE_PROTOCOL, type: "EVIL" }))).toBeNull();
    expect(parseViewerMessage("not json")).toBeNull();
  });

  it("serialises host messages as a window CustomEvent", () => {
    const script = hostMessageScript({ type: "SET_MODE", mode: "photorealistic" });
    expect(script).toContain("agrotwin:host-message");
    expect(script).toContain(`"protocol":"${BRIDGE_PROTOCOL}"`);
    expect(script).toContain('"mode":"photorealistic"');
  });
});
