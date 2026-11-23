import { useDevicePreference } from "../reader";

/** Whether scaled amounts move to the unit they read best in, through the `readableUnits` Device Preference. */
export function useReadableUnitsPreference(): {
  enabled: boolean;
  toggle: () => void;
} {
  const [enabled, setEnabled] = useDevicePreference("readableUnits");

  return { enabled, toggle: () => setEnabled((prev) => !prev) };
}
