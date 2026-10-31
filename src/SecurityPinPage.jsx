import { useState } from "react";
import { apiUrl } from "./api";
import { apiErrorMessage } from "./apiErrors";

/* Small inline icons (self-contained, inherit colour from CSS) */
const PATHS = {
  shield: (<><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9" /><path d="m16 7 3 3" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9" /><path d="M6.6 6.7A17 17 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5h.01" /></>),
};

function SvgIcon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/* Input with show / hide toggle */
function SecretInput({ id, label, value, onChange, disabled, placeholder, numeric, autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="transfer-field">
      <label htmlFor={id}>{label}</label>
      <div className="sp-input">
        <span className="sp-input-icon">
          <SvgIcon name={numeric ? "key" : "lock"} size={18} />
        </span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          inputMode={numeric ? "numeric" : undefined}
          autoComplete={autoComplete}
          maxLength={numeric ? 6 : undefined}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          placeholder={placeholder}
          className={numeric ? "is-pin" : ""}
        />
        <button
          type="button"
          className="sp-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          tabIndex={-1}
        >
          <SvgIcon name={visible ? "eyeOff" : "eye"} size={18} />
        </button>
      </div>
    </div>
  );
}

const WEAK = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "2580", "123456", "654321"];

function isSequence(pin) {
  const d = [...pin].map(Number);
  return (
    d.every((x, i) => i === 0 || x === d[i - 1] + 1) ||
    d.every((x, i) => i === 0 || x === d[i - 1] - 1)
  );
}

const PIN_OK = /^(\d{4}|\d{6})$/;

function pinStrength(pin) {
  if (!pin) return { level: 0, label: "" };
  if (pin.length < 4) return { level: 1, label: "Too short" };
  if (pin.length === 5) return { level: 1, label: "Use 4 or 6 digits" };
  if (WEAK.includes(pin) || /^(\d)\1+$/.test(pin) || isSequence(pin)) return { level: 1, label: "Too easy to guess" };
  if (pin.length === 4) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}

export default function SecurityPinPage({ token, hasPaymentPin, onPinChanged, onTokenChange }) {
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  // Only used when the user already has a PIN: false = summary view, true = change form
  const [changing, setChanging] = useState(false);

  // No PIN yet -> always show the create form. PIN exists -> show form only after "Change PIN" is clicked.
  const showForm = !hasPaymentPin || changing;

  function resetFields() {
    setPassword("");
    setNewPin("");
    setConfirmPin("");
  }

  function openChangeForm() {
    setMessage("");
    setMessageType("");
    setChanging(true);
  }

  function cancelChange() {
    resetFields();
    setMessage("");
    setMessageType("");
    setChanging(false);
  }

  function updatePin(setter, value) {
    setter(value.replace(/\D/g, "").slice(0, 6));
  }

  const strength = pinStrength(newPin);
  const showMatch = confirmPin.length > 0;
  const pinsMatch = newPin === confirmPin;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (!PIN_OK.test(newPin)) {
      setMessage("PIN must be exactly 4 or 6 digits.");
      setMessageType("error");
      return;
    }

    if (newPin !== confirmPin) {
      setMessage("The new PINs do not match.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/v1/user/pin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password, pin: newPin }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(apiErrorMessage(response, data, "Could not update your Payment PIN"));
      }

      setMessage(
        data.message ||
          (hasPaymentPin
            ? "Payment PIN changed successfully."
            : "Payment PIN created successfully.")
      );
      setMessageType("success");

      resetFields();
      setChanging(false);

      onPinChanged?.();
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  const messageBox = message && (
    <div
      className={`security-pin-message ${messageType}`}
      role={messageType === "error" ? "alert" : "status"}
    >
      <SvgIcon name={messageType === "success" ? "check" : "alert"} size={18} />
      <span>{message}</span>
    </div>
  );

  return (
    <section className="security-pin-page">
      {/* Hero */}
      <header className="sp-hero">
        <div className="sp-hero-icon">
          <SvgIcon name="shield" size={30} />
        </div>
        <div className="sp-hero-text">
          <h2>Security &amp; Payment PIN</h2>
          <p>
            {hasPaymentPin
              ? "Your Payment PIN is set. Change it periodically and never share it with anyone."
              : "Create a 4 or 6 digit PIN to authorize transfers and withdrawals."}
          </p>
        </div>
        <span className={`security-pin-status ${hasPaymentPin ? "is-set" : "is-not-set"}`}>
          <i aria-hidden="true" />
          {hasPaymentPin ? "PIN Active" : "PIN Not Set"}
        </span>
      </header>

      {!showForm ? (
        /* ---------- PIN already created: summary only (no "create" UI) ---------- */
        <div className="sp-card sp-summary">
          <div className="sp-summary-icon">
            <SvgIcon name="check" size={30} />
          </div>
          <h3>Your Payment PIN is active</h3>
          <p>
            It is used to authorize your transfers and withdrawals. For your safety,
            the PIN is never displayed.
          </p>

          {messageBox}

          <button type="button" className="transfer-submit sp-change-btn" onClick={openChangeForm}>
            Change PIN
          </button>
        </div>
      ) : (
      <div className="sp-grid">
        {/* Form card */}
        <div className="sp-card">
          <div className="sp-card-head">
            <h3>{hasPaymentPin ? "Change Payment PIN" : "Create Payment PIN"}</h3>
            <p>Confirm your account password, then choose a new PIN.</p>
          </div>

          <form className="security-pin-form" onSubmit={handleSubmit}>
            <SecretInput
              id="security-account-password"
              label="Account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Enter your account password"
              autoComplete="current-password"
            />

            <div className="sp-divider" />

            <div className="sp-pin-block">
              <SecretInput
                id="security-new-pin"
                label={hasPaymentPin ? "New Payment PIN" : "Create Payment PIN"}
                value={newPin}
                onChange={(e) => updatePin(setNewPin, e.target.value)}
                disabled={loading}
                placeholder="Enter 4 or 6 digits"
                autoComplete="new-password"
                numeric
              />

              {newPin && (
                <div className={`sp-strength level-${strength.level}`} aria-live="polite">
                  <div className="sp-strength-bars">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={n <= strength.level ? "on" : ""} />
                    ))}
                  </div>
                  <small>{strength.label}</small>
                </div>
              )}
            </div>

            <div className="sp-pin-block">
              <SecretInput
                id="security-confirm-pin"
                label="Confirm new PIN"
                value={confirmPin}
                onChange={(e) => updatePin(setConfirmPin, e.target.value)}
                disabled={loading}
                placeholder="Re-enter new PIN"
                autoComplete="new-password"
                numeric
              />

              {showMatch && (
                <p className={`sp-match ${pinsMatch ? "ok" : "bad"}`} aria-live="polite">
                  <SvgIcon name={pinsMatch ? "check" : "alert"} size={14} />
                  {pinsMatch ? "PINs match" : "PINs do not match yet"}
                </p>
              )}
            </div>

            {messageBox}

            <button
              type="submit"
              className="transfer-submit security-pin-submit"
              disabled={
                loading ||
                !password ||
                !PIN_OK.test(newPin) ||
                newPin !== confirmPin
              }
            >
              {loading
                ? "Please wait..."
                : hasPaymentPin
                  ? "Change Payment PIN"
                  : "Create Payment PIN"}
            </button>

            {hasPaymentPin && (
              <button type="button" className="sp-cancel-btn" onClick={cancelChange} disabled={loading}>
                Cancel
              </button>
            )}
          </form>
        </div>

        {/* Tips side panel */}
        <aside className="sp-side">
          <div className="sp-tips">
            <h4>PIN safety tips</h4>
            <ul>
              <li>
                <span><SvgIcon name="check" size={14} /></span>
                Use 4 or 6 digits you can remember but others can't guess.
              </li>
              <li>
                <span><SvgIcon name="check" size={14} /></span>
                Avoid birthdays, phone numbers or repeated digits like 1111.
              </li>
              <li>
                <span><SvgIcon name="check" size={14} /></span>
                Never share your PIN, even with KaasuPay support.
              </li>
              <li>
                <span><SvgIcon name="check" size={14} /></span>
                Three wrong attempts lock your PIN for 15 minutes.
              </li>
            </ul>
          </div>

          <div className="sp-note">
            <SvgIcon name="lock" size={18} />
            <p>Your PIN is encrypted and never shown in plain text.</p>
          </div>
        </aside>
      </div>
      )}

      <ChangePasswordCard token={token} onTokenChange={onTokenChange} />
    </section>
  );
}

/* Change account password: needs email + old password + new password */
function ChangePasswordCard({ token, onTokenChange }) {
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  const ready =
    /^\S+@\S+\.\S+$/.test(email.trim()) && oldPassword && newPassword.length >= 6;

  async function submit(event) {
    event.preventDefault();
    setNote(null);

    if (newPassword === oldPassword) {
      setNote({ ok: false, text: "New password must be different from the old one." });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(apiUrl("/api/v1/user"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: email.trim(),
          oldPassword,
          newPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(apiErrorMessage(response, data, "Could not change password"));
      }

      // The server ended every old session. Keep THIS device signed in.
      if (data.token) onTokenChange?.(data.token);
      setEmail("");
      setOldPassword("");
      setNewPassword("");
      setNote({ ok: true, text: "Password changed. Your other devices were signed out." });
    } catch (error) {
      setNote({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sec-extras">
      <div className="sp-card">
        <div className="sp-card-head">
          <h3>Change account password</h3>
          <p>Enter your email and old password. This signs you out of all your other devices.</p>
        </div>

        <form className="security-pin-form" onSubmit={submit}>
          <div className="transfer-field">
            <label htmlFor="security-email">Email</label>
            <div className="sp-input">
              <span className="sp-input-icon"><SvgIcon name="key" size={18} /></span>
              <input
                id="security-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
                placeholder="Your account email"
              />
            </div>
          </div>

          <SecretInput
            id="security-old-password"
            label="Old password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={busy}
            placeholder="Enter your current password"
            autoComplete="current-password"
          />

          <SecretInput
            id="security-new-password"
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />

          {note && (
            <p className={note.ok ? "sec-note ok" : "sec-note bad"} role="status">
              {note.text}
            </p>
          )}

          <button type="submit" className="transfer-submit" disabled={busy || !ready}>
            {busy ? "Please wait..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}