// Turns a failed API reply into one clear sentence for the user.
export function apiErrorMessage(response, data = {}, fallback = "Something went wrong") {
  const rupees = (paise) =>
    `₹${(Number(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const wait = (seconds) => {
    const s = Number(seconds) || Number(response.headers?.get?.("Retry-After")) || 0;
    if (s <= 0) return "a little while";
    return s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`;
  };

  if (response.status === 423) {
    return `Your PIN is locked after too many wrong tries. Try again in ${wait(data.retryAfterSeconds)}.`;
  }
  if (response.status === 429) {
    return `Too many requests. Please try again in ${wait(data.retryAfterSeconds)}.`;
  }
  if (response.status === 400 && data.leftToday !== undefined) {
    return Number(data.leftToday) > 0
      ? `Daily limit reached. You can send ${rupees(data.leftToday)} more today.`
      : "Daily limit reached. You can send money again after midnight.";
  }
  return data.message || data.error || `${fallback} (${response.status}).`;
}