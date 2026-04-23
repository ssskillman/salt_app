import React from "react";

export default function SaltRescueModal({
  isOpen,
  onClose,
  onMarkResolved,
}) {
  if (!isOpen) return null;

  const handleCopy = async () => {
    const text = `localStorage.clear();
sessionStorage.clear();`;

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy Salt rescue commands:", err);
    }
  };

  return (
    <div className="salt-rescue-overlay" role="dialog" aria-modal="true" aria-labelledby="salt-rescue-title">
      <div className="salt-rescue-modal">
        <div className="salt-rescue-header">
          <div>
            <div className="salt-rescue-badge">🧂 Easter Egg</div>
            <h2 id="salt-rescue-title">Salt taking too long to load?</h2>
          </div>
          <button className="salt-rescue-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="salt-rescue-text">
          This can sometimes be caused by stale browser session state. One common cause is a
          browser-side issue similar to a <strong>414 URI Too Long</strong> / oversized URL state problem.
        </p>

        <div className="salt-rescue-steps">
          <h3>Manual recovery steps</h3>
          <ol>
            <li>
              Open Chrome DevTools: <code>Cmd + Option + I</code>
            </li>
            <li>Go to the <strong>Console</strong> tab</li>
            <li>
              Use the <strong>bottom command prompt</strong>, not the top filter bar
            </li>
            <li>Run these commands:</li>
          </ol>

          <pre className="salt-rescue-code">
{`localStorage.clear();
sessionStorage.clear();`}
          </pre>

          <ol start={5}>
            <li>
              Hard refresh the page: <code>Cmd + Shift + R</code>
            </li>
            <li>If needed, close the tab and reopen Salt</li>
          </ol>
        </div>

        <div className="salt-rescue-note">
          <strong>Note:</strong> The app cannot read Chrome DevTools console output directly, so this help is shown
          based on slow load timing rather than confirmed console errors.
        </div>

        <div className="salt-rescue-actions">
          <button className="salt-rescue-btn secondary" onClick={handleCopy}>
            Copy commands
          </button>
          <button className="salt-rescue-btn secondary" onClick={onClose}>
            Dismiss
          </button>
          <button className="salt-rescue-btn primary" onClick={onMarkResolved}>
            App finished loading
          </button>
        </div>
      </div>
    </div>
  );
}