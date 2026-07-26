import { z } from "zod";

export const DetailLevelSchema = z.enum(["summary", "normal", "full"]);
export type DetailLevel = z.infer<typeof DetailLevelSchema>;

export const DEFAULT_DETAIL_LEVEL: DetailLevel = "summary";
