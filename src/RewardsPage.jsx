import React, { useCallback, useEffect, useState } from "react";
import { apiUrl } from "./api";

/*
  Reward types. The backend should send `type` on each reward:
    CASHBACK -> amount (paise)
    COUPON   -> couponCode, title, expiresAt
    DISCOUNT -> discountPercent, maxDiscount (paise)
    POINTS   -> points
    NONE     -> no prize ("Better luck next time")
  Rewards with no `type` fall back to CASHBACK, so old data still works.
*/
const REWARD_TYPES = {
  CASHBACK: { icon: "💰", label: "Cashback" },
  COUPON: { icon: "🎟️", label: "Coupon" },
  DISCOUNT: { icon: "🏷️", label: "Discount" },
  POINTS: { icon: "⭐", label: "KaasuPoints" },
  NONE: { icon: "🍀", label: "No prize" },
};

function RewardsPage({ token }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [filter, setFilter] = useState("ALL");

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(apiUrl("/api/v1/rewards"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load rewards.");
      }

      setRewards(
        Array.isArray(data)
          ? data
          : data.rewards || data.cards || data.items || []
      );
    } catch (error) {
      setMessage(error.message || "Unable to load rewards.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchRewards();
  }, [token, fetchRewards]);

  async function handleClaim(rewardId) {
    try {
      setClaimingId(rewardId);
      setMessage("");

      const response = await fetch(apiUrl(`/api/v1/rewards/${rewardId}/claim`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to claim reward.");
      }

      await fetchRewards();

      setMessage(data.message || "Reward processed successfully.");
      setMessageType(
        data.message?.toLowerCase().includes("luck") ? "info" : "success"
      );
    } catch (error) {
      setMessage(error.message || "Unable to claim reward.");
      setMessageType("error");
    } finally {
      setClaimingId(null);
    }
  }

  async function copyCode(reward) {
    try {
      await navigator.clipboard.writeText(reward.couponCode);
      setCopiedId(reward.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setMessage(`Your coupon code: ${reward.couponCode}`);
      setMessageType("info");
    }
  }

  const formatAmount = (amount) =>
    amount == null ? "—" : `₹${(amount / 100).toFixed(2)}`;

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString("en-IN") : null;

  const getType = (reward) =>
    String(reward.type || "CASHBACK").toUpperCase();

  // What is shown inside a claimed card, per reward type.
  function renderPrize(reward) {
    switch (getType(reward)) {
      case "COUPON":
        return (
          <>
            <p className="reward-result-label">
              {reward.title || "You won a coupon"}
            </p>
            <button
              type="button"
              className="reward-code"
              onClick={() => copyCode(reward)}
            >
              <span>{reward.couponCode || "—"}</span>
              <small>{copiedId === reward.id ? "Copied ✓" : "Tap to copy"}</small>
            </button>
            {reward.expiresAt && (
              <p className="reward-note">Valid till {formatDate(reward.expiresAt)}</p>
            )}
          </>
        );

      case "DISCOUNT":
        return (
          <>
            <p className="reward-result-label">Off your next payment</p>
            <h2 className="reward-amount">{reward.discountPercent ?? 0}% OFF</h2>
            {reward.maxDiscount != null && (
              <p className="reward-note">Up to {formatAmount(reward.maxDiscount)}</p>
            )}
          </>
        );

      case "POINTS":
        return (
          <>
            <p className="reward-result-label">Points added</p>
            <h2 className="reward-amount">+{reward.points ?? 0}</h2>
            <p className="reward-note">KaasuPoints</p>
          </>
        );

      case "NONE":
        return (
          <>
            <h2>Better luck next time</h2>
            <p>Keep paying to earn more cards.</p>
          </>
        );

      default: // CASHBACK
        return (
          <>
            <p className="reward-result-label">Cashback credited</p>
            <h2 className="reward-amount">{formatAmount(reward.amount)}</h2>
            <p className="reward-note">Added to your wallet</p>
          </>
        );
    }
  }

  const filters = [
    { key: "ALL", label: "All" },
    { key: "UNCLAIMED", label: "To scratch" },
    { key: "CLAIMED", label: "Won" },
    { key: "EXPIRED", label: "Expired" },
  ];

  const visibleRewards = rewards.filter(
    (r) => filter === "ALL" || r.status === filter
  );

  // Summary of what the user has won so far.
  const claimed = rewards.filter((r) => r.status === "CLAIMED");
  const totalCashback = claimed
    .filter((r) => getType(r) === "CASHBACK")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPoints = claimed
    .filter((r) => getType(r) === "POINTS")
    .reduce((sum, r) => sum + (r.points || 0), 0);
  const couponCount = claimed.filter((r) => getType(r) === "COUPON").length;
  const waiting = rewards.filter((r) => r.status === "UNCLAIMED").length;

  if (loading && rewards.length === 0) {
    return (
      <section className="rewards-page">
        <p className="rewards-loading">Loading your rewards...</p>
      </section>
    );
  }

  return (
    <section className="rewards-page">
      <div className="rewards-heading">
        <div>
          <span className="rewards-eyebrow">KAASUPAY REWARDS</span>
          <h1>My Rewards</h1>
          <p>Scratch your cards to win cashback, coupons, discounts and points.</p>
        </div>

        <button className="rewards-refresh" onClick={fetchRewards} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      <div className="rewards-summary">
        <div className="rewards-stat">
          <span>Cashback won</span>
          <strong>{formatAmount(totalCashback)}</strong>
        </div>
        <div className="rewards-stat">
          <span>KaasuPoints</span>
          <strong>{totalPoints}</strong>
        </div>
        <div className="rewards-stat">
          <span>Coupons</span>
          <strong>{couponCount}</strong>
        </div>
        <div className="rewards-stat">
          <span>Cards to scratch</span>
          <strong>{waiting}</strong>
        </div>
      </div>

      {message && <div className={`rewards-message ${messageType}`}>{message}</div>}

      <div className="rewards-filters" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`rewards-filter ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleRewards.length === 0 ? (
        <div className="rewards-empty">
          <div className="rewards-empty-icon">🎁</div>
          <h2>{rewards.length === 0 ? "No rewards yet" : "Nothing here"}</h2>
          <p>
            {rewards.length === 0
              ? "Make eligible payments of ₹100 or more to receive scratch cards."
              : "No cards match this filter."}
          </p>
        </div>
      ) : (
        <div className="rewards-grid">
          {visibleRewards.map((reward) => {
            const status = reward.status;
            const unclaimed = status === "UNCLAIMED";
            const isClaimed = status === "CLAIMED";
            const type = getType(reward);
            const typeInfo = REWARD_TYPES[type] || REWARD_TYPES.CASHBACK;

            return (
              <article
                className={`reward-card ${status?.toLowerCase()} ${
                  isClaimed ? `type-${type.toLowerCase()}` : ""
                }`}
                key={reward.id}
              >
                <div className="reward-card-top">
                  <span>KAASUPAY</span>
                  <span className={`reward-status ${status?.toLowerCase()}`}>
                    {isClaimed ? typeInfo.label : status}
                  </span>
                </div>

                <div className="reward-card-content">
                  {unclaimed ? (
                    <>
                      <div className="reward-gift">🎁</div>
                      <h2>Your reward is waiting!</h2>
                      <p>Scratch to reveal what you won.</p>

                      <button
                        className="reward-scratch-button"
                        onClick={() => handleClaim(reward.id)}
                        disabled={claimingId === reward.id}
                      >
                        {claimingId === reward.id ? "Revealing..." : "✨ Scratch & Reveal"}
                      </button>
                    </>
                  ) : isClaimed ? (
                    <>
                      <div className="reward-gift">{typeInfo.icon}</div>
                      {renderPrize(reward)}
                    </>
                  ) : (
                    <>
                      <div className="reward-gift">
                        {status === "EXPIRED" ? "⌛" : "🍀"}
                      </div>
                      <h2>
                        {status === "EXPIRED" ? "Card expired" : "Better luck next time"}
                      </h2>
                      <p>This reward card is no longer available.</p>
                    </>
                  )}
                </div>

                <div className="reward-card-footer">
                  <span>
                    {reward.createdAt
                      ? new Date(reward.createdAt).toLocaleDateString("en-IN")
                      : "Reward card"}
                  </span>
                  <span>{isClaimed ? typeInfo.label : "Scratch card"}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RewardsPage;