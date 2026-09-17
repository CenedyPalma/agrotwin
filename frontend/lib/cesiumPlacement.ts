/** Vertically aligns a loaded 3D Tileset onto the viewer's sampled global
 * terrain height. Tilesets built by backend/scripts/{tile_mesh,tile_points,
 * tile_splats_spz}.py write a `placement.json` next to their tileset.json
 * with `ground_h`: the field's ground height in that product's own vertical
 * datum. The difference between that and `groundHeight` (sampled from the
 * viewer's own terrain provider — see CesiumViewer.sampleGroundHeight) is
 * the lift to apply so the product sits on the real surrounding relief
 * instead of floating above or sinking below it. */
export async function liftTileset(Cesium: any, tileset: any, url: string, groundHeight: number): Promise<void> {
  const placementUrl = url.replace(/tileset\.json(\?.*)?$/, "placement.json$1");

  let ownGroundHeight = 0;
  try {
    const res = await fetch(placementUrl);
    if (res.ok) {
      const placement = await res.json();
      if (typeof placement.ground_h === "number") ownGroundHeight = placement.ground_h;
    }
  } catch {
    // no placement metadata alongside this tileset — assume its own datum
    // already matches ground level (no lift applied)
  }

  const lift = groundHeight - ownGroundHeight;
  if (Number.isFinite(lift) && Math.abs(lift) > 1e-6 && tileset?.root?.transform) {
    Cesium.Matrix4.multiplyByTranslation(tileset.root.transform, new Cesium.Cartesian3(0, 0, lift), tileset.root.transform);
  }
}
