type RGB = [number, number, number];

const RED: RGB = [239, 68, 68]; // matches the --problem token
const AMBER: RGB = [245, 158, 11]; // matches the --attention token
const GREEN: RGB = [34, 197, 94]; // matches the --healthy token

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Red -> amber -> green ramp for a 0..1 vegetation fraction. */
export function healthColor(fraction: number): RGB {
  const f = Math.max(0, Math.min(1, fraction));
  return f < 0.5 ? mix(RED, AMBER, f / 0.5) : mix(AMBER, GREEN, (f - 0.5) / 0.5);
}
