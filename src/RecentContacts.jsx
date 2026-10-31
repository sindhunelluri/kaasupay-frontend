import { useState } from "react";

const FAV_KEY = "kaasupay-favorite-contacts";

function readFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function initialsOf(contact) {
  const source = contact.name || contact.username || "?";
  const parts = source.trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/* Builds the people the user has sent money to or received money from. */
export function getRecentContacts(transactions, getDirection, limit = 8) {
  const seen = new Map();

  [...(transactions || [])]
    .filter((item) => item.type === "TRANSFER")
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .forEach((item) => {
      const person = getDirection(item) === "DEBIT" ? item.toUserId : item.fromUserId;
      const username = person?.username?.trim().toLowerCase();
      if (!username || seen.has(username)) return;

      seen.set(username, {
        username,
        name: `${person.firstName || ""} ${person.lastName || ""}`.trim(),
      });
    });

  return [...seen.values()].slice(0, limit);
}

export default function RecentContacts({ contacts = [], onPick, disabled }) {
  const [favorites, setFavorites] = useState(readFavorites);

  function toggleFavorite(username) {
    const next = favorites.includes(username)
      ? favorites.filter((u) => u !== username)
      : [...favorites, username];

    setFavorites(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      // Storage may be blocked; the star still works for this visit.
    }
  }

  if (contacts.length === 0) return null;

  // Favorites first, then the most recent.
  const ordered = [...contacts].sort(
    (a, b) => favorites.includes(b.username) - favorites.includes(a.username)
  );

  return (
    <div className="rc-wrap">
      <span className="rc-label">Recent contacts</span>

      <div className="rc-list">
        {ordered.map((contact) => {
          const isFav = favorites.includes(contact.username);

          return (
            <div className="rc-item" key={contact.username}>
              <button
                type="button"
                className="rc-pick"
                disabled={disabled}
                onClick={() => onPick(contact.username)}
                title={contact.username}
              >
                <span className="rc-avatar">{initialsOf(contact)}</span>
                <span className="rc-name">{contact.name.split(" ")[0] || contact.username}</span>
              </button>

              <button
                type="button"
                className={isFav ? "rc-star on" : "rc-star"}
                onClick={() => toggleFavorite(contact.username)}
                aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFav}
              >
                ★
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
