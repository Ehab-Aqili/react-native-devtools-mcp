import { z } from "zod";

export const PlatformSchema = z.enum(["android", "ios"]);
export type Platform = z.infer<typeof PlatformSchema>;

export interface DeviceTarget {
  readonly platform: Platform;
  /** Device/emulator/simulator identifier (adb serial, simctl UDID). */
  readonly id: string;
  readonly name?: string;
}
