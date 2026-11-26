import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, MapPin, ShieldCheck, Syringe } from "lucide-react";

const guideSections = [
  { id: "getting-started", label: "Getting started" },
  { id: "roles", label: "What each role can do" },
  { id: "animals", label: "Animal records" },
  { id: "vaccination-status", label: "Vaccination status" },
  { id: "planning-appointments", label: "Planning and appointments" },
  { id: "risk-coverage", label: "Risk and coverage" },
  { id: "notifications", label: "Notifications and SMS" },
  { id: "reports-map", label: "Reports and map" },
  { id: "account-settings", label: "Profile and settings" },
];

export default function UserGuidePage() {
  return (
    <main className="guide-page">
      <header className="guide-topbar">
        <Link className="guide-brand" href="/" aria-label="VacciTrack home">VacciTrack</Link>
        <div className="guide-top-actions">
          <Link className="guide-back-link" href="/"><ArrowLeft size={15} /> Home</Link>
          <Link className="guide-signin-link" href="/signin">Sign in <ArrowRight size={15} /></Link>
        </div>
      </header>

      <section className="guide-hero">
        <span className="guide-eyebrow"><BookOpen size={15} /> PUBLIC USER GUIDE</span>
        <h1>Using VacciTrack</h1>
        <p>Quick instructions for animal records, vaccination status, appointments, reports, and notifications.</p>
        <span className="guide-updated">For clients and Barangay Estefania animal health staff</span>
      </section>

      <div className="guide-layout">
        <nav className="guide-toc" aria-label="Guide contents">
          <strong>In this guide</strong>
          {guideSections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
        </nav>

        <article className="guide-content">
          <section className="guide-callout">
            <ShieldCheck size={19} />
            <p>You can read this guide without signing in. Available tools depend on your account role and whether your account is active.</p>
          </section>

          <section className="guide-section" id="getting-started">
            <span className="guide-step">01</span>
            <div><h2>Getting started</h2>
              <p>Open VacciTrack and choose <strong>Sign in</strong>. Clients can create an account from the sign-in page. Staff accounts use the registration link provided by an administrator. Some accounts need approval before they can sign in.</p>
              <p>After signing in, use the navigation on the left to open a workspace. On a phone, open the menu button to see the same navigation.</p>
            </div>
          </section>

          <section className="guide-section" id="roles">
            <span className="guide-step">02</span>
            <div><h2>What each role can do</h2>
              <div className="guide-role-list">
                <div><strong>Client</strong><p>View your own animal records, submit animal information, review vaccination details, receive notices, and send feedback.</p></div>
                <div><strong>BHW</strong><p>Use staff work areas and see appointments assigned to your account. Appointment status is read-only for BHW accounts.</p></div>
                <div><strong>Admin</strong><p>Use staff work areas and create, reschedule, or update appointments. Admins also have access to the main workspace audit log.</p></div>
                <div><strong>Viewer</strong><p>View limited overview information and submit feedback.</p></div>
                <div><strong>Super Admin</strong><p>Use the separate Super Admin Portal for account administration, verification, staff invites, messages, map and purok data, and audit tools.</p></div>
              </div>
            </div>
          </section>

          <section className="guide-section" id="animals">
            <span className="guide-step">03</span>
            <div><h2>Animal records</h2>
              <p>Open <strong>Animal registry</strong> (clients see <strong>My animals</strong>). Use <strong>New record</strong> to enter the animal and owner details, choose the purok, and add available vaccination information. Location coordinates, a photo, and notes can also be included where the form allows them.</p>
              <p>Use the search bar to find an animal by name, owner, purok, or species. Choose filters to narrow by breed, species, owner, location, or pet/stray classification. Purok suggestions appear as you type a location keyword.</p>
              <p>Select a record to view its details and vaccination history. Staff with editing access can update the animal record or add a vaccination entry.</p>
            </div>
          </section>

          <section className="guide-section" id="vaccination-status">
            <span className="guide-step"><Syringe size={18} /></span>
            <div><h2>Vaccination status</h2>
              <p>The system uses a one-year vaccination interval. When an animal has a vaccination date, its standard next due date is 12 months later, unless a different due date was explicitly recorded. Old six-month due dates are converted to the one-year interval.</p>
              <dl className="guide-status-list">
                <div><dt>Unvaccinated</dt><dd>No vaccination history is recorded.</dd></div>
                <div><dt>Vaccinated</dt><dd>Vaccination history exists and the due date is more than 30 days away, or no due date is recorded.</dd></div>
                <div><dt>Due soon</dt><dd>The due date is today or within the next 30 days. These animals still count as current for coverage.</dd></div>
                <div><dt>Expired</dt><dd>Vaccination history exists, but the due date has passed.</dd></div>
              </dl>
            </div>
          </section>

          <section className="guide-section" id="planning-appointments">
            <span className="guide-step"><CalendarClock size={18} /></span>
            <div><h2>Planning and appointments</h2>
              <p><strong>Vaccination Planning</strong> shows expired animals under immediate action and animals due from today through the next 90 days in the upcoming list. Use the purok search to focus on a location.</p>
              <p><strong>Only admins schedule and update appointments.</strong> An admin opens Appointments, selects an animal that is due soon or expired, assigns an active admin or BHW, and sets a date. Appointment status can be Scheduled, Completed, Missed, or Cancelled.</p>
              <p>BHW accounts can open their assigned appointments and read the status, but cannot change it. They do not see appointments assigned to other BHW accounts.</p>
            </div>
          </section>

          <section className="guide-section" id="risk-coverage">
            <span className="guide-step"><ShieldCheck size={18} /></span>
            <div><h2>Risk and vaccination coverage</h2>
              <p><strong>Risk Analysis</strong> compares animals by purok. Its at-risk count combines animals that have never been vaccinated with animals whose vaccinations are expired.</p>
              <div className="guide-formula">At-risk share = (Unvaccinated + Expired) ÷ Registered animals × 100</div>
              <ul className="guide-compact-list">
                <li><strong>High:</strong> more than 50% at risk.</li>
                <li><strong>Moderate:</strong> more than 30% and up to 50% at risk.</li>
                <li><strong>Low:</strong> 30% or less at risk. Puroks with no records show no data.</li>
              </ul>
              <p>Vaccination coverage uses current animals as the numerator and all registered animals as the denominator. Due-soon animals count as current.</p>
              <div className="guide-formula">Coverage = Current vaccinated ÷ Registered animals × 100</div>
              <p>The coverage target is 70%. The “gap to target” estimates how many additional current vaccinations are needed to reach it.</p>
            </div>
          </section>

          <section className="guide-section" id="notifications">
            <span className="guide-step">07</span>
            <div><h2>Notifications and SMS</h2>
              <p>Open the bell in the top bar to see unread in-app notifications. Select a notification to mark it as read, or choose <strong>Mark all read</strong>. New notifications can appear while the workspace is open.</p>
              <p>Vaccination reminders can be sent for due dates 30 days away, 7 days away, tomorrow, or already expired. Staff can receive a daily summary. Appointment reminders are generated for the day before and the day of the appointment.</p>
              <p>SMS is a separate channel and depends on the SMS service being configured and the user’s SMS preference. Changing SMS preferences does not turn off in-app notifications.</p>
            </div>
          </section>

          <section className="guide-section" id="reports-map">
            <span className="guide-step"><MapPin size={18} /></span>
            <div><h2>Reports and map</h2>
              <p><strong>Reports</strong> summarizes animal, vaccination, map, and stray/pound records. Choose report sections, adjust available filters and date ranges, and export selected information using print/PDF, Word-compatible, or Excel-compatible formats.</p>
              <p><strong>Coverage map</strong> displays animal locations and puroks. Search by animal or purok; purok suggestions help find a matching location. Map selection tools are also used when entering coordinates for a record.</p>
              <p><strong>Stray &amp; pound</strong> lets staff search stray records and filter by impound status: Under Observation, Up for Adoption, or Reclaimed.</p>
            </div>
          </section>

          <section className="guide-section" id="account-settings">
            <span className="guide-step">09</span>
            <div><h2>Profile and settings</h2>
              <p>Use the account menu to open your profile or settings. Profile controls include personal details, notification language and SMS preference, plus username or password changes using a verification code.</p>
              <p>Settings contains shared purok and vaccine lookup lists. Purok management in the main workspace is available to admins.</p>
            </div>
          </section>

          <section className="guide-help-card">
            <div><h2>Need access to a feature?</h2><p>Feature access depends on account role and approval status. Contact a VacciTrack administrator if a tool you need is not available.</p></div>
            <Link href="/signin">Go to sign in <ArrowRight size={15} /></Link>
          </section>
        </article>
      </div>

      <footer className="guide-footer"><Link href="/">VacciTrack</Link><span>Public user guide · Barangay Estefania</span></footer>
    </main>
  );
}
