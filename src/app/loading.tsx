import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="global-route-loading" role="status" aria-live="polite">
      <Loader2 className="global-route-loading-icon" size={28} aria-hidden="true" />
      <span>Loading page…</span>
    </main>
  );
}
