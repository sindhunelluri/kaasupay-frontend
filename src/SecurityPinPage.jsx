import { useEffect, useState } from "react";
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
  close: (<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>),
  chevron: <path d="m9 6 6 6-6 6" />,
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


/* Popup shell: closes on backdrop click and Escape */
function Modal({ title, subtitle, onClose, busy, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className="sp-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="sp-modal" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="sp-modal-close" onClick={onClose} disabled={busy} aria-label="Close">
          <SvgIcon name="close" size={18} />
        </button>
        <div className="sp-card-head">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SecurityPinPage({ token, hasPaymentPin, onPinChanged, onTokenChange }) {
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [modalError, setModalError] = useState("");
  // null | "pin" | "password"
  const [modal, setModal] = useState(null);

  function resetFields() {
    setPassword("");
    setNewPin("");
    setConfirmPin("");
    setModalError("");
  }

  function openModal(which) {
    resetFields();
    setMessage("");
    setMessageType("");
    setModal(which);
  }

  function closeModal() {
    resetFields();
    setModal(null);
  }

  function updatePin(setter, value) {
    setter(value.replace(/\D/g, "").slice(0, 6));
  }

  const strength = pinStrength(newPin);
  const showMatch = confirmPin.length > 0;
  const pinsMatch = newPin === confirmPin;

  async function handleSubmit(event) {
    event.preventDefault();
    setModalError("");

    if (!PIN_OK.test(newPin)) {
      setModalError("PIN must be exactly 4 or 6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setModalError("The new PINs do not match.");
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
      setModal(null);

      onPinChanged?.();
    } catch (error) {
      setModalError(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handlePasswordChanged(text) {
    setMessage(text);
    setMessageType("success");
    setModal(null);
  }

  return (
    <section className="security-pin-page">
      {/* Hero */}
      <header className="sp-hero">
        <div className="sp-hero-icon">
          <SvgIcon name="shield" size={30} />
        </div>
        <div className="sp-hero-text">
          <h2>Security &amp; Payment PIN</h2>
          <p>Protect your wallet. Choose what you want to set up or update.</p>
        </div>
        <span className={`security-pin-status ${hasPaymentPin ? "is-set" : "is-not-set"}`}>
          <i aria-hidden="true" />
          {hasPaymentPin ? "PIN Active" : "PIN Not Set"}
        </span>
      </header>

      {message && (
        <div
          className={`security-pin-message ${messageType} sp-page-message`}
          role={messageType === "error" ? "alert" : "status"}
        >
          <SvgIcon name={messageType === "success" ? "check" : "alert"} size={18} />
          <span>{message}</span>
        </div>
      )}

      {/* Two options */}
      <div className="sp-options">
        <button type="button" className="sp-option" onClick={() => openModal("pin")}>
          <span className={`sp-option-icon ${hasPaymentPin ? "is-ok" : "is-warn"}`}>
            <SvgIcon name="key" size={26} />
          </span>
          <span className="sp-option-body">
            <strong>{hasPaymentPin ? "Change PIN" : "Create PIN"}</strong>
            <small>
              {hasPaymentPin
                ? "Your Payment PIN is set. Change it anytime."
                : "Set a 4 or 6 digit PIN to authorize transfers."}
            </small>
          </span>
          <span className="sp-option-go"><SvgIcon name="chevron" size={20} /></span>
        </button>

        <button type="button" className="sp-option" onClick={() => openModal("password")}>
          <span className="sp-option-icon is-blue">
            <SvgIcon name="lock" size={26} />
          </span>
          <span className="sp-option-body">
            <strong>Change password</strong>
            <small>Update your account password. Other devices get signed out.</small>
          </span>
          <span className="sp-option-go"><SvgIcon name="chevron" size={20} /></span>
        </button>
      </div>

      {/* Safety tips */}
      <div className="sp-tips sp-tips-strip">
        <h4>PIN safety tips</h4>
        <ul>
          <li><span><SvgIcon name="check" size={14} /></span>Use 4 or 6 digits you can remember but others can't guess.</li>
          <li><span><SvgIcon name="check" size={14} /></span>Avoid birthdays, phone numbers or repeated digits like 1111.</li>
          <li><span><SvgIcon name="check" size={14} /></span>Never share your PIN, even with KaasuPay support.</li>
          <li><span><SvgIcon name="check" size={14} /></span>Three wrong attempts lock your PIN for 15 minutes.</li>
        </ul>
      </div>

      {/* PIN popup */}
      {modal === "pin" && (
        <Modal
          title={hasPaymentPin ? "Change Payment PIN" : "Create Payment PIN"}
          subtitle="Confirm your account password, then choose a new PIN."
          onClose={closeModal}
          busy={loading}
        >
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

            {modalError && (
              <div className="security-pin-message error" role="alert">
                <SvgIcon name="alert" size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <button
              type="submit"
              className="transfer-submit security-pin-submit"
              disabled={loading || !password || !PIN_OK.test(newPin) || newPin !== confirmPin}
            >
              {loading ? "Please wait..." : hasPaymentPin ? "Change Payment PIN" : "Create Payment PIN"}
            </button>

            <button type="button" className="sp-cancel-btn" onClick={closeModal} disabled={loading}>
              Cancel
            </button>
          </form>
        </Modal>
      )}

      {/* Password popup */}
      {modal === "password" && (
        <Modal
          title="Change account password"
          subtitle="Enter your email and old password. This signs you out of all your other devices."
          onClose={closeModal}
        >
          <ChangePasswordForm
            token={token}
            onTokenChange={onTokenChange}
            onCancel={closeModal}
            onDone={handlePasswordChanged}
          />
        </Modal>
      )}
    </section>
  );
}

/* Change account password form (shown inside the popup) */
function ChangePasswordForm({ token, onTokenChange, onCancel, onDone }) {
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
      onDone("Password changed. Your other devices were signed out.");
    } catch (error) {
      setNote({ ok: false, text: error.message });
      setBusy(false);
    }
  }

  return (
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
        <p className={note.ok ? "sec-note ok" : "sec-note bad"} role="alert">
          {note.text}
        </p>
      )}

      <button type="submit" className="transfer-submit" disabled={busy || !ready}>
        {busy ? "Please wait..." : "Change password"}
      </button>

      <button type="button" className="sp-cancel-btn" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  );
}