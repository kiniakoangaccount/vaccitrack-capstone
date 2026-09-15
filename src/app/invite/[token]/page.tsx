import { PawPrint } from "lucide-react";
import { createAdminClient } from "@/lib/supabase-admin";
import InviteRegisterForm from "./InviteRegisterForm";

const ROLE_LABELS: Record<string, string> = {
  bhw: "Barangay Health Worker",
  admin: "Administrator",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAdminClient();
  const { data: invite } = db
    ? await db.from("staff_invites").select("role, expires_at, used_at").eq("token", token).maybeSingle()
    : { data: null };

  if (!db || !invite) return <InvalidInvite reason="This invite link is invalid." />;
  if (invite.used_at) return <InvalidInvite reason="This invite link has already been used." />;
  if (new Date(invite.expires_at) < new Date()) return <InvalidInvite reason="This invite link has expired." />;

  return <InviteRegisterForm token={token} role={invite.role} roleLabel={ROLE_LABELS[invite.role] ?? invite.role} />;
}

function InvalidInvite({ reason }: { reason: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand"><span className="brand-mark"><PawPrint size={20} /></span><span>VacciTrack</span></div>
        <p className="eyebrow">STAFF INVITATION</p>
        <h1>Invite link unavailable</h1>
        <p className="heading-sub">{reason} Contact an administrator for a new link.</p>
      </section>
    </main>
  );
}
