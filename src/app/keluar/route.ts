import { signOut } from "@/auth";

// Clears a session the data layer rejected (deactivated user, password changed) or a
// normal logout. `?alasan=sesi` shows the "session ended" notice on the login page.
export async function GET(request: Request) {
  const reason = new URL(request.url).searchParams.get("alasan");
  await signOut({ redirectTo: reason === "sesi" ? "/masuk?alasan=sesi" : "/masuk" });
}
