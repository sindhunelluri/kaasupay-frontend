
import React, { useEffect, useState } from "react";
import { apiUrl } from "./api";

export default function MerchantPayPage({ orderId, token, onSuccess }) {
  const [order, setOrder] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      try {
        const response = await fetch(
          apiUrl(`/api/v1/merchant/pay/${encodeURIComponent(orderId)}`)
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "Unable to load payment order.");
        }

        if (!cancelled) {
          setOrder(data.order || data);
          setMerchant(data.merchant || data.order?.merchant || null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message);
          setIsError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  function formatAmount(value) {
    return `₹${(Number(value || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function payNow(event) {
    event.preventDefault();

    if (!token) {
      setMessage("Please sign in to KaasuPay before making this payment.");
      setIsError(true);
      return;
    }

    if (!/^(\d{4}|\d{6})$/.test(pin)) {
  setMessage("Enter your 4-digit or 6-digit Payment PIN.");
  setIsError(true);
  return;
}

    setPaying(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        apiUrl(`/api/v1/merchant/pay/${encodeURIComponent(orderId)}`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ pin }),
        }
      );

      const data = await response.json();

console.log("Merchant payment response:", {
  status: response.status,
  data: data,
});

if (!response.ok) {
  throw new Error(data.error || data.message || "Payment failed.");
}

      setPaid(true);
      setMessage(data.message || "Payment completed successfully.");
      setIsError(false);
      setPin("");

      if (onSuccess) await onSuccess();
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    } finally {
      setPaying(false);
    }
  }

  const cardStyle = {
    width: "100%",
    maxWidth: 480,
    margin: "30px auto",
    padding: 26,
    boxSizing: "border-box",
    border: "1px solid var(--border, #e5e7eb)",
    borderRadius: 18,
    background: "var(--card-bg, #fff)",
    color: "var(--text, #1f2937)",
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #d6d3d1",
    borderRadius: 9,
    fontSize: 16,
    background: "var(--input-bg, #fff)",
    color: "var(--text, #1f2937)",
  };

  const buttonStyle = {
    width: "100%",
    padding: 13,
    border: 0,
    borderRadius: 9,
    background: "#ea580c",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };

  if (loading) {
    return <div style={cardStyle}>Loading payment details...</div>;
  }

  if (!order) {
    return (
      <div style={cardStyle}>
        <h2>Payment link unavailable</h2>
        <p>{message || "We couldn't find this payment order."}</p>
      </div>
    );
  }

  const status = String(order.status || "UNKNOWN").toUpperCase();
  const businessName =
    merchant?.shopName ||
    merchant?.name ||
    order.shopName ||
    "Merchant";

  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: "#78716c" }}>
          KAASUPAY · SECURE PAYMENT
        </div>
        <h2 style={{ margin: "12px 0 5px", fontSize: 23 }}>
          {businessName}
        </h2>
        <div style={{ color: "#78716c", fontSize: 13 }}>
          Customer payment
        </div>
      </div>

      <div
        style={{
          padding: 20,
          borderRadius: 13,
          background: "#fff7ed",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ color: "#9a3412", fontSize: 13 }}>Amount to pay</div>
        <div style={{ color: "#7c2d12", fontSize: 32, fontWeight: 800 }}>
          {formatAmount(order.amount)}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
        <div>
          <strong>Order reference:</strong>{" "}
          {order.merchantOrderId || "—"}
        </div>
        <div>
          <strong>Payment note:</strong> {order.note || "—"}
        </div>
        <div>
          <strong>Order status:</strong> {status}
        </div>
      </div>

      {paid || status === "PAID" ? (
        <div
          style={{
            marginTop: 22,
            padding: 14,
            borderRadius: 10,
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Payment successful!</strong>
          <p style={{ marginBottom: 0 }}>
            This payment order has been paid.
          </p>
        </div>
      ) : status !== "CREATED" ? (
        <div style={{ marginTop: 20, color: "#b91c1c" }}>
          This payment order is not available for payment. Current status: {status}.
        </div>
      ) : (
        <form onSubmit={payNow} style={{ marginTop: 24 }}>
          <label
            style={{
              display: "grid",
              gap: 8,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Enter your KaasuPay Payment PIN
            <input
              style={inputStyle}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Enter 4-digit or 6-digit PIN"
              required
            />
          </label>

          <button
            type="submit"
            disabled={paying || !token}
            style={{
              ...buttonStyle,
              marginTop: 16,
              opacity: paying || !token ? 0.6 : 1,
            }}
          >
            {!token
              ? "Sign in to pay"
              : paying
                ? "Processing payment..."
                : `Pay ${formatAmount(order.amount)}`}
          </button>
        </form>
      )}

      {message && (
        <div
          role="status"
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 9,
            fontSize: 13,
            background: isError ? "#fef2f2" : "#f0fdf4",
            color: isError ? "#b91c1c" : "#166534",
          }}
        >
          {message}
        </div>
      )}

      <p
        style={{
          margin: "22px 0 0",
          textAlign: "center",
          color: "#78716c",
          fontSize: 12,
        }}
      >
        Your payment is processed through your KaasuPay wallet.
      </p>
    </div>
  );
}
