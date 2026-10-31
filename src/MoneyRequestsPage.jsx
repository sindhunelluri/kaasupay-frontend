
import { useEffect, useState } from "react";
import { apiUrl } from "./api";
import { apiErrorMessage } from "./apiErrors";
import RecentContacts from "./RecentContacts.jsx";

const STATUSES = ["ALL", "PENDING", "PAID", "DECLINED", "CANCELLED", "EXPIRED"];

function formatAmount(paise) {
  return `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MoneyRequestsPage({ token, onSuccess, contacts = []  }) {
  const [activeTab, setActiveTab] = useState("incoming");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [payTarget, setPayTarget] = useState(null);
  const [pin, setPin] = useState("");
  const [payKey, setPayKey] = useState("");

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  async function loadRequests() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const endpoint =
        activeTab === "incoming" ? "incoming" : "outgoing";

      const query =
        statusFilter === "ALL"
          ? ""
          : `?status=${statusFilter}`;

      const response = await fetch(
        apiUrl(`/api/v1/requests/${endpoint}${query}`),
        { headers }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error("Your session expired. Please sign in again.");
      }

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(response, data, "Could not load requests")
        );
      }

      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message || "Could not load money requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  let active = true;

  const task = queueMicrotask(() => {
    if (active) {
      loadRequests();
    }
  });

  return () => {
    active = false;
    void task;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token, activeTab, statusFilter]);

  async function handleCreateRequest(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const rupees = Number(amount);

    if (!to.trim()) {
      setError("Enter the recipient's registered email address.");
      return;
    }

    if (!Number.isFinite(rupees) || rupees < 1 || rupees > 10000) {
      setError("Enter an amount between ₹1 and ₹10,000.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(apiUrl("/api/v1/requests"), {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: to.trim().toLowerCase(),
          amount: Math.round(rupees * 100),
          note: note.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(response, data, "Could not create request")
        );
      }

      setTo("");
      setAmount("");
      setNote("");
      setMessage("Money request created successfully.");

      setActiveTab("outgoing");
      setStatusFilter("ALL");
    } catch (err) {
      setError(err.message || "Could not create money request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestAction(request, action) {
    const actionText =
      action === "decline" ? "decline" : "cancel";

    if (!window.confirm(`Are you sure you want to ${actionText} this request?`)) {
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(
        apiUrl(`/api/v1/requests/${request.id}/${action}`),
        {
          method: "POST",
          headers,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(response, data, `Could not ${actionText} request`)
        );
      }

      setMessage(`Request ${actionText}ed successfully.`);
      await loadRequests();
    } catch (err) {
      setError(err.message || `Could not ${actionText} request.`);
    } finally {
      setSubmitting(false);
    }
  }

  function openPayDialog(request) {
    setError("");
    setPin("");
    setPayKey(crypto.randomUUID());
    setPayTarget(request);
  }

  async function handlePayRequest(event) {
    event.preventDefault();

    if (!payTarget || !payKey) return;

    if (!/^(\d{4}|\d{6})$/.test(pin)) {
      setError("Enter your 4 or 6 digit payment PIN.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(
        apiUrl(`/api/v1/requests/${payTarget.id}/pay`),
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Idempotency-Key": payKey,
          },
          body: JSON.stringify({ pin }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(response, data, "Payment failed")
        );
      }

      setPayTarget(null);
      setPin("");
      setPayKey("");
      setMessage("Money request paid successfully.");

      await loadRequests();

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError(err.message || "Could not pay this request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="money-requests-page">
      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Money Requests</h2>
            <p>Request money from other KaasuPay users or manage requests sent to you.</p>
          </div>
        </div>

        {error && (
          <div className="transfer-message is-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="money-request-success" role="status">
            {message}
          </div>
        )}

        <form className="money-request-form" onSubmit={handleCreateRequest}>
          <h3>Request money</h3>

          <RecentContacts contacts={contacts} onPick={setTo} disabled={submitting} />

          <div className="transfer-field">
            <label htmlFor="request-recipient">Recipient email</label>
            <input
              id="request-recipient"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="Enter registered email address"
              maxLength={254}
              required
              disabled={submitting}
            />
          </div>

          <div className="transfer-field">
            <label htmlFor="request-amount">Amount (₹)</label>
            <input
              id="request-amount"
              type="number"
              min="1"
              max="10000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter amount"
              required
              disabled={submitting}
            />
          </div>

          <div className="transfer-field">
            <label htmlFor="request-note">Note (optional)</label>
            <input
              id="request-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What is this request for?"
              maxLength={100}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="transfer-submit"
            disabled={submitting}
          >
            {submitting ? "Please wait..." : "Send Money Request"}
          </button>

          <p className="form-help">
            Creating a request does not move money. The recipient must approve and pay it.
          </p>
        </form>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Your requests</h2>
            <p>Review incoming and outgoing money requests.</p>
          </div>

          <button
            type="button"
            className="light-button"
            onClick={loadRequests}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="money-request-tabs">
          <button
            type="button"
            className={activeTab === "incoming" ? "active" : ""}
            onClick={() => setActiveTab("incoming")}
          >
            Incoming
          </button>

          <button
            type="button"
            className={activeTab === "outgoing" ? "active" : ""}
            onClick={() => setActiveTab("outgoing")}
          >
            Outgoing
          </button>
        </div>

        <div className="transfer-field money-request-filter">
          <label htmlFor="request-status">Filter by status</label>
          <select
            id="request-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "All statuses" : status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="form-help">Loading money requests...</p>
        ) : requests.length === 0 ? (
          <p className="form-help">No money requests found.</p>
        ) : (
          <div className="money-request-list">
            {requests.map((request) => (
              <article className="money-request-item" key={request.id}>
                <div className="money-request-details">
                  <strong>{request.otherPerson?.name || "KaasuPay user"}</strong>
                  <span>{request.otherPerson?.username || ""}</span>
                  {request.note && <p>{request.note}</p>}
                  <small>
                    {formatDate(request.createdAt)}
                    {" · "}
                    Expires {formatDate(request.expiresAt)}
                  </small>
                </div>

                <div className="money-request-side">
                  <strong>{formatAmount(request.amount)}</strong>
                  <span className={`money-request-status status-${request.status?.toLowerCase()}`}>
                    {request.status}
                  </span>

                  {request.status === "PENDING" && (
                    <div className="money-request-actions">
                      {activeTab === "incoming" ? (
                        <>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={submitting}
                            onClick={() => openPayDialog(request)}
                          >
                            Pay
                          </button>
                          <button
                            type="button"
                            className="light-button"
                            disabled={submitting}
                            onClick={() => handleRequestAction(request, "decline")}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="light-button"
                          disabled={submitting}
                          onClick={() => handleRequestAction(request, "cancel")}
                        >
                          Cancel request
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {payTarget && (
        <div className="money-request-modal-backdrop">
          <form className="money-request-modal" onSubmit={handlePayRequest}>
            <h3>Confirm payment</h3>
            <p>
              Pay {formatAmount(payTarget.amount)} to{" "}
              <strong>{payTarget.otherPerson?.name || "this user"}</strong>?
            </p>

            <div className="transfer-field">
              <label htmlFor="request-payment-pin">Payment PIN</label>
              <input
                id="request-payment-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 4 or 6 digit PIN"
                required
                disabled={submitting}
              />
            </div>

            <div className="money-request-modal-actions">
              <button
                type="button"
                className="light-button"
                disabled={submitting}
                onClick={() => {
                  setPayTarget(null);
                  setPin("");
                  setPayKey("");
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={submitting || !/^(\d{4}|\d{6})$/.test(pin)}
              >
                {submitting ? "Processing..." : "Confirm & Pay"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
