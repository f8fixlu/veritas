/**
 * Heuristic detection of virtual / software cameras (OBS, ManyCam, Snap Camera,
 * NDI, DroidCam, …). Browsers expose no reliable flag for this, so we match the
 * device label the browser reports. This is best-effort: a student can rename a
 * virtual driver or feed a pre-recorded stream, so treat a hit as a flag to
 * review, never as proof.
 */
const VIRTUAL_CAMERA_PATTERN =
  /\b(obs|open broadcaster|manycam|snap camera|xsplit|virtual cam|virtual webcam|virtual camera|ndi|droidcam|epoccam|iriun|e2esoft|vcam|splitcam|youcam|dummy|fake|screen capture|evercast|prism)\b/i;

export function isVirtualCameraLabel(
  label: string | null | undefined
): boolean {
  if (!label) return false;
  return VIRTUAL_CAMERA_PATTERN.test(label);
}

/**
 * Maps a getUserMedia rejection (or missing media support) to a student-facing
 * message. Shared by the pre-start camera check and the in-exam monitor.
 */
export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was denied. Allow camera access for this site to continue.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is in use by another application.";
    case "OverconstrainedError":
      return "Your camera doesn't meet the required settings.";
    default:
      return "Could not start the camera. It works on localhost or HTTPS.";
  }
}
