import { t } from "@/i18n/id";
import { listChecklistTemplate } from "@/server/settings-queries";
import { ChecklistEditor } from "./checklist-client";

/** 04 §3.3 */
export async function ChecklistSection() {
  const items = await listChecklistTemplate();
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">{t.settings.checklist.caption}</p>
      <ChecklistEditor items={items.map((i) => ({ id: i.id, label: i.label, description: i.description, system: i.systemKey !== null }))} />
    </section>
  );
}
