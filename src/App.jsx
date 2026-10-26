import { useEffect, useRef, useState } from "react";
import "./App.css";
import { apiUrl } from "./api";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [showBalance, setShowBalance] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileContainerRef = useRef(null);

useEffect(() => {
  function handleOutsideClick(event) {
    if (
      profileContainerRef.current &&
      !profileContainerRef.current.contains(event.target)
    ) {
      setShowProfileMenu(false);
    }
  }

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, []);

  const [token, setToken] = useState(
    () => sessionStorage.getItem("kaasupay_token") || ""
  );
  const [authMode, setAuthMode] = useState("signin");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [accountLoading, setAccountLoading] = useState(false);

  const menuItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Add Money", icon: "+" },
    { name: "Transfer", icon: "↗" },
    { name: "Transactions", icon: "↔" },
  ];

  async function handleAuth(formData) {
    setAuthError("");
    setAuthLoading(true);

    try {
      const endpoint =
        authMode === "signup"
          ? "/api/v1/user/signup"
          : "/api/v1/user/signin";

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to authenticate.");
      }

      if (authMode === "signup") {
        setAuthMode("signin");
        setAuthError(
          "Account created successfully. Please sign in."
        );
        return;
      }

      if (!data.token) {
        throw new Error("The server did not return a login token.");
      }

      sessionStorage.setItem("kaasupay_token", data.token);
      setToken(data.token);
      setAuthError("");
    } catch (error) {
      setAuthError(
        error.message || "Unable to connect to the backend."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("kaasupay_token");
    setToken("");
    setUser(null);
    setWalletBalance(null);
    setTransactions([]);
    setActivePage("Dashboard");
    setAuthMode("signin");
    setAuthError("");
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadAccount() {
      setAccountLoading(true);
      setAuthError("");

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [userResponse, balanceResponse, transactionResponse] =
  await Promise.all([
    fetch(apiUrl("/api/v1/user/me"), { headers }),
    fetch(apiUrl("/api/v1/wallet/balance"), { headers }),
    fetch(apiUrl("/api/v1/wallet/transactions?page=1&limit=10"), {
      headers,
    }),
  ]);

        if (
          userResponse.status === 401 ||
          balanceResponse.status === 401
        ) {
          if (!cancelled) {
            sessionStorage.removeItem("kaasupay_token");
            setToken("");
            setUser(null);
            setWalletBalance(null);
            setAuthMode("signin");
            setAuthError("Your session expired. Please sign in again.");
          }
          return;
        }

        const userData = await userResponse.json();
        const balanceData = await balanceResponse.json();

        if (!userResponse.ok) {
          throw new Error(userData.error || "Could not load your profile.");
        }

        if (!balanceResponse.ok) {
          throw new Error(
            balanceData.error || "Could not load your wallet balance."
          );
        }

        let transactionData = { transactions: [] };

        if (transactionResponse.ok) {
          transactionData = await transactionResponse.json();
        }

        if (!cancelled) {
          setUser(userData.user);
          setWalletBalance(Number(balanceData.balanceInRupees));
          setTransactions(transactionData.transactions || []);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(
            error.message || "Unable to load your account."
          );
        }
      } finally {
        if (!cancelled) {
          setAccountLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={(mode) => {
          setAuthMode(mode);
          setAuthError("");
        }}
        onSubmit={handleAuth}
        error={authError}
        loading={authLoading}
      />
    );
  }

  function navigate(page) {
    setActivePage(page);
  }

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "KaasuPay User";

  const totalTopups = transactions
    .filter((item) => item.type === "TOPUP")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0) / 100;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">K</div>
          <div>
            <h2>KaasuPay</h2>
            <span>Digital Wallet</span>
          </div>
        </div>

        <p className="menu-label">MENU</p>

        <nav className="navigation">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={
                activePage === item.name
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => navigate(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
              {item.name === "Transactions" && (
                <span className="nav-arrow">›</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <strong>Need help?</strong>
            <p>We're here to help you.</p>
            <button
              onClick={() =>
                (window.location.href = "mailto:support@example.com")
              }
            >
              Contact support
            </button>
          </div>

          
<div className="profile-container" ref={profileContainerRef}>
  <button
    type="button"
    className="profile profile-trigger"
    onClick={() => setShowProfileMenu((previous) => !previous)}
    aria-expanded={showProfileMenu}
    aria-label="Open profile menu"
  >
    <div className="avatar">
      {(user?.firstName?.[0] || "K").toUpperCase()}
      {(user?.lastName?.[0] || "P").toUpperCase()}
    </div>

    <div className="profile-details">
      <strong>{fullName}</strong>
      <span>{user?.username || "Wallet user"}</span>
    </div>

    <span className="profile-chevron">
      {showProfileMenu ? "⌃" : "⌄"}
    </span>
  </button>

  {showProfileMenu && (
    <div className="profile-dropdown">
      <div className="profile-dropdown-heading">
        <div className="avatar" >
          {(user?.firstName?.[0] || "K").toUpperCase()}
          {(user?.lastName?.[0] || "P").toUpperCase()}
        </div>
        <div className="profile-details">
          <strong>{fullName}</strong>
          <span>{user?.username || "Wallet user"}</span>
        </div>
      </div>

      <div className="profile-info-row">
        <span>First name</span>
        <strong>{user?.firstName || "—"}</strong>
      </div>

      <div className="profile-info-row">
        <span>Last name</span>
        <strong>{user?.lastName || "—"}</strong>
      </div>

      <div className="profile-info-row">
        <span>Email address</span>
        <strong>{user?.username || "—"}</strong>
      </div>

      <button
        type="button"
        className="profile-logout"
        onClick={logout}
      >
        <span>↪</span>
        Logout
      </button>
    </div>
  )}
</div>

        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / {activePage}</p>
            <h1>{activePage}</h1>
          </div>

          <div className="topbar-right">
            <span className="secure-label">
              <span className="secure-dot" />
              Secure wallet
            </span>
            <div className="avatar" title={fullName}>
              {(user?.firstName?.[0] || "K").toUpperCase()}
              {(user?.lastName?.[0] || "P").toUpperCase()}
            </div>
          </div>
        </header>

        {authError && (
          <div className="notice" role="alert">
            {authError}
          </div>
        )}

        {accountLoading && (
          <div className="notice">Loading your account details...</div>
        )}

        {activePage === "Dashboard" && (
          <>
            <section className="welcome">
              <div>
                <h2>Welcome, {user?.firstName || "User"} 👋</h2>
                <p>Manage your wallet and transactions in one place.</p>
              </div>
              <span className="date-label">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </section>

            <section className="overview-grid">
              <div className="balance-card">
                <div className="balance-heading">
                  <span>Available balance</span>
                  <span className="wallet-symbol">₹</span>
                </div>

                <div className="balance-amount">
                  {showBalance
                    ? walletBalance === null
                      ? "Loading..."
                      : `₹${walletBalance.toFixed(2)}`
                    : "₹••••••"}
                  <button
                    className="eye-button"
                    onClick={() => setShowBalance(!showBalance)}
                    aria-label="Toggle balance visibility"
                  >
                    {showBalance ? "◉" : "◎"}
                  </button>
                </div>

                <p className="balance-note">Your actual wallet balance</p>

                <div className="balance-actions">
                  <button
                    className="primary-button"
                    onClick={() => navigate("Add Money")}
                  >
                    + Add Money
                  </button>
                  <button
                    className="light-button"
                    onClick={() => navigate("Transfer")}
                  >
                    ↗ Transfer
                  </button>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Total top-ups</span>
                  <span className="stat-icon green">↓</span>
                </div>
                <h2>₹{totalTopups.toFixed(2)}</h2>
                <p>From the loaded transactions</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Transactions</span>
                  <span className="stat-icon purple">↔</span>
                </div>
                <h2>{transactions.length}</h2>
                <p>Loaded transaction records</p>
              </div>
            </section>

            <section className="content-card">
              <div className="section-heading">
                <div>
                  <h2>Recent transactions</h2>
                  <p>Your latest wallet activity</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("Transactions")}
                >
                  View all →
                </button>
              </div>

              <TransactionTable items={transactions.slice(0, 3)} />
            </section>

            <section className="quick-actions">
              <h2>Quick actions</h2>
              <div className="quick-grid">
                <button onClick={() => navigate("Add Money")}>
                  <span className="quick-icon orange">+</span>
                  <span>
                    <strong>Add money</strong>
                    <small>Top up your wallet</small>
                  </span>
                  <span className="quick-arrow">›</span>
                </button>

                <button onClick={() => navigate("Transfer")}>
                  <span className="quick-icon blue">↗</span>
                  <span>
                    <strong>Transfer money</strong>
                    <small>Send to another user</small>
                  </span>
                  <span className="quick-arrow">›</span>
                </button>

                <button onClick={() => navigate("Transactions")}>
                  <span className="quick-icon purple">↔</span>
                  <span>
                    <strong>Transaction history</strong>
                    <small>Review wallet activity</small>
                  </span>
                  <span className="quick-arrow">›</span>
                </button>
              </div>
            </section>
          </>
        )}
        
        {activePage === "Add Money" && (
          <AddMoneyForm token={token} />
        )}

        {activePage === "Transfer" && (
          <TransferForm token={token} />
        )}

        {activePage === "Transactions" && (
          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>Transaction history</h2>
                <p>Your latest wallet activity.</p>
              </div>
            </div>
            <TransactionTable items={transactions} />
            {transactions.length === 0 && (
              <p className="form-help">No transactions found.</p>
            )}
          </section>
        )}

        <footer className="footer">
          <span>© 2026 KaasuPay</span>
          <span>Manage your money with confidence.</span>
        </footer>
      </main>
    </div>
  );
}



function AddMoneyForm({ token }) {
  const [amount, setAmount] = useState("10");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");

  useEffect(() => {
    if (window.Razorpay) return;

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  function selectAmount(value) {
    setAmount(String(value));
    setOrder(null);
    setMessage("");
    setIsSuccess(false);
  }

  async function createOrder(event) {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);
    setOrder(null);

    const rupees = Number(amount);

    if (!Number.isInteger(rupees) || rupees < 10 || rupees > 10000) {
      setMessage("Enter a whole-rupee amount between ₹10 and ₹10,000.");
      return;
    }

    if (!token) {
      setMessage("Your session is missing. Please sign in again.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/v1/wallet/add-money/order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: rupees * 100 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create the payment order.");
      }

      if (!data.orderId || !data.keyId || !data.currency) {
        throw new Error("The server returned incomplete payment order details.");
      }

      setOrder({
        orderId: data.orderId,
        amount: data.amount,
        currency: data.currency,
        keyId: data.keyId,
      });

      setMessage("Payment order created successfully.");
    } catch (error) {
      setMessage(error.message || "Unable to create the payment order.");
    } finally {
      setLoading(false);
    }
  }

  async function payWithRazorpay() {
    if (!order || paying) return;

    if (!window.Razorpay) {
      setMessage("Razorpay is still loading. Please try again.");
      return;
    }

    setPaying(true);
    setMessage("");

    try {
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "KaasuPay",
        description: "Wallet top-up",
        order_id: order.orderId,

        handler: async function (payment) {
          setMessage("Payment received. Verifying with the server...");

          try {
            const response = await fetch(
              apiUrl("/api/v1/wallet/add-money/verify"),
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  razorpay_order_id: payment.razorpay_order_id,
                  razorpay_payment_id: payment.razorpay_payment_id,
                  razorpay_signature: payment.razorpay_signature,
                }),
              }
            );

            const result = await response.json();

            if (!response.ok) {
              throw new Error(
                result.error || "Payment verification failed."
              );
            }

            setIsSuccess(true);

            let successMessage =
              result.message || "Payment verified successfully.";

            if (Number.isInteger(result.walletBalance)) {
              successMessage +=
                ` Wallet balance: ₹${(result.walletBalance / 100).toFixed(2)}.`;
            } else {
              successMessage += " Check your updated wallet balance.";
            }

            setMessage(successMessage);
          } catch (error) {
            setMessage(
              `${error.message} Do not pay again immediately. Check the payment status first.`
            );
          } finally {
            setPaying(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPaying(false);
            setMessage(
              "Checkout closed. If you attempted payment, check its status before retrying."
            );
          },
        },

        theme: { color: "#292929" },
      });

      checkout.on("payment.failed", function (event) {
        setMessage(
          "Payment failed: " +
            (event.error?.description || "Please check the payment status.")
        );
        setPaying(false);
      });

      checkout.open();
    } catch (error) {
      setMessage(error.message || "Unable to open Razorpay Checkout.");
      setPaying(false);
    }
  }

  return (
    <section className="content-card action-card add-money-page">
      <div className="add-money-heading">
        <div className="add-money-heading-icon">
          <span>₹</span>
        </div>
        <div>
          <h2>Add Money</h2>
          <p>Top up your KaasuPay wallet securely.</p>
        </div>
      </div>

      <div className="add-money-grid">
        <div className="add-money-panel">
          <form onSubmit={createOrder}>
            <label className="field-label" htmlFor="wallet-add-amount">
              Amount to add
            </label>

            <div className="add-money-amount-wrap">
              <span>₹</span>
              <input
                id="wallet-add-amount"
                type="number"
                min="10"
                max="10000"
                step="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(event) => selectAmount(event.target.value)}
                required
              />
            </div>

            <div className="quick-amounts">
              {[100, 500, 1000].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    Number(amount) === value
                      ? "quick-amount selected"
                      : "quick-amount"
                  }
                  onClick={() => selectAmount(value)}
                >
                  ₹{value.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="wallet-payment-method">
              Payment method
            </label>

            <div className="add-money-method">
              <div className="add-money-method-icon">
                <span>▣</span>
              </div>
              <div className="add-money-method-copy">
                <strong>Razorpay Checkout</strong>
                <small>Cards and other available methods</small>
              </div>
              <span className="add-money-method-check">✓</span>
            </div>

            <select
              id="wallet-payment-method"
              className="add-money-method-select"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              aria-label="Payment method"
            >
              <option value="razorpay">Razorpay Checkout</option>
            </select>

            <button
              className="primary-button full-button add-money-create"
              type="submit"
              disabled={loading || paying}
            >
              {loading ? "Creating order..." : "Create Payment Order"}
              {!loading && <span>→</span>}
            </button>

            <p className="add-money-security">
              <span>🔒</span>
              Your wallet is credited only after payment verification.
            </p>
          </form>

          {message && (
            <p
              className={
                isSuccess
                  ? "auth-message auth-success add-money-message"
                  : "form-help add-money-message"
              }
              role="status"
            >
              {message}
            </p>
          )}
        </div>

        <aside className="add-money-info-panel">
          <div className="add-money-info-heading">
            <div className="add-money-info-icon">✓</div>
            <div>
              <h3>Secure top-up</h3>
              <p>How it works</p>
            </div>
          </div>

          <div className="add-money-steps">
            <div className="add-money-step">
              <span>1</span>
              <div>
                <strong>Create an order</strong>
                <p>Choose how much you want to add.</p>
              </div>
            </div>
            <div className="add-money-step">
              <span>2</span>
              <div>
                <strong>Complete payment</strong>
                <p>Continue through Razorpay Checkout.</p>
              </div>
            </div>
            <div className="add-money-step">
              <span>3</span>
              <div>
                <strong>Verify securely</strong>
                <p>Your server verifies the payment.</p>
              </div>
            </div>
          </div>

          <div className="add-money-info-note">
            <span>i</span>
            <p>Creating an order does not add money to your wallet.</p>
          </div>
        </aside>
      </div>

      {order && (
        <div className="payment-order-result add-money-order">
          <div className="add-money-order-heading">
            <div>
              <h3>Payment order details</h3>
              <p>Review your order before continuing.</p>
            </div>
            <span className="add-money-order-status">
              {isSuccess ? "Verified" : "Awaiting payment"}
            </span>
          </div>

          <div className="add-money-order-summary">
            <span>Order amount</span>
            <strong>
              ₹{(Number(order.amount) / 100).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>

          <div className="add-money-order-fields">
            <div>
              <span>Order ID</span>
              <code>{order.orderId}</code>
            </div>
            <div>
              <span>Currency</span>
              <strong>{order.currency}</strong>
            </div>
            <div>
              <span>Public key ID</span>
              <code>{order.keyId}</code>
            </div>
          </div>

          <details className="add-money-raw-details">
            <summary>View raw order JSON</summary>
            <pre className="payment-order-json">
              {JSON.stringify(order, null, 2)}
            </pre>
          </details>

          <button
            className="primary-button full-button add-money-pay"
            type="button"
            onClick={payWithRazorpay}
            disabled={paying || isSuccess}
          >
            {paying
              ? "Processing payment..."
              : isSuccess
                ? "Payment Verified ✓"
                : "Pay with Razorpay →"}
          </button>
        </div>
      )}
    </section>
  );
}



function AuthScreen({ mode, setMode, onSubmit, error, loading }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = {
      username: username.trim(),
      password,
    };

    if (mode === "signup") {
      formData.firstName = firstName.trim();
      formData.lastName = lastName.trim();
    }

    await onSubmit(formData);
  }

  return (
    <div className="auth-page">
<section className="auth-brand-panel">
  <div className="auth-brand-content">
    <div className="auth-brand">
      <span className="auth-brand-name">kaasupay</span>
      <span className="auth-brand-dot">.</span>
    </div>

    <div className="auth-brand-message">
      <p className="auth-eyebrow">A BETTER WAY TO BANK</p>
      <h1>
        Money management,
        <br />
        without the hassle.
      </h1>
      <p className="auth-brand-description">
        Your balance, payments and transactions.
        Everything you need, right where you need it.
      </p>
    </div>

    <p className="auth-brand-footer">
      Simple. Convenient. Made for you.
    </p>
  </div>
</section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <div className="auth-brand-icon">K</div>
            <span>KaasuPay</span>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "signin" ? "auth-tab selected" : "auth-tab"}
              onClick={() => setMode("signin")}
            >
              Sign In
            </button>

            <button
              type="button"
              className={mode === "signup" ? "auth-tab selected" : "auth-tab"}
              onClick={() => setMode("signup")}
            >
              Create Account
            </button>
          </div>

          <div className="auth-heading">
            <div className="auth-heading-icon">
              {mode === "signin" ? "👋" : "✨"}
            </div>

            <h2>
              {mode === "signin" ? "Welcome back!" : "Let's get started!"}
            </h2>

            <p className="auth-description">
              {mode === "signin"
                ? "Sign in to access your wallet and manage your money."
                : "Create your KaasuPay account in just a few steps."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && (
              <div className="auth-name-fields">
                <div className="auth-field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    maxLength={50}
                    autoComplete="given-name"
                    placeholder="First name"
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                    maxLength={50}
                    autoComplete="family-name"
                    placeholder="Last name"
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="username">Email address</label>
              <input
                id="username"
                type="email"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "signup" ? 6 : 1}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "signup"
                    ? "At least 6 characters"
                    : "Enter your password"
                }
              />
              {mode === "signup" && (
                <p className="auth-field-hint">
                  Use at least 6 characters.
                </p>
              )}
            </div>

            {error && (
              <p
                className={
                  error.startsWith("Account created")
                    ? "auth-message auth-success"
                    : "auth-message"
                }
                role="alert"
              >
                {error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign In to Your Wallet →"
                  : "Create My Account →"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin"
              ? "New to KaasuPay?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="auth-security">
            <span>🔒</span>
            <span>Your account is protected by KaasuPay authentication.</span>
          </div>
        </div>
      </section>
    </div>
  );
}


function TransferForm({ token }) {
  const [to, setTo] = useState(() => {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("kaasupay_pending_transfer") || "null"
    );
    return saved?.to || "";
  } catch {
    return "";
  }
});

const [amount, setAmount] = useState(() => {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("kaasupay_pending_transfer") || "null"
    );
    return saved?.amount ? String(saved.amount / 100) : "";
  } catch {
    return "";
  }
});

const [note, setNote] = useState(() => {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("kaasupay_pending_transfer") || "null"
    );
    return saved?.note === "Wallet transfer" ? "" : saved?.note || "";
  } catch {
    return "";
  }
});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(
  () => sessionStorage.getItem("kaasupay_transfer_key") || ""
);

const [keyedTransfer, setKeyedTransfer] = useState(() => {
  const saved = sessionStorage.getItem("kaasupay_pending_transfer");

  try {
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
});

  
  async function handleTransfer(event) {
    event.preventDefault();
    if (loading) return;

    setMessage("");
    setLoading(true);
    setSuccess(false);

    const amountInPaise = Math.round(Number(amount) * 100);

    if (
      !Number.isFinite(amountInPaise) ||
      amountInPaise < 100 ||
      amountInPaise > 1000000
    ) {
      setMessage("Enter an amount between ₹1 and ₹10,000.");
      setLoading(false);
      return;
    }

    const currentTransfer = {
      to: to.trim(),
      amount: amountInPaise,
      note: note.trim() || "Wallet transfer",
    };

    const sameTransfer =
      keyedTransfer &&
      keyedTransfer.to === currentTransfer.to &&
      keyedTransfer.amount === currentTransfer.amount &&
      keyedTransfer.note === currentTransfer.note;

    const savedKey = sessionStorage.getItem("kaasupay_transfer_key");
    const transferKey =
      sameTransfer && idempotencyKey && savedKey === idempotencyKey
        ? idempotencyKey
        : crypto.randomUUID();

    setIdempotencyKey(transferKey);
    setKeyedTransfer(currentTransfer);

    sessionStorage.setItem("kaasupay_transfer_key", transferKey);
    sessionStorage.setItem(
      "kaasupay_pending_transfer",
      JSON.stringify(currentTransfer)
    );

    try {
      const response = await fetch(apiUrl("/api/v1/wallet/transfer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": transferKey,
        },
        body: JSON.stringify(currentTransfer),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transfer failed.");
      }

      setSuccess(true);
      setMessage("Transfer successful!");
      setTo("");
      setAmount("");
      setNote("");
      setIdempotencyKey("");
      setKeyedTransfer(null);

      sessionStorage.removeItem("kaasupay_transfer_key");
      sessionStorage.removeItem("kaasupay_pending_transfer");
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to confirm the transfer. Check your transaction history before retrying."
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <section className="content-card action-card">
      <div className="section-heading">
        <div>
          <h2>Transfer money</h2>
          <p>Send money to another KaasuPay user.</p>
        </div>
        <span className="stat-icon purple">↗</span>
      </div>

      <form className="auth-form" onSubmit={handleTransfer}>
        <label htmlFor="recipient">Recipient email address</label>
        <input
          id="recipient"
          type="email"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          required
          placeholder="recipient@example.com"
        />

        <label htmlFor="transferAmount">Amount (₹)</label>
        <input
          id="transferAmount"
          type="number"
          min="1"
          max="10000"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
          placeholder="Enter amount"
        />

        <label htmlFor="transferNote">Note (optional)</label>
        <input
          id="transferNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={50}
          placeholder="What is this transfer for?"
        />

        {message && (
          <p className={success ? "auth-message auth-success" : "auth-message"} role="status">
            {message}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Processing..." : "Transfer Money"}
        </button>
      </form>

      <p className="form-help">
        Check the recipient email and amount carefully before transferring.
      </p>
    </section>
  );
}

function TransactionTable({ items }) {
  function formatAmount(amount) {
    return `₹${(Number(amount || 0) / 100).toFixed(2)}`;
  }

  function transactionTitle(item) {
    if (item.type === "TOPUP") return "Wallet top-up";
    if (item.type === "TRANSFER") return "Wallet transfer";
    return item.type || "Transaction";
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>TRANSACTION</th>
            <th>DATE</th>
            <th>TYPE</th>
            <th>AMOUNT</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isCredit = item.type === "TOPUP" || !item.fromUserId;
            const date = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—";

            return (
              <tr key={item._id}>
                <td>
                  <div className="transaction-name">
                    <span className="transaction-icon">
                      {isCredit ? "↓" : "↗"}
                    </span>
                    <strong>{transactionTitle(item)}</strong>
                  </div>
                </td>
                <td>{date}</td>
                <td>
                  <span className="type-credit">
                    {isCredit ? "Credit" : "Transfer"}
                  </span>
                </td>
                <td className={isCredit ? "amount-credit" : ""}>
                  {isCredit ? "+" : "−"}{formatAmount(item.amount)}
                </td>
                <td>
                  <span className="status-success">
                    <span /> {item.status || "Unknown"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <p className="form-help">No transactions found yet.</p>
      )}
    </div>
  );
}

export default App;
