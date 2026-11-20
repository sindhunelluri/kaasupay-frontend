
import React, { useEffect, useState } from "react";
import { apiUrl } from "./api";


function AutoPayPage({ token }) {
    const [mandates, setMandates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const [to, setTo] = useState("");
    const [amount, setAmount] = useState("");
    const [dayOfMonth, setDayOfMonth] = useState("15");
    const [pin, setPin] = useState("");

    const [selectedMandate, setSelectedMandate] = useState(null);
    const [runs, setRuns] = useState([]);
    const [runsLoading, setRunsLoading] = useState(false);

    const request = async (path, options = {}) => {
        const response = await fetch(apiUrl(path), {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }

        return data;
    };

    const loadMandates = async () => {
        try {
            setError("");
            const data = await request("/api/v1/autopay");
            setMandates(data.mandates || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) loadMandates();
    }, [token]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        const rupees = Number(amount);
        const scheduleDay = Number(dayOfMonth);

        if (!to.trim()) {
            setError("Please enter the recipient username.");
            return;
        }

        if (!Number.isFinite(rupees) || rupees < 1 || rupees > 5000) {
            setError("Enter an amount between ₹1 and ₹5,000.");
            return;
        }

        if (!Number.isInteger(scheduleDay) || scheduleDay < 1 || scheduleDay > 28) {
            setError("Choose a day between 1 and 28.");
            return;
        }

        if (!/^\d{4}$|^\d{6}$/.test(pin)) {
            setError("Enter a valid 4-digit or 6-digit Payment PIN.");
            return;
        }

        try {
            setSubmitting(true);

            const data = await request("/api/v1/autopay", {
                method: "POST",
                body: JSON.stringify({
                    to: to.trim().toLowerCase(),
                    amount: Math.round(rupees * 100),
                    dayOfMonth: scheduleDay,
                    pin
                })
            });

            setMessage(data.message || "AutoPay mandate created successfully.");
            setTo("");
            setAmount("");
            setDayOfMonth("15");
            setPin("");

            await loadMandates();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (id, action) => {
        setError("");
        setMessage("");

        const confirmed = action === "cancel"
            ? window.confirm("Are you sure you want to cancel this AutoPay mandate?")
            : true;

        if (!confirmed) return;

        try {
            const data = await request(`/api/v1/autopay/${id}/${action}`, {
                method: "POST"
            });

            setMessage(data.message || `Mandate ${action} successful.`);
            await loadMandates();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleViewRuns = async (mandate) => {
        setSelectedMandate(mandate);
        setRuns([]);
        setRunsLoading(true);
        setError("");

        try {
            const data = await request(
                `/api/v1/autopay/${mandate.id}/runs`
            );
            setRuns(data.runs || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setRunsLoading(false);
        }
    };

    const formatDate = (value) => {
        if (!value) return "Not available";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
    };

    const formatAmount = (value) =>
        `₹${(Number(value || 0) / 100).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    const displayName = (payee) => {
        if (!payee) return "Unknown recipient";

        const name = [payee.firstName, payee.lastName]
            .filter(Boolean)
            .join(" ");

        return name || payee.username || "Unknown recipient";
    };

    return (
        <div className="autopay-page">
            <div className="autopay-heading">
                <div>
                    <h2>AutoPay</h2>
                    <p>Manage your recurring wallet payments.</p>
                </div>
            </div>

            {message && (
                <div className="autopay-alert success">{message}</div>
            )}

            {error && (
                <div className="autopay-alert error">{error}</div>
            )}

            <section className="autopay-form-card">
                <h3>Create AutoPay</h3>
                <p className="autopay-description">
                    Set up a monthly payment to another KaasuPay user.
                </p>

                <form onSubmit={handleCreate}>
                    <div className="autopay-form-grid">
                        <label>
                            Recipient username
                            <input
                                type="email"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                placeholder="recipient@example.com"
                                required
                            />
                            <small>Enter the recipient's registered username.</small>
                        </label>

                        <label>
                            Monthly amount (₹)
                            <input
                                type="number"
                                min="1"
                                max="5000"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                                required
                            />
                        </label>

                        <label>
                            Payment day
                            <select
                                value={dayOfMonth}
                                onChange={(e) => setDayOfMonth(e.target.value)}
                            >
                                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                    <option key={day} value={day}>
                                        {day}{day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of every month
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Payment PIN
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                placeholder="Enter your Payment PIN"
                                autoComplete="new-password"
                                required
                            />
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="autopay-primary-btn"
                        disabled={submitting}
                    >
                        {submitting ? "Creating..." : "Create AutoPay"}
                    </button>
                </form>
            </section>

            <section className="autopay-list-section">
                <div className="autopay-section-heading">
                    <div>
                        <h3>Your AutoPay mandates</h3>
                        <p>View and manage your recurring payments.</p>
                    </div>
                    <button
                        type="button"
                        className="autopay-refresh-btn"
                        onClick={loadMandates}
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <p className="autopay-empty">Loading mandates...</p>
                ) : mandates.length === 0 ? (
                    <div className="autopay-empty">
                        <h4>No AutoPay mandates yet</h4>
                        <p>Your recurring payments will appear here.</p>
                    </div>
                ) : (
                    <div className="autopay-mandate-list">
                        {mandates.map(mandate => (
                            <article className="autopay-mandate-card" key={mandate.id}>
                                <div className="autopay-mandate-top">
                                    <div>
                                        <h4>{displayName(mandate.payee)}</h4>
                                        <span>{mandate.payee?.username || ""}</span>
                                    </div>
                                    <span className={`autopay-status ${String(mandate.status).toLowerCase()}`}>
                                        {mandate.status}
                                    </span>
                                </div>

                                <div className="autopay-details">
                                    <div>
                                        <small>Monthly amount</small>
                                        <strong>{formatAmount(mandate.amount)}</strong>
                                    </div>
                                    <div>
                                        <small>Payment day</small>
                                        <strong>{mandate.dayOfMonth} of every month</strong>
                                    </div>
                                    <div>
                                        <small>Next payment</small>
                                        <strong>{formatDate(mandate.nextRunDay)}</strong>
                                    </div>
                                    <div>
                                        <small>Failed payments</small>
                                        <strong>{mandate.failedCount || 0}</strong>
                                    </div>
                                </div>

                                <div className="autopay-actions">
                                    {mandate.status === "ACTIVE" && (
                                        <button
                                            type="button"
                                            onClick={() => handleAction(mandate.id, "pause")}
                                        >
                                            Pause
                                        </button>
                                    )}

                                    {mandate.status === "PAUSED" && (
                                        <button
                                            type="button"
                                            onClick={() => handleAction(mandate.id, "resume")}
                                        >
                                            Resume
                                        </button>
                                    )}

                                    {["ACTIVE", "PAUSED"].includes(mandate.status) && (
                                        <button
                                            type="button"
                                            className="autopay-cancel-btn"
                                            onClick={() => handleAction(mandate.id, "cancel")}
                                        >
                                            Cancel
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="autopay-history-btn"
                                        onClick={() => handleViewRuns(mandate)}
                                    >
                                        Payment history
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {selectedMandate && (
                <section className="autopay-history-section">
                    <div className="autopay-section-heading">
                        <div>
                            <h3>Payment history</h3>
                            <p>{displayName(selectedMandate.payee)}</p>
                        </div>
                        <button
                            type="button"
                            className="autopay-refresh-btn"
                            onClick={() => setSelectedMandate(null)}
                        >
                            Close
                        </button>
                    </div>

                    {runsLoading ? (
                        <p className="autopay-empty">Loading payment history...</p>
                    ) : runs.length === 0 ? (
                        <p className="autopay-empty">No payment attempts recorded yet.</p>
                    ) : (
                        <div className="autopay-run-list">
                            {runs.map((run, index) => (
                                <div className="autopay-run-row" key={run._id || index}>
                                    <div>
                                        <strong>{formatDate(run.dueDay)}</strong>
                                        <small>{run.status || "Unknown status"}</small>
                                    </div>
                                    <strong>{formatAmount(run.amount)}</strong>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

export default AutoPayPage;
