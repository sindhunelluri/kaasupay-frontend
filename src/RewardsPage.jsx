
import React, { useCallback, useEffect, useState } from "react";
import { apiUrl } from "./api";

function RewardsPage({ token }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(apiUrl("/api/v1/rewards"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    if (token) {
      fetchRewards();
    }
  }, [token, fetchRewards]);

  async function handleClaim(rewardId) {
    try {
      setClaimingId(rewardId);
      setMessage("");

      const response = await fetch(
        apiUrl(`/api/v1/rewards/${rewardId}/claim`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to claim reward.");
      }

      // Refresh the cards first so the latest status is displayed.
      await fetchRewards();

      // Display the claim result after refreshing.
      setMessage(data.message || "Reward processed successfully.");
      setMessageType(
        data.message?.toLowerCase().includes("luck")
          ? "info"
          : "success"
      );
    } catch (error) {
      setMessage(error.message || "Unable to claim reward.");
      setMessageType("error");
    } finally {
      setClaimingId(null);
    }
  }

  const formatAmount = (amount) =>
    amount == null ? null : `₹${(amount / 100).toFixed(2)}`;

  if (loading) {
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
          <p>Scratch your cards and discover your cashback rewards.</p>
        </div>

        <button
          className="rewards-refresh"
          onClick={fetchRewards}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {message && (
        <div className={`rewards-message ${messageType}`}>
          {message}
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="rewards-empty">
          <div className="rewards-empty-icon">🎁</div>
          <h2>No rewards yet</h2>
          <p>
            Make eligible payments of ₹100 or more to receive scratch cards.
          </p>
        </div>
      ) : (
        <div className="rewards-grid">
          {rewards.map((reward) => {
            const status = reward.status;
            const unclaimed = status === "UNCLAIMED";
            const claimed = status === "CLAIMED";

            return (
              <article
                className={`reward-card ${status?.toLowerCase()}`}
                key={reward.id}
              >
                <div className="reward-card-top">
                  <span>KAASUPAY</span>
                  <span className={`reward-status ${status?.toLowerCase()}`}>
                    {status}
                  </span>
                </div>

                <div className="reward-card-content">
                  {unclaimed ? (
                    <>
                      <div className="reward-gift">🎁</div>
                      <h2>Your reward is waiting!</h2>
                      <p>Scratch to reveal your cashback.</p>

                      <button
                        className="reward-scratch-button"
                        onClick={() => handleClaim(reward.id)}
                        disabled={claimingId === reward.id}
                      >
                        {claimingId === reward.id
                          ? "Revealing..."
                          : "✨ Scratch & Reveal"}
                      </button>
                    </>
                  ) : claimed ? (
                    <>
                      <div className="reward-gift">🎉</div>
                      <p className="reward-result-label">
                        Cashback credited
                      </p>
                      <h2 className="reward-amount">
                        {formatAmount(reward.amount)}
                      </h2>
                    </>
                  ) : (
                    <>
                      <div className="reward-gift">
                        {status === "EXPIRED" ? "⌛" : "🍀"}
                      </div>
                      <h2>
                        {status === "EXPIRED"
                          ? "Card expired"
                          : "Better luck next time"}
                      </h2>
                      <p>This reward card is no longer available.</p>
                    </>
                  )}
                </div>

                <div className="reward-card-footer">
                  <span>
                    {reward.createdAt
                      ? new Date(reward.createdAt).toLocaleDateString()
                      : "Reward card"}
                  </span>
                  <span>Scratch Card</span>
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
