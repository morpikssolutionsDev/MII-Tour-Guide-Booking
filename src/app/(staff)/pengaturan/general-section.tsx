import { getSettings } from "@/server/settings";
import { GeneralForm } from "./general-client";

/** 04 §3.5 */
export async function GeneralSection() {
  return <GeneralForm initial={await getSettings()} />;
}
