import Link from "next/link";

export default function ElevationTab() {
  return (
    <section className="settings-section" aria-labelledby="heading-elevation">
      <h2 id="heading-elevation" className="settings-section-title">Admin Access Elevation</h2>
      <p className="settings-section-desc">
        Administrative privileges and staff access status.
      </p>

      <div className="settings-alert alert-success" role="status">
        <div className="alert-content">
          <strong>Administrator Privileges Active</strong>
          <p>Your account currently holds full administrator permissions.</p>
        </div>
        <Link href="/admin" className="settings-btn settings-btn-primary settings-btn-sm">
          Open Admin Dashboard
        </Link>
      </div>
    </section>
  );
}
