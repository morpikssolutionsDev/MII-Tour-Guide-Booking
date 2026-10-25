import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { t } from "@/i18n/id";
import { requireRole } from "@/server/session";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: t.users.createTitle };

export default async function NewUserPage() {
  await requireRole("admin");
  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.users.createTitle} />
      <UserForm initial={null} />
    </PageContainer>
  );
}
