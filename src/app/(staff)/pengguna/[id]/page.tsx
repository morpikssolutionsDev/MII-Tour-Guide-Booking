import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { t } from "@/i18n/id";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/server/session";
import { getUser } from "@/server/users/queries";
import { db } from "@/db/client";
import { guides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: t.users.editTitle };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin");
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();
  if (user.role === "guide") {
    // BR-01-7: guide accounts live with the guide profile.
    const guide = await db.query.guides.findFirst({ where: eq(guides.userId, user.id), columns: { id: true } });
    redirect(guide ? `/tour-guide/${guide.id}` : "/pengguna");
  }

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t.users.editTitle} description={`${t.common.lastUpdated} ${formatDateTime(user.updatedAt)}`} />
      <UserForm
        initial={{ id: user.id, name: user.name, email: user.email, role: user.role as "admin" | "staff", defaultChannel: user.defaultChannel }}
        isSelf={user.id === me.id}
      />
    </PageContainer>
  );
}
