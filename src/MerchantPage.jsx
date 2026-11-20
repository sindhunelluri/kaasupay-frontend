
import React, { useEffect, useState } from "react";
import { apiUrl } from "./api";

export default function MerchantPage({ token, onSuccess }) {
  const [merchant, setMerchant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refundingId, setRefundingId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");

  const [merchantOrderId, setMerchantOrderId] = useState(
    `KP-${Date.now()}`
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [refundOrder, setRefundOrder] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || "Request failed.");
    }

    return data;
  }

  async function loadMerchantData() {
    setLoading(true);

    try {
      const profile = await request("/api/v1/merchant/me");
      setMerchant(profile.merchant || profile);

      const orderData = await request("/api/v1/merchant/orders");
      setOrders(orderData.orders || []);
    } catch (error) {
      if (
        /merchant.*not found|not registered|no merchant|register/i.test(
          error.message
        )
      ) {
        setMerchant(null);
        setOrders([]);
      } else {
        setMessage(error.message);
        setIsError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadMerchantData();
  }, [token]);

  async function registerMerchant(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const data = await request("/api/v1/merchant/register", {
        method: "POST",
        body: JSON.stringify({
          shopName: shopName.trim(),
          description: description.trim(),
        }),
      });

      setMerchant(data.merchant || data);
      setMessage(data.message || "Merchant account created successfully.");
      setShopName("");
      setDescription("");
      await loadMerchantData();
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function createOrder(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    const amountInPaise = Math.round(Number(amount) * 100);

    if (
      !Number.isInteger(amountInPaise) ||
      amountInPaise < 100 ||
      amountInPaise > 1000000
    ) {
      setMessage("Enter an amount between ₹1 and ₹10,000.");
      setIsError(true);
      setSaving(false);
      return;
    }

    try {
      const data = await request("/api/v1/merchant/orders", {
        method: "POST",
        body: JSON.stringify({
          merchantOrderId: merchantOrderId.trim(),
          amount: amountInPaise,
          note: note.trim(),
        }),
      });

      setMessage(data.message || "Payment order created successfully.");
      setIsError(false);
      setAmount("");
      setNote("");
      setMerchantOrderId(`KP-${Date.now()}`);
      await loadMerchantData();
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function copyPaymentLink(order) {
    const orderId = order.id || order._id;

    if (!orderId) {
      setMessage("Order ID is missing. Please refresh your orders.");
      setIsError(true);
      return;
    }

    const link = new URL(
      `/?order=${encodeURIComponent(orderId)}`,
      window.location.origin
    ).toString();

    try {
      await navigator.clipboard.writeText(link);
      setMessage("Customer payment link copied.");
      setIsError(false);
    } catch {
      setMessage(`Copy this payment link: ${link}`);
      setIsError(false);
    }
  }

  function openRefundForm(order) {
    setRefundOrder(order);
    setRefundAmount("");
    setRefundReason("");
    setMessage("");
    setIsError(false);
  }

  async function submitRefund(event) {
    event.preventDefault();

    if (!refundOrder) return;

    const orderId = refundOrder.id || refundOrder._id;
    const amountInPaise = Math.round(Number(refundAmount) * 100);

    const remainingAmount =
      Number(refundOrder.amount || 0) -
      Number(refundOrder.refundedAmount || 0);

    if (
      !Number.isInteger(amountInPaise) ||
      amountInPaise < 1
    ) {
      setMessage("Enter a valid refund amount.");
      setIsError(true);
      return;
    }

    if (amountInPaise > remainingAmount) {
      setMessage(
        `You can refund a maximum of ${formatAmount(remainingAmount)}.`
      );
      setIsError(true);
      return;
    }

    if (refundReason.trim().length < 3) {
      setMessage("Please enter a reason with at least 3 characters.");
      setIsError(true);
      return;
    }

    setRefundingId(orderId);
    setMessage("");
    setIsError(false);

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `refund-${Date.now()}-${Math.random()}`;

      const data = await request(
        `/api/v1/merchant/orders/${orderId}/refunds`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            reason: refundReason.trim(),
          }),
        }
      );

      setMessage(data.message || "Refund processed successfully.");
      setIsError(false);
      setRefundOrder(null);
      setRefundAmount("");
      setRefundReason("");

      await loadMerchantData();

      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    } finally {
      setRefundingId("");
    }
  }

  function formatAmount(value) {
    return `₹${(Number(value || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const styles = {
    page: {
      display: "grid",
      gap: 22,
      color: "var(--text, #1f2937)",
    },
    hero: {
      padding: 25,
      borderRadius: 18,
      background: "linear-gradient(120deg,#fff7ed,#fff)",
      border: "1px solid #fed7aa",
    },
    title: {
      margin: 0,
      fontSize: 25,
      color: "#7c2d12",
    },
    subtitle: {
      margin: "7px 0 0",
      color: "#78716c",
      fontSize: 14,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
      gap: 18,
      alignItems: "start",
    },
    card: {
      background: "var(--card-bg, #fff)",
      border: "1px solid var(--border, #e5e7eb)",
      borderRadius: 16,
      padding: 21,
      minWidth: 0,
    },
    heading: {
      margin: "0 0 7px",
      fontSize: 17,
    },
    help: {
      margin: "0 0 18px",
      color: "#78716c",
      fontSize: 13,
      lineHeight: 1.5,
    },
    label: {
      display: "grid",
      gap: 7,
      marginBottom: 14,
      fontSize: 13,
      fontWeight: 600,
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      padding: "11px 12px",
      border: "1px solid #d6d3d1",
      borderRadius: 9,
      background: "var(--input-bg, #fff)",
      color: "var(--text, #1f2937)",
      fontSize: 14,
    },
    button: {
      width: "100%",
      border: 0,
      borderRadius: 9,
      padding: "12px 15px",
      background: "#ea580c",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
    },
    secondary: {
      border: "1px solid #fed7aa",
      borderRadius: 8,
      padding: "8px 11px",
      background: "#fff7ed",
      color: "#9a3412",
      fontWeight: 700,
      cursor: "pointer",
    },
    refundButton: {
      border: "1px solid #fecaca",
      borderRadius: 8,
      padding: "9px 12px",
      background: "#fef2f2",
      color: "#b91c1c",
      fontWeight: 700,
      cursor: "pointer",
    },
    message: {
      padding: 12,
      borderRadius: 9,
      fontSize: 13,
      background: isError ? "#fef2f2" : "#f0fdf4",
      color: isError ? "#b91c1c" : "#166534",
      border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}`,
    },
    order: {
      border: "1px solid var(--border, #e5e7eb)",
      borderRadius: 12,
      padding: 14,
      display: "grid",
      gap: 8,
    },
    muted: {
      color: "#78716c",
      fontSize: 12,
    },
    refundForm: {
      marginTop: 8,
      padding: 14,
      border: "1px solid #fed7aa",
      borderRadius: 10,
      background: "#fffbeb",
    },
  };

  if (loading) {
    return <section style={styles.card}>Loading merchant account...</section>;
  }

  if (!merchant) {
    return (
      <section style={styles.page}>
        <header style={styles.hero}>
          <h2 style={styles.title}>Register as a Merchant</h2>
          <p style={styles.subtitle}>
            Create your merchant profile to receive payments through KaasuPay.
          </p>
        </header>

        <div style={styles.card}>
          <h3 style={styles.heading}>Merchant registration</h3>
          <p style={styles.help}>
            Enter your shop or business details to get started.
          </p>

          <form onSubmit={registerMerchant}>
            <label style={styles.label}>
              Shop or business name
              <input
                style={styles.input}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                minLength={2}
                maxLength={80}
                placeholder="Enter your shop name"
                required
              />
            </label>

            <label style={styles.label}>
              Description
              <textarea
                style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={250}
                placeholder="Briefly describe your business"
              />
            </label>

            <button style={styles.button} disabled={saving}>
              {saving ? "Registering..." : "Create Merchant Account"}
            </button>
          </form>
        </div>

        {message && <div style={styles.message}>{message}</div>}
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <h2 style={styles.title}>Merchant Payments</h2>
        <p style={styles.subtitle}>
          Welcome, {merchant.shopName || "Merchant"}. Create payment orders
          and track customer payments.
        </p>
      </header>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.heading}>Create a payment order</h3>
          <p style={styles.help}>
            Generate a payment link that you can share with your customer.
          </p>

          <form onSubmit={createOrder}>
            <label style={styles.label}>
              Order reference
              <input
                style={styles.input}
                value={merchantOrderId}
                onChange={(e) => setMerchantOrderId(e.target.value)}
                maxLength={60}
                required
              />
            </label>

            <label style={styles.label}>
              Amount (₹)
              <input
                style={styles.input}
                type="number"
                min="1"
                max="10000"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
              />
            </label>

            <label style={styles.label}>
              Payment note
              <textarea
                style={{ ...styles.input, minHeight: 75, resize: "vertical" }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={100}
                placeholder="What is this payment for?"
              />
            </label>

            <button style={styles.button} disabled={saving}>
              {saving ? "Creating order..." : "Create Payment Order"}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h3 style={styles.heading}>Merchant details</h3>
          <p style={styles.help}>Your registered merchant profile.</p>
          <p><strong>Business:</strong> {merchant.shopName}</p>
          <p><strong>Description:</strong> {merchant.description || "—"}</p>
          <p><strong>Status:</strong> {merchant.isActive ? "Active" : "Inactive"}</p>

          <button
            type="button"
            style={styles.secondary}
            onClick={loadMerchantData}
            disabled={loading}
          >
            Refresh orders
          </button>
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <div style={styles.card}>
        <h3 style={styles.heading}>Payment orders</h3>
        <p style={styles.help}>
          View payment orders, copy customer payment links, and process refunds.
        </p>

        {orders.length === 0 ? (
          <p style={styles.muted}>
            You haven't created any payment orders yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {orders.map((order) => {
              const orderId = order.id || order._id;
              const refunded = Number(order.refundedAmount || 0);
              const remaining = Math.max(
                0,
                Number(order.amount || 0) - refunded
              );

              const canRefund =
                order.status === "PAID" ||
                order.status === "PARTIALLY_REFUNDED";

              return (
                <article key={orderId} style={styles.order}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{formatAmount(order.amount)}</strong>
                    <strong style={styles.muted}>{order.status}</strong>
                  </div>

                  <div style={styles.muted}>
                    Order reference: {order.merchantOrderId || "—"}
                  </div>

                  <div style={styles.muted}>
                    Note: {order.note || "—"}
                  </div>

                  <div style={styles.muted}>
                    Created:{" "}
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString("en-IN")
                      : "—"}
                  </div>

                  {refunded > 0 && (
                    <>
                      <div style={styles.muted}>
                        Total refunded: {formatAmount(refunded)}
                      </div>
                      <div style={styles.muted}>
                        Remaining refundable: {formatAmount(remaining)}
                      </div>
                    </>
                  )}

                  {order.status === "CREATED" && (
                    <button
                      type="button"
                      style={styles.secondary}
                      onClick={() => copyPaymentLink(order)}
                    >
                      Copy customer payment link
                    </button>
                  )}

                  {canRefund && remaining > 0 && (
                    <button
                      type="button"
                      style={styles.refundButton}
                      onClick={() =>
                        refundOrder?._id === orderId ||
                        refundOrder?.id === orderId
                          ? setRefundOrder(null)
                          : openRefundForm(order)
                      }
                    >
                      {refundOrder?._id === orderId ||
                      refundOrder?.id === orderId
                        ? "Close Refund Form"
                        : "Refund Payment"}
                    </button>
                  )}

                  {refundOrder &&
                    (refundOrder.id || refundOrder._id) === orderId && (
                      <form
                        style={styles.refundForm}
                        onSubmit={submitRefund}
                      >
                        <h4 style={{ margin: "0 0 8px", color: "#9a3412" }}>
                          Process Refund
                        </h4>

                        <p style={styles.muted}>
                          Maximum refundable amount: {formatAmount(remaining)}
                        </p>

                        <label style={styles.label}>
                          Refund amount (₹)
                          <input
                            style={styles.input}
                            type="number"
                            min="0.01"
                            max={(remaining / 100).toFixed(2)}
                            step="0.01"
                            placeholder="Enter refund amount"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            required
                          />
                        </label>

                        <label style={styles.label}>
                          Refund reason
                          <textarea
                            style={{
                              ...styles.input,
                              minHeight: 70,
                              resize: "vertical",
                            }}
                            placeholder="Enter reason for refund"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            minLength={3}
                            maxLength={100}
                            required
                          />
                        </label>

                        <button
                          type="submit"
                          style={styles.button}
                          disabled={refundingId === orderId}
                        >
                          {refundingId === orderId
                            ? "Processing Refund..."
                            : "Confirm Refund"}
                        </button>
                      </form>
                    )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
