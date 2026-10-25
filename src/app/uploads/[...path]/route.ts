import { getCurrentUser } from "@/server/session";
import { readLocalUpload } from "@/server/storage";

// Serves local-driver uploads. Payment proofs are admin/staff only (06 BR-06-10);
// briefing PDFs and guide photos are available to any signed-in user.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { path: segments } = await params;
  if (segments[0] === "payments" && user.role === "guide") return new Response("Forbidden", { status: 403 });

  const file = await readLocalUpload(segments);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
}
