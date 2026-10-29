import React,{ Fragment, useEffect, useRef, useState } from "react";
import "./App.css";
import { apiUrl } from "./api";


function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [showBalance, setShowBalance] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileContainerRef = useRef(null);

  // Mobile / tablet slide-in menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    function onResize() {
      if (window.innerWidth > 1024) setMobileMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [mobileMenuOpen]);

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
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionPagination, setTransactionPagination] = useState({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
});
const [transactionLoading, setTransactionLoading] = useState(false);
const [accountLoading, setAccountLoading] = useState(false);

  const menuItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Add Money", icon: "+" },
    { name: "Transfer", icon: "↗" },
    { name: "Bank Accounts", icon: "⌂" },
    { name: "Withdraw", icon: "↓" },
    { name: "Withdrawal History", icon: "◷" },
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
          setTransactionPagination(
            transactionData.pagination || {
              page: 1,
              limit: 10,
              total: (transactionData.transactions || []).length,
              totalPages: 1,
          }
          );
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

  
async function loadTransactions(page) {
  if (!token || transactionLoading) return;

  setTransactionLoading(true);

  try {
    const response = await fetch(
      apiUrl(
        `/api/v1/wallet/transactions?page=${page}&limit=${transactionPagination.limit}`
      ),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logout();
      setAuthError("Your session expired. Please sign in again.");
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Could not load transaction history."
      );
    }

    setTransactions(data.transactions || []);
    setTransactionPagination(
      data.pagination || {
        page,
        limit: 10,
        total: (data.transactions || []).length,
        totalPages: 1,
      }
    );
  } catch (error) {
    setAuthError(error.message || "Unable to load transactions.");
  } finally {
    setTransactionLoading(false);
  }
}

async function refreshWalletData() {
  if (!token) return;

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  try {
    const [balanceResponse, transactionResponse] = await Promise.all([
      fetch(apiUrl("/api/v1/wallet/balance"), { headers }),
      fetch(apiUrl("/api/v1/wallet/transactions?page=1&limit=10"), {
        headers,
      }),
    ]);

    if (
      balanceResponse.status === 401 ||
      transactionResponse.status === 401
    ) {
      logout();
      setAuthError("Your session expired. Please sign in again.");
      return;
    }

    const balanceData = await balanceResponse.json();
    const transactionData = await transactionResponse.json();

    if (!balanceResponse.ok) {
      throw new Error(
        balanceData.error || "Could not refresh wallet balance."
      );
    }

    if (!transactionResponse.ok) {
      throw new Error(
        transactionData.error || "Could not refresh transactions."
      );
    }

    setWalletBalance(Number(balanceData.balanceInRupees));
    setTransactions(transactionData.transactions || []);
    setTransactionPagination(
      transactionData.pagination || {
        page: 1,
        limit: 10,
        total: (transactionData.transactions || []).length,
        totalPages: 1,
      }
    );
  } catch (error) {
    setAuthError(
      error.message || "Unable to refresh wallet information."
    );
  }
}

if (!token) {
  if (showAuthScreen) {
    return (
      <>
        <button
          type="button"
          className="back-to-overview"
          onClick={() => {
            setShowAuthScreen(false);
            setAuthError("");
          }}
        >
          ← Back to Overview
        </button>

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
      </>
    );
  }

  return (
    <LandingPage
      onSignIn={() => {
        setAuthMode("signin");
        setAuthError("");
        setShowAuthScreen(true);
      }}
      onCreateAccount={() => {
        setAuthMode("signup");
        setAuthError("");
        setShowAuthScreen(true);
      }}
    />
  );
}


  function navigate(page) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "KaasuPay User";

  const totalTopups = transactions
    .filter((item) => item.type === "TOPUP")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0) / 100;

  return (
    <div className="app-layout">
      <div
        className={mobileMenuOpen ? "sidebar-backdrop show" : "sidebar-backdrop"}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={mobileMenuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-icon">K</div>
          <div>
            <h2>KaasuPay</h2>
            <span>Digital Wallet</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            ✕
          </button>
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
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>
            <div>
              <p className="breadcrumb">Workspace / {activePage}</p>
            </div>
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
                <p>From the currently loaded records</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Transactions</span>
                  <span className="stat-icon purple">↔</span>
                </div>
                <h2>{transactionPagination.total}</h2>
                <p>Total transaction records</p>
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

                <button onClick={() => navigate("Bank Accounts")}>
                  <span className="quick-icon blue">⌂</span>
                  <span>
                    <strong>Bank accounts</strong>
                    <small>Manage saved bank details</small>
                  </span>
                  <span className="quick-arrow">›</span>
                </button>

                <button onClick={() => navigate("Withdraw")}>
                  <span className="quick-icon orange">↓</span>
                  <span>
                    <strong>Withdraw money</strong>
                    <small>Review withdrawal requirements</small>
                  </span>
                  <span className="quick-arrow">›</span>
                </button>
              </div>
            </section>
          </>
        )}
        
        {activePage === "Add Money" && (
  <AddMoneyForm
    token={token}
    onSuccess={refreshWalletData}
  />
)}

{activePage === "Transfer" && (
  <TransferForm
    token={token}
    balance={walletBalance}
    showBalance={showBalance}
    setShowBalance={setShowBalance}
    onSuccess={refreshWalletData}
  />
)}

        {activePage === "Bank Accounts" && (
  <BankAccountsPage token={token} />
)}

{activePage === "Withdraw" && (
  <WithdrawPage token={token} />
)}

{activePage === "Withdrawal History" && (
  <WithdrawalHistoryPage token={token} />
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

{transactionLoading && (
  <p className="form-help">Loading transactions...</p>
)}

{!transactionLoading && transactions.length === 0 && (
  <p className="form-help">
    No transactions found on this page.
  </p>
)}

<div className="transaction-pagination">
  <span>
    {transactionPagination.total === 0
      ? "No transactions"
      : `Page ${transactionPagination.page} of ${Math.max(
          1,
          transactionPagination.totalPages
        )} · ${transactionPagination.total} total transactions`}
  </span>

  <div className="transaction-pagination-actions">
    <button
      type="button"
      className="light-button"
      disabled={
        transactionLoading ||
        transactionPagination.page <= 1
      }
      onClick={() =>
        loadTransactions(transactionPagination.page - 1)
      }
    >
      ← Previous
    </button>

    <button
      type="button"
      className="light-button"
      disabled={
        transactionLoading ||
        transactionPagination.page >=
          transactionPagination.totalPages
      }
      onClick={() =>
        loadTransactions(transactionPagination.page + 1)
      }
    >
      Next →
    </button>
  </div>
</div>
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


function LandingPage({ onSignIn, onCreateAccount }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="landing-page">
      <header className="landing-nav">
  <a className="landing-brand" href="#overview">
    <span className="landing-logo">K</span>
    <span className="landing-brand-text">
      <span className="auth-brand-name">kaasupay</span>
      <span className="auth-brand-dot">.</span>
    </span>
  </a>

  <nav className={`landing-links ${mobileMenuOpen ? "mobile-open" : ""}`}>
    <a href="#overview" onClick={() => setMobileMenuOpen(false)}>Overview</a>
    <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
    <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
    <a href="#integrity" onClick={() => setMobileMenuOpen(false)}>Integrity</a>

    <div className="mobile-nav-actions">
      <button className="landing-signin" onClick={() => { setMobileMenuOpen(false); onSignIn(); }}>
        Sign In
      </button>
      <button className="landing-cta" onClick={() => { setMobileMenuOpen(false); onCreateAccount(); }}>
        Create Account
      </button>
    </div>
  </nav>

  <div className="landing-nav-actions desktop-nav-actions">
    <button className="landing-signin" onClick={onSignIn}>Sign In</button>
    <button className="landing-cta" onClick={onCreateAccount}>Create Account</button>
  </div>

  <button
    className="landing-menu-toggle"
    type="button"
    aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
    aria-expanded={mobileMenuOpen}
    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  >
    <span>{mobileMenuOpen ? "✕" : "☰"}</span>
  </button>
</header>

      <main>
        <section className="landing-hero" id="overview">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              YOUR MONEY, YOUR CONTROL
            </span>

            <h1>
              A simpler way to
              <br />
              manage your <span>money.</span>
            </h1>

            <p>
              Manage your digital wallet, add money, transfer funds
              to other users, and keep track of your transactions
              from one place.
            </p>

            <div className="landing-hero-actions">
              <button className="landing-cta" onClick={onCreateAccount}>
                Get Started →
              </button>
              <button className="landing-secondary" onClick={onSignIn}>
                Sign In
              </button>
            </div>

            <div className="landing-trust-note">
              <span>✓</span> Wallet activity in one place
              <span>✓</span> Transaction history
            </div>
          </div>

          <div className="landing-wallet-visual">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />

            <div className="landing-wallet-card">
              <div className="landing-wallet-top">
                <span className="landing-logo">K</span>
                <span>KAASUPAY WALLET</span>
                <span className="landing-card-dot">●</span>
              </div>

              <p>Digital wallet</p>
              <h2>Money management, simplified.</h2>

              <div className="landing-card-bottom">
                <span>Secure access</span>
                <span>•••• 2026</span>
              </div>
            </div>

            <div className="landing-floating-card landing-float-top">
              <span className="landing-float-icon">↗</span>
              <div>
                <strong>Easy transfers</strong>
                <small>Send to another user</small>
              </div>
            </div>

            <div className="landing-floating-card landing-float-bottom">
              <span className="landing-float-icon">↔</span>
              <div>
                <strong>Track activity</strong>
                <small>View your transactions</small>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">WHAT YOU CAN DO</span>
            <h2>Everything you need in one wallet.</h2>
            <p>
              Access your wallet tools through a simple, organised
              dashboard.
            </p>
          </div>

          <div className="landing-feature-grid">
            <article className="landing-feature">
              <span className="landing-feature-icon">₹</span>
              <h3>Wallet Overview</h3>
              <p>Check your available balance and wallet activity.</p>
            </article>

            <article className="landing-feature">
              <span className="landing-feature-icon">＋</span>
              <h3>Add Money</h3>
              <p>Create a top-up order and use available payment options.</p>
            </article>

            <article className="landing-feature">
              <span className="landing-feature-icon">↗</span>
              <h3>Transfer Funds</h3>
              <p>Send money to another KaasuPay user.</p>
            </article>

            <article className="landing-feature">
              <span className="landing-feature-icon">↔</span>
              <h3>Transaction History</h3>
              <p>Review your recorded wallet transactions.</p>
            </article>
          </div>
        </section>

        
<section className="landing-how" id="how-it-works">
  <div className="landing-section-heading">
    <span className="landing-eyebrow">HOW IT WORKS</span>
    <h2>Send money in three simple steps.</h2>
    <p>
      From choosing your recipient to receiving a transaction
      receipt, follow a clear step-by-step process.
    </p>
  </div>

  <div className="landing-steps">
    <article className="landing-step-card">
      <div className="landing-step-top">
        <span className="landing-step-number">01</span>
        <span className="landing-step-icon">👤</span>
      </div>

      <h3>Select Recipient & Amount</h3>
      <p>
        Choose the intended recipient and enter the amount
        you want to transfer.
      </p>

      <div className="landing-step-details">
        <div>✓ Select the recipient</div>
        <div>✓ Enter the transfer amount</div>
        <div>✓ Review the details</div>
      </div>

      <span className="landing-step-link">
        Choose recipient <span>→</span>
      </span>
    </article>

    <article className="landing-step-card">
      <div className="landing-step-top">
        <span className="landing-step-number">02</span>
        <span className="landing-step-icon">🔐</span>
      </div>

      <h3>Choose & Authorize</h3>
      <p>
        Review the available transaction options and
        authorize the transfer using the required verification.
      </p>

      <div className="landing-step-details">
        <div>✓ Review transaction options</div>
        <div>✓ Verify the transfer details</div>
        <div>✓ Authorize when prompted</div>
      </div>

      <span className="landing-step-link">
        Verify details <span>→</span>
      </span>
    </article>

    <article className="landing-step-card">
      <div className="landing-step-top">
        <span className="landing-step-number">03</span>
        <span className="landing-step-icon">🧾</span>
      </div>

      <h3>Transfer & Receipt</h3>
      <p>
        Check the transfer result and view the transaction
        reference when the server returns it.
      </p>

      <div className="landing-step-details">
        <div>✓ Check the transaction status</div>
        <div>✓ Review the transfer record</div>
        <div>✓ Keep the receipt details</div>
      </div>

      <span className="landing-step-link">
        View transaction <span>→</span>
      </span>
    </article>
  </div>
</section>


        

<section className="landing-integrity" id="integrity">
  {/* Heading at the top */}
  <div className="landing-section-heading">
    <span className="landing-eyebrow">SECURITY & TRUST</span>
    <h2>Your money deserves protection.</h2>
    <p>
      Designed to make everyday wallet transactions more
      controlled, private, and secure.
    </p>
  </div>

  {/* Three cards below the heading */}
  <div className="integrity-grid">
    <article className="integrity-card">
      <div className="integrity-icon">🛡️</div>
      <span className="integrity-label">01 · TRANSACTION CONTROL</span>
      <h3>Daily Transfer Limit</h3>
      <p>
        Manage daily transfer limits to help control
        the amount sent from your wallet.
      </p>
    </article>

    <article className="integrity-card">
      <div className="integrity-icon">🔐</div>
      <span className="integrity-label">02 · AUTHORIZATION</span>
      <h3>Payment PIN</h3>
      <p>
        Add a verification step to help authorize
        wallet transactions securely.
      </p>
    </article>

    <article className="integrity-card">
      <div className="integrity-icon">🏦</div>
      <span className="integrity-label">03 · DATA PRIVACY</span>
      <h3>Encrypted Bank Details</h3>
      <p>
        Protect sensitive banking information through
        appropriate encryption and secure data handling.
      </p>
    </article>
  </div>
</section>



        <section className="landing-bottom-cta">
          <h2>Ready to get started?</h2>
          <p>Create your account to access your KaasuPay wallet.</p>
          <button className="landing-cta" onClick={onCreateAccount}>
            Create Account →
          </button>
        </section>
      </main>

      <footer className="landing-footer">
  <a className="landing-brand" href="#overview">
    <span className="landing-logo">K</span>
    <span className="landing-brand-text">
      <span className="auth-brand-name">kaasupay</span>
      <span className="auth-brand-dot">.</span>
    </span>
  </a>
  <span>© 2026 KaasuPay</span>
</footer>
    </div>
  );
}



function AddMoneyForm({ token, onSuccess }) {
  const [amount, setAmount] = useState("10");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    if (window.Razorpay) return;

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onerror = () => {
      setMessage("Unable to load Razorpay Checkout. Please refresh and try again.");
    };

    document.body.appendChild(script);

    return () => {
      // Keep the script available for other components using Razorpay.
    };
  }, []);

  function selectAmount(value) {
    setAmount(String(value));
    setOrder(null);
    setShowOrderModal(false);
    setMessage("");
    setIsSuccess(false);
  }

  async function createOrder(event) {
    event.preventDefault();

    if (loading || paying) return;

    setMessage("");
    setIsSuccess(false);
    setOrder(null);
    setShowOrderModal(false);

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
      const response = await fetch(
        apiUrl("/api/v1/wallet/add-money/order"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount: rupees * 100 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not create the payment order."
        );
      }

      if (
        !data.orderId ||
        !data.keyId ||
        !data.currency ||
        !Number.isFinite(Number(data.amount))
      ) {
        throw new Error(
          "The server returned incomplete payment order details."
        );
      }

      setOrder({
        orderId: data.orderId,
        amount: Number(data.amount),
        currency: data.currency,
        keyId: data.keyId,
      });

      setMessage("");
      setShowOrderModal(true);
    } catch (error) {
      setMessage(error.message || "Unable to create the payment order.");
    } finally {
      setLoading(false);
    }
  }

  async function payWithRazorpay() {
    if (!order || paying || isSuccess) return;

    if (!window.Razorpay) {
      setMessage("Razorpay is still loading. Please try again.");
      return;
    }

    if (!token) {
      setMessage("Your session is missing. Please sign in again.");
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
        theme: { color: "#292929" },

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

            // Verification succeeded.
            setIsSuccess(true);
            setShowOrderModal(false);
            setOrder(null);

            let successMessage = "Money added successfully!";

            if (Number.isInteger(result.walletBalance)) {
              successMessage +=
                ` Your wallet balance is ₹${(
                  result.walletBalance / 100
                ).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}.`;
            }

            setMessage(successMessage);

            // Refresh wallet information, if the parent provides this callback.
            try {
              await onSuccess?.();
            } catch (refreshError) {
              console.error("Wallet refresh failed:", refreshError);
            }
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
      });

      checkout.on("payment.failed", function (event) {
  const error = event.error || {};

  // Diagnostic details for local development.
  console.error("Razorpay payment failure:", {
    code: error.code,
    description: error.description,
    source: error.source,
    step: error.step,
    reason: error.reason,
    orderId: error.metadata?.order_id,
    paymentId: error.metadata?.payment_id,
  });

  setMessage(
    `Payment failed: ${error.description || "Unknown error"}` +
      (error.code ? ` (Code: ${error.code})` : "") +
      (error.reason ? ` — Reason: ${error.reason}` : "")
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

      {/* Add Money form */}
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
      </div>

      {/* Secure top-up now appears below the form */}
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

      {/* Centered payment order popup */}
      {order && showOrderModal && (
        <div
          className="order-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowOrderModal(false);
            }
          }}
        >
          <div
            className="order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
          >
            <button
              type="button"
              className="order-modal-close"
              onClick={() => setShowOrderModal(false)}
              aria-label="Close order details"
            >
              ×
            </button>

            <div className="add-money-order-heading">
              <div>
                <h3 id="order-modal-title">Payment Order Details</h3>
                <p>Review your order before continuing.</p>
              </div>

              <span className="add-money-order-status">
                Awaiting payment
              </span>
            </div>

            <div className="add-money-order-summary">
              <span>Order amount</span>
              <strong>
                ₹{(order.amount / 100).toLocaleString("en-IN", {
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
              disabled={paying}
            >
              {paying ? "Processing payment..." : "Pay with Razorpay →"}
            </button>

            <button
              className="light-button full-button order-modal-cancel"
              type="button"
              onClick={() => setShowOrderModal(false)}
              disabled={paying}
            >
              Close
            </button>
          </div>
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






function TransferForm({
  token,
  onSuccess,
  balance,
  showBalance,
  setShowBalance,
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Wallet balance is stored in rupees.
  const availableBalance =
    balance === null || balance === undefined || balance === ""
      ? null
      : Number(balance);

  const amountInRupees = Number(amount);
  const amountInPaise = Math.round(amountInRupees * 100);

  const balanceLoaded =
    availableBalance !== null &&
    Number.isFinite(availableBalance) &&
    availableBalance >= 0;

  const validAmount =
    amount.trim() !== "" &&
    Number.isFinite(amountInRupees) &&
    amountInPaise >= 100 &&
    amountInPaise <= 1000000;

  const hasSufficientBalance =
    balanceLoaded && amountInRupees <= availableBalance;

  // PIN is not required until the user opens the confirmation popup.
  const canSubmit =
    Boolean(token) &&
    to.trim().length > 0 &&
    validAmount &&
    hasSufficientBalance &&
    !loading;

  // Open the PIN popup after validating the transfer details.
  function openPinModal() {
    setMessage("");
    setMessageType("");

    if (!token) {
      setMessage("Please sign in again to continue.");
      setMessageType("error");
      return;
    }

    if (!to.trim()) {
      setMessage("Please enter the recipient's details.");
      setMessageType("error");
      return;
    }

    if (!validAmount) {
      setMessage("Enter an amount between ₹1 and ₹10,000.");
      setMessageType("error");
      return;
    }

    if (!balanceLoaded) {
      setMessage("Your wallet balance is still loading.");
      setMessageType("error");
      return;
    }

    if (!hasSufficientBalance) {
      setMessage("Insufficient wallet balance for this transfer.");
      setMessageType("error");
      return;
    }

    setPin("");
    setShowPinModal(true);
  }

  async function handleTransfer(event) {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (!token) {
      setMessage("Please sign in again to continue.");
      setMessageType("error");
      return;
    }

    if (!to.trim() || !validAmount) {
      setMessage("Please check the recipient and transfer amount.");
      setMessageType("error");
      return;
    }

    if (!balanceLoaded) {
      setMessage("Your wallet balance is still loading.");
      setMessageType("error");
      return;
    }

    if (!hasSufficientBalance) {
      setMessage("Insufficient wallet balance for this transfer.");
      setMessageType("error");
      return;
    }

    if (!pin.trim()) {
      setMessage("Please enter your transaction PIN.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        apiUrl("/api/v1/wallet/transfer"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            to: to.trim(),
            amount: amountInPaise,
            note: note.trim(),
            pin: pin,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Transfer failed (${response.status}).`
        );
      }

      setMessage(
        data.message || "Transfer completed successfully."
      );
      setMessageType("success");

      setTo("");
      setAmount("");
      setNote("");
      setPin("");
      setShowPinModal(false);

      // Refresh the actual wallet balance and transactions.
      if (typeof onSuccess === "function") {
        await onSuccess();
      }
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to complete the transfer. Please check the transaction status."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="transfer-page">
      <header className="transfer-page-header">
        <div className="transfer-header-icon" aria-hidden="true">
          ↗
        </div>

        <div>
          <p className="transfer-eyebrow">WALLET SERVICES</p>
          <h2>Transfer Money</h2>
          <p className="transfer-tagline">
            Send money securely from your KaasuPay wallet.
          </p>
        </div>
      </header>

      {/* Available wallet balance */}
      <section className="transfer-balance-card">
        <div className="transfer-balance-top">
          <div className="transfer-balance-icon" aria-hidden="true">
            ₹
          </div>
          <span>Available Balance</span>
        </div>

        <div className="transfer-balance-amount-row">
          <p className="transfer-balance-amount">
            {!balanceLoaded
              ? "Loading..."
              : showBalance
                ? `₹${availableBalance.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "₹••••••"}
          </p>

          <button
            type="button"
            className="eye-button transfer-balance-eye"
            onClick={() => setShowBalance((previous) => !previous)}
            aria-label={showBalance ? "Hide balance" : "Show balance"}
            aria-pressed={showBalance}
          >
            {showBalance ? "◉" : "◎"}
          </button>
        </div>

        <p className="transfer-balance-caption">
          Amount currently available in your wallet
        </p>
      </section>

      {/* Transfer details form */}
      <section className="transfer-details-card">
        <div className="transfer-card-heading">
          <div>
            <p className="transfer-eyebrow">PAYMENT DETAILS</p>
            <h3>Transfer Details</h3>
            <p>Enter the recipient and amount you want to send.</p>
          </div>

          <div className="transfer-details-icon" aria-hidden="true">
            ⇄
          </div>
        </div>

        <form
          className="transfer-form"
          onSubmit={(event) => {
            event.preventDefault();
            openPinModal();
          }}
        >
          <div className="transfer-field">
            <label htmlFor="transfer-recipient">Recipient</label>

            <input
              id="transfer-recipient"
              type="text"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="Enter recipient email or user ID"
              autoComplete="off"
              maxLength={254}
              required
              disabled={loading}
            />

            <p className="transfer-field-help">
              Enter the recipient identifier accepted by your backend.
            </p>
          </div>

          <div className="transfer-field">
            <label htmlFor="transfer-amount">Amount</label>

            <div className="transfer-amount-wrap">
              <span aria-hidden="true">₹</span>

              <input
                id="transfer-amount"
                type="number"
                min="1"
                max="10000"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                required
                disabled={loading}
              />

              <span className="transfer-currency">INR</span>
            </div>

            <p className="transfer-field-help">
              ₹1–₹10,000 per transfer, subject to backend limits.
            </p>
          </div>

          <div className="transfer-field">
            <label htmlFor="transfer-note">
              Note <span className="transfer-optional">(Optional)</span>
            </label>

            <textarea
              id="transfer-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What's this transfer for?"
              rows={3}
              maxLength={200}
              disabled={loading}
            />

            <p className="transfer-field-help">
              Add a short description for this transaction.
            </p>
          </div>

          <div className="transfer-summary">
            <div>
              <span>Transfer amount</span>

              <strong>
                {amount.trim() && Number.isFinite(amountInRupees)
                  ? `₹${amountInRupees.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "₹0.00"}
              </strong>
            </div>

            <p>Review the recipient and amount before sending.</p>
          </div>

          {message && !showPinModal && (
            <div
              className={`transfer-message ${
                messageType === "success" ? "is-success" : "is-error"
              }`}
              role={messageType === "error" ? "alert" : "status"}
            >
              {message}
            </div>
          )}

          <button
            className="transfer-submit"
            type="submit"
            disabled={!canSubmit}
          >
            Send Money ↗
          </button>

          <p className="transfer-security-note">
            Check the recipient details carefully before sending.
          </p>
        </form>
      </section>

      {/* Transaction PIN popup */}
      {showPinModal && (
        <div
          className="transfer-pin-overlay"
          onClick={() => {
            if (!loading) {
              setShowPinModal(false);
              setPin("");
              setMessage("");
              setMessageType("");
            }
          }}
        >
          <div
            className="transfer-pin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-pin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="transfer-pin-icon" aria-hidden="true">
              🔒
            </div>

            <h3 id="transfer-pin-title">Confirm Transfer</h3>

            <p>
              Enter your transaction PIN to send{" "}
              <strong>
                ₹
                {amountInRupees.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              .
            </p>

            <form onSubmit={handleTransfer}>
              <div className="transfer-field">
                <label htmlFor="transfer-pin">
                  Transaction PIN
                </label>

                <input
                  id="transfer-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="Enter your transaction PIN"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>

              {message && (
                <div
                  className={`transfer-message ${
                    messageType === "success"
                      ? "is-success"
                      : "is-error"
                  }`}
                  role={messageType === "error" ? "alert" : "status"}
                >
                  {message}
                </div>
              )}

              <div className="transfer-pin-actions">
                <button
                  type="button"
                  className="transfer-pin-cancel"
                  onClick={() => {
                    setShowPinModal(false);
                    setPin("");
                    setMessage("");
                    setMessageType("");
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="transfer-submit"
                  disabled={loading || !pin.trim()}
                >
                  {loading ? "Processing..." : "Confirm Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}





function TransactionTable({ items = [] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  function formatAmount(amount) {
    return `₹${(Number(amount || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getPerson(person) {
    if (!person) return "External payment / wallet";

    const name = `${person.firstName || ""} ${
      person.lastName || ""
    }`.trim();

    return name
      ? `${name} (@${person.username || "user"})`
      : `@${person.username || "user"}`;
  }

  function getDirection(item) {
    if (item.type === "TOPUP" || item.type === "DEPOSIT") {
      return "CREDIT";
    }

    if (item.type === "REVERSAL") {
      return "CREDIT";
    }

    if (item.type === "WITHDRAWAL") {
      return "DEBIT";
    }

    if (item.type === "TRANSFER") {
      return item.withWhom?.startsWith("Transfer from")
        ? "CREDIT"
        : "DEBIT";
    }

    return item.fromUserId ? "DEBIT" : "CREDIT";
  }

  function getTitle(item) {
    switch (item.type) {
      case "TOPUP":
        return "Wallet top-up";
      case "DEPOSIT":
        return "Wallet deposit";
      case "TRANSFER":
        return item.withWhom || "Wallet transfer";
      case "WITHDRAWAL":
        return "Bank withdrawal";
      case "REVERSAL":
        return "Transaction reversal";
      default:
        return item.type || "Transaction";
    }
  }


  function getStatusClass(status) {
  switch (String(status || "").toUpperCase()) {
    case "SUCCESS":
    case "PAID":
    case "COMPLETED":
      return "status-success";

    case "PENDING":
    case "PROCESSING":
    case "NEEDS_REVIEW":
      return "status-pending";

    case "FAILED":
    case "REJECTED":
    case "CANCELLED":
      return "status-failed";

    default:
      return "status-unknown";
  }
}

  const filteredItems = items.filter((item) => {
    const direction = getDirection(item);
    const date = item.createdAt ? new Date(item.createdAt) : null;
    const query = search.trim().toLowerCase();

    const searchableText = [
      item._id,
      item.type,
      item.status,
      item.note,
      item.withWhom,
      item.fromUserId?.username,
      item.fromUserId?.firstName,
      item.fromUserId?.lastName,
      item.toUserId?.username,
      item.toUserId?.firstName,
      item.toUserId?.lastName,
      String(Number(item.amount || 0) / 100),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !searchableText.includes(query)) return false;

    if (typeFilter === "SENT" &&
        !(item.type === "TRANSFER" && direction === "DEBIT")) {
      return false;
    }

    if (typeFilter === "RECEIVED" &&
        !(item.type === "TRANSFER" && direction === "CREDIT")) {
      return false;
    }

    if (typeFilter === "TOPUP" &&
        !["TOPUP", "DEPOSIT"].includes(item.type)) {
      return false;
    }

    if (typeFilter === "WITHDRAWAL" &&
        item.type !== "WITHDRAWAL") {
      return false;
    }

    if (
      statusFilter !== "ALL" &&
      String(item.status || "").toUpperCase() !== statusFilter
    ) {
      return false;
    }

    if (fromDate) {
      const start = new Date(`${fromDate}T00:00:00`);
      if (!date || date < start) return false;
    }

    if (toDate) {
      const end = new Date(`${toDate}T23:59:59.999`);
      if (!date || date > end) return false;
    }

    return true;
  });

  return (
    <div className="transaction-history">
      <div className="transaction-filters">
        <input
          type="search"
          aria-label="Search transactions"
          placeholder="Search username, note, ID or amount..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filter transaction type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="ALL">All transactions</option>
          <option value="SENT">Money sent</option>
          <option value="RECEIVED">Money received</option>
          <option value="TOPUP">Money added</option>
          <option value="WITHDRAWAL">Withdrawals</option>
        </select>

        <select
          aria-label="Filter transaction status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>

        <label>
          From
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="light-button"
          onClick={() => {
            setSearch("");
            setTypeFilter("ALL");
            setStatusFilter("ALL");
            setFromDate("");
            setToDate("");
          }}
        >
          Clear filters
        </button>
      </div>

      <p className="transaction-result-count">
        Showing {filteredItems.length} of {items.length} loaded transactions
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>TRANSACTION</th>
              <th>DATE & TIME</th>
              <th>FROM</th>
              <th>TO</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th>DETAILS</th>
            </tr>
          </thead>

          <tbody>
            {filteredItems.map((item) => {
              const direction = getDirection(item);
              const isCredit = direction === "CREDIT";
              const isSelected = selectedId === item._id;

              const sender =
                item.type === "TOPUP" || item.type === "DEPOSIT"
                  ? "Payment gateway"
                  : item.type === "REVERSAL"
                    ? "Wallet reversal"
                    : item.fromUserId
                      ? getPerson(item.fromUserId)
                      : "External source";

              const recipient =
                item.type === "WITHDRAWAL"
                  ? "Bank account"
                  : item.toUserId
                    ? getPerson(item.toUserId)
                    : "External destination";

              return (
              <Fragment key={item._id}>
                  <tr>
                    <td>
                      <div className="transaction-name">
                        <span className="transaction-icon">
                          {isCredit ? "↓" : "↗"}
                        </span>
                        <strong>{getTitle(item)}</strong>
                      </div>
                    </td>

                    <td>{formatDate(item.createdAt)}</td>
                    <td>{sender}</td>
                    <td>{recipient}</td>

                    <td className={isCredit ? "amount-credit" : ""}>
                      {isCredit ? "+" : "−"}
                      {formatAmount(item.amount)}
                    </td>

                    <td>
                      <span className={getStatusClass(item.status)}>
                        <span />
                        {item.status || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setSelectedId(isSelected ? null : item._id)
                        }
                      >
                        {isSelected ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>

                  {isSelected && (
                    <tr>
                      <td colSpan={7}>
                        <div className="transaction-detail-panel">
                          <strong>Transaction details</strong>

                          <p>
                            <b>Transaction ID:</b> {item._id || "—"}
                          </p>
                          <p>
                            <b>Type:</b> {item.type || "—"}
                          </p>
                          <p>
                            <b>Note:</b> {item.note || "No note provided"}
                          </p>
                          <p>
                            <b>Sender:</b> {sender}
                          </p>
                          <p>
                            <b>Recipient:</b> {recipient}
                          </p>
                          <p>
                            <b>Amount:</b> {formatAmount(item.amount)}
                          </p>
                          <p>
                            <b>Status:</b> {item.status || "Unknown"}
                          </p>
                          <p>
                            <b>Date:</b> {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <p className="form-help">
            No transactions match your search or filters.
          </p>
        )}
      </div>
    </div>
  );
}


function BankAccountsPage({ token }) {
  const [accounts, setAccounts] = useState([]);
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPinConfirmation, setShowPinConfirmation] = useState(false);
  const [paymentPin, setPaymentPin] = useState("");
  const styles = {
    page: { display: "grid", gap: 22 },
    hero: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "24px 26px", borderRadius: 20, background: "linear-gradient(125deg, #fff7ed 0%, #fff 60%, #fef3c7 100%)", border: "1px solid #fed7aa" },
    heroIcon: { width: 54, height: 54, borderRadius: 16, display: "grid", placeItems: "center", background: "#f97316", color: "#fff", fontSize: 25, flexShrink: 0, boxShadow: "0 8px 18px rgba(249,115,22,.18)" },
    heroTitle: { margin: 0, fontSize: 25, lineHeight: 1.2, color: "#1f2937", letterSpacing: "-0.5px" },
    subtitle: { margin: "7px 0 0", color: "#6b7280", fontSize: 14, lineHeight: 1.55 },
    layout: { display: "grid", gridTemplateColumns: "minmax(280px, .85fr) minmax(320px, 1.15fr)", gap: 20, alignItems: "start" },
    panel: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 22, boxShadow: "0 5px 20px rgba(15,23,42,.035)", minWidth: 0 },
    panelTitle: { margin: 0, color: "#111827", fontSize: 17, fontWeight: 700 },
    panelText: { margin: "6px 0 20px", color: "#6b7280", fontSize: 13, lineHeight: 1.5 },
    label: { display: "grid", gap: 7, color: "#374151", fontWeight: 600, fontSize: 13, marginBottom: 15 },
    input: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 13px", color: "#111827", background: "#fff", fontSize: 14, outlineColor: "#f97316" },
    primary: { display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8, width: "100%", border: 0, borderRadius: 11, padding: "12px 16px", background: saving ? "#fdba74" : "#ea580c", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer", boxShadow: "0 5px 12px rgba(234,88,12,.15)" },
    secondary: { border: "1px solid #fed7aa", borderRadius: 9, padding: "8px 11px", background: "#fff7ed", color: "#c2410c", fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer" },
    accountList: { display: "grid", gap: 12 },
    account: { position: "relative", overflow: "hidden", padding: 17, border: "1px solid #e5e7eb", borderRadius: 14, background: "linear-gradient(135deg,#ffffff 0%,#f9fafb 100%)" },
    accountTop: { display: "flex", alignItems: "center", gap: 12, marginBottom: 17 },
    bankIcon: { width: 42, height: 42, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 12, background: "#ffedd5", color: "#c2410c", fontSize: 20 },
    holder: { margin: 0, fontSize: 14, fontWeight: 700, color: "#1f2937", overflowWrap: "anywhere" },
    small: { margin: "4px 0 0", color: "#6b7280", fontSize: 12 },
    accountMeta: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 13, borderTop: "1px solid #e5e7eb" },
    metaLabel: { margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#9ca3af" },
    metaValue: { margin: "5px 0 0", fontSize: 13, fontWeight: 700, color: "#374151", overflowWrap: "anywhere" },
    empty: { textAlign: "center", border: "1px dashed #d1d5db", borderRadius: 14, padding: "30px 18px", background: "#fafafa" },
    status: { margin: "14px 0 0", padding: "11px 13px", borderRadius: 10, fontSize: 13, lineHeight: 1.5, background: isError ? "#fef2f2" : "#f0fdf4", color: isError ? "#b91c1c" : "#166534", border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}` },
    hint: { margin: "13px 0 0", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 },
  };

  async function loadAccounts() {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/v1/wallet/bank-accounts"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load bank accounts.");
      setAccounts(data.bankAccounts || []);
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "Could not load bank accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAccounts(); }, [token]);

  async function addAccount(event) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setSaving(true);
    try {
      const response = await fetch(apiUrl("/api/v1/wallet/bank-accounts"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          holderName: holderName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not register bank account.");
      setMessage(data.message || "Bank account registered successfully.");
      setHolderName(""); setAccountNumber(""); setIfsc("");
      await loadAccounts();
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "Could not register bank account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={styles.heroIcon} aria-hidden="true">⌂</div>
          <div>
            <h2 style={styles.heroTitle}>Bank accounts</h2>
            <p style={styles.subtitle}>Manage your saved accounts for future withdrawal requests.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 999, background: "#fff", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12, fontWeight: 700 }}>
          <span aria-hidden="true">✓</span> Private account details
        </div>
      </header>

      <div className="bank-account-layout" style={styles.layout}>
        <div style={styles.panel}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <div style={{ ...styles.bankIcon, width: 38, height: 38, fontSize: 18 }}>＋</div>
            <div>
              <h3 style={styles.panelTitle}>Add a bank account</h3>
              <p style={styles.panelText}>Enter the details exactly as registered with your bank.</p>
            </div>
          </div>
          <form onSubmit={addAccount}>
            <label style={styles.label}>Account holder name
              <input style={styles.input} value={holderName} onChange={e => setHolderName(e.target.value)} minLength={2} maxLength={60} required autoComplete="name" placeholder="Name as per bank records" />
            </label>
            <label style={styles.label}>Account number
              <input style={styles.input} value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[0-9]{9,18}" minLength={9} maxLength={18} required autoComplete="off" placeholder="9–18 digit account number" />
            </label>
            <label style={styles.label}>IFSC code
              <input style={{ ...styles.input, textTransform: "uppercase" }} value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} pattern="[A-Z]{4}0[A-Z0-9]{6}" maxLength={11} required autoComplete="off" placeholder="e.g. HDFC0001234" />
            </label>
            <button style={styles.primary} type="submit" disabled={saving}>{saving ? "Saving account…" : "＋  Save bank account"}</button>
          </form>
          {message && <p style={styles.status} role="status">{message}</p>}
          <p style={styles.hint}>Your account number is masked in the saved-account list. Never share your banking credentials or OTP.</p>
        </div>

        <div style={styles.panel}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <h3 style={styles.panelTitle}>Saved accounts <span style={{ color: "#9ca3af", fontWeight: 500 }}>({accounts.length})</span></h3>
              <p style={{ ...styles.panelText, marginBottom: 0 }}>Choose from these accounts when preparing a withdrawal.</p>
            </div>
            <button style={styles.secondary} type="button" onClick={loadAccounts} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
          </div>
          {loading ? (
            <div style={styles.empty}><p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>Loading your saved accounts…</p></div>
          ) : accounts.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ ...styles.bankIcon, width: 50, height: 50, margin: "0 auto 12px", fontSize: 23 }}>⌂</div>
              <p style={{ margin: "0 0 6px", color: "#374151", fontSize: 14, fontWeight: 700 }}>No bank accounts yet</p>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>Add your first account using the form. Saved account numbers will be masked here.</p>
            </div>
          ) : (
            <div style={styles.accountList}>
              {accounts.map(account => (
                <article key={account.id} style={styles.account}>
                  <div style={styles.accountTop}>
                    <div style={styles.bankIcon} aria-hidden="true">▤</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={styles.holder}>{account.holderName}</p>
                      <p style={styles.small}>Saved bank account</p>
                    </div>
                    <span style={{ padding: "5px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>SAVED</span>
                  </div>
                  <div style={styles.accountMeta}>
                    <div><p style={styles.metaLabel}>Account number</p><p style={styles.metaValue}>{account.accountNumber}</p></div>
                    <div><p style={styles.metaLabel}>IFSC code</p><p style={styles.metaValue}>{account.ifsc}</p></div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p style={styles.hint}>For your security, full account numbers are not shown after saving.</p>
        </div>
      </div>
      <style>{`@media (max-width: 820px) { .bank-account-layout { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}


function WithdrawPage({ token, onNavigate }) {
  const [accounts, setAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [hasPaymentPin, setHasPaymentPin] = useState(null);
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [showPinConfirmation, setShowPinConfirmation] = useState(false);

  const [accountPassword, setAccountPassword] = useState("");
  const [newPaymentPin, setNewPaymentPin] = useState("");
  const [confirmPaymentPin, setConfirmPaymentPin] = useState("");
  const [paymentPin, setPaymentPin] = useState("");

  const [creatingPin, setCreatingPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rupees = Number(amount);

  const validAmount =
    Number.isInteger(rupees) &&
    rupees >= 100 &&
    rupees <= 25000;

  const selectedAccount = accounts.find(
    (account) => account.id === bankAccountId
  );

  // Load saved bank accounts.
  useEffect(() => {
    let cancelled = false;

    async function loadBankAccounts() {
      try {
        const response = await fetch(
          apiUrl("/api/v1/wallet/bank-accounts"),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not load bank accounts."
          );
        }

        if (!cancelled) {
          const list = data.bankAccounts || [];

          setAccounts(list);

          setBankAccountId((current) =>
            list.some((account) => account.id === current)
              ? current
              : list[0]?.id || ""
          );
        }
      } catch (error) {
        if (!cancelled) {
          setIsError(true);
          setMessage(
            error.message || "Could not load bank accounts."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBankAccounts();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Check whether the logged-in user has created a Payment PIN.
  useEffect(() => {
    let cancelled = false;

    async function checkPaymentPin() {
      try {
        const response = await fetch(
          apiUrl("/api/v1/user/me"),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not check Payment PIN status."
          );
        }

        if (!cancelled) {
          setHasPaymentPin(
            Boolean(data.user?.hasPaymentPin)
          );
        }
      } catch (error) {
        if (!cancelled) {
          setHasPaymentPin(null);
          setIsError(true);
          setMessage(
            error.message || "Could not check Payment PIN status."
          );
        }
      }
    }

    checkPaymentPin();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Create a Payment PIN using the existing backend endpoint.
  async function createPaymentPin(event) {
    event.preventDefault();

    if (creatingPin) return;

    if (!accountPassword) {
      setIsError(true);
      setMessage("Enter your account password.");
      return;
    }

    if (!/^\d{4,6}$/.test(newPaymentPin)) {
      setIsError(true);
      setMessage("Enter a PIN containing 4 to 6 digits.");
      return;
    }

    if (newPaymentPin !== confirmPaymentPin) {
      setIsError(true);
      setMessage("The Payment PINs do not match.");
      return;
    }

    setCreatingPin(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch(
        apiUrl("/api/v1/user/payment-pin"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: accountPassword,
            pin: newPaymentPin,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // The PIN may have been created elsewhere.
          setHasPaymentPin(true);
        }

        throw new Error(
          data.error || "Could not create your Payment PIN."
        );
      }

      setHasPaymentPin(true);
      setShowCreatePin(false);
      setShowPinConfirmation(true);

      setAccountPassword("");
      setNewPaymentPin("");
      setConfirmPaymentPin("");
      setPaymentPin("");

      setIsError(false);
      setMessage(
        "Payment PIN created successfully. Enter it to continue."
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error.message || "Could not create your Payment PIN."
      );
    } finally {
      setCreatingPin(false);
    }
  }

  // Submit the withdrawal request.
  async function requestWithdrawal(event) {
    event?.preventDefault();

    if (submitting) return;

    if (!selectedAccount || !validAmount) {
      setIsError(true);
      setMessage(
        "Select a bank account and enter an amount between ₹100 and ₹25,000."
      );
      return;
    }

    if (!/^\d{4,6}$/.test(paymentPin)) {
      setIsError(true);
      setMessage("Enter your 4–6 digit payment PIN.");
      return;
    }

    setSubmitting(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch(
        apiUrl("/api/v1/wallet/withdraw"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            bankAccountId,
            amount: Math.round(rupees * 100),
            pin: paymentPin,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Withdrawal request failed (${response.status}).`
        );
      }

      setIsError(false);
      setMessage(
        `Withdrawal request accepted. Reference: ${
          data.withdrawal?.reference || "Pending"
        }. Check Withdrawal History for updates.`
      );

      setShowPinConfirmation(false);
      setPaymentPin("");
    } catch (error) {
      setIsError(true);
      setMessage(
        error.message || "Could not submit the withdrawal request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Decide which PIN screen to show.
  function continueToPin() {
    setMessage("");
    setIsError(false);

    if (hasPaymentPin === null) {
      setIsError(true);
      setMessage(
        "Payment PIN status is unavailable. Please refresh and try again."
      );
      return;
    }

    setPaymentPin("");

    if (hasPaymentPin) {
      setShowPinConfirmation(true);
    } else {
      setShowCreatePin(true);
    }
  }

  return (
    <section className="content-card action-card withdraw-page">
      <div className="withdraw-hero">
        <div className="withdraw-hero-icon">
          <span aria-hidden="true">↗</span>
        </div>

        <div>
          <p className="withdraw-eyebrow">WALLET SERVICES</p>
          <h2>Withdraw money</h2>
          <p>
            Transfer funds from your wallet to your saved bank account.
          </p>
        </div>
      </div>

      <div className="withdraw-content">
        <div className="withdraw-main">
          {/* Step 1: Select bank account */}
          <div className="withdraw-panel">
            <div className="withdraw-panel-heading">
              <div>
                <span className="withdraw-step">01</span>
                <h3>Choose bank account</h3>
              </div>
              <span className="withdraw-heading-icon" aria-hidden="true">
                ▤
              </span>
            </div>

            {loading ? (
              <p className="form-help">Loading bank accounts...</p>
            ) : accounts.length === 0 ? (
              <div className="withdraw-empty-state">
                <div className="withdraw-empty-icon" aria-hidden="true">
                  ▤
                </div>
                <h4>No bank accounts linked</h4>
                <p>
                  Link a bank account before requesting a withdrawal.
                </p>
                <button
                  type="button"
                  className="withdraw-link-account-btn"
                  onClick={() => onNavigate?.("bank-accounts")}
                >
                  + Link Bank Account
                </button>
              </div>
            ) : (
              <>
                <label className="withdraw-label" htmlFor="withdraw-bank">
                  Saved bank account
                </label>

                <select
                  id="withdraw-bank"
                  className="withdraw-input"
                  value={bankAccountId}
                  onChange={(event) =>
                    setBankAccountId(event.target.value)
                  }
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.holderName} — {account.accountNumber} (
                      {account.ifsc})
                    </option>
                  ))}
                </select>

                {selectedAccount && (
                  <div className="withdraw-bank-card">
                    <div className="withdraw-bank-symbol" aria-hidden="true">
                      ▤
                    </div>
                    <div className="withdraw-bank-info">
                      <strong>{selectedAccount.holderName}</strong>
                      <span>
                        Account ending in{" "}
                        {String(selectedAccount.accountNumber).slice(-4)}
                      </span>
                      <span>{selectedAccount.ifsc}</span>
                    </div>
                    <span className="withdraw-verified">Saved</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Step 2: Enter withdrawal amount */}
          <div className="withdraw-panel">
            <div className="withdraw-panel-heading">
              <div>
                <span className="withdraw-step">02</span>
                <h3>Enter withdrawal amount</h3>
              </div>
              <span className="withdraw-heading-icon" aria-hidden="true">
                ₹
              </span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                continueToPin();
              }}
            >
              <label className="withdraw-label" htmlFor="withdraw-amount">
                Amount in INR
              </label>

              <div className="withdraw-amount-input">
                <span aria-hidden="true">₹</span>
                <input
                  id="withdraw-amount"
                  type="number"
                  min="100"
                  max="25000"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  disabled={loading || accounts.length === 0}
                />
                <span className="withdraw-currency">INR</span>
              </div>

              <div className="withdraw-amount-range">
                <span>Minimum ₹100</span>
                <span>Maximum ₹25,000</span>
              </div>

              <div className="withdraw-processing-note">
                <span aria-hidden="true">ⓘ</span>
                <p>
                  An accepted request does not confirm that money has
                  reached your bank account.
                </p>
              </div>

              <button
                className="primary-button withdraw-submit"
                type="submit"
                disabled={
                  loading ||
                  accounts.length === 0 ||
                  !selectedAccount ||
                  !validAmount ||
                  submitting ||
                  hasPaymentPin === null
                }
              >
                Continue
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="withdraw-sidebar">
          <div className="withdraw-summary-card">
            <span className="withdraw-summary-icon" aria-hidden="true">
              ✓
            </span>
            <h3>Secure withdrawal</h3>
            <p>
              Verify your saved bank account and Payment PIN before
              submitting a withdrawal request.
            </p>
            <div className="withdraw-summary-divider" />
            <div className="withdraw-summary-row">
              <span>Minimum amount</span>
              <strong>₹100</strong>
            </div>
            <div className="withdraw-summary-row">
              <span>Maximum amount</span>
              <strong>₹25,000</strong>
            </div>
          </div>

          <div className="withdraw-help-card">
            <strong>Before you withdraw</strong>
            <p>
              Check your saved bank details and available wallet balance.
              Track requests in Withdrawal History.
            </p>
          </div>
        </aside>
      </div>

      {/* Status and error messages */}
      {message && (
        <p
          className={isError ? "form-help error-text" : "form-help"}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}

      {/* Create Payment PIN modal */}
      {showCreatePin && (
        <div className="withdraw-modal-overlay">
          <div
            className="withdraw-pin-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-payment-pin-title"
          >
            <h3 id="create-payment-pin-title">Create Payment PIN</h3>
            <p>
              Set a 4–6 digit PIN to authorize wallet withdrawals.
            </p>

            <form onSubmit={createPaymentPin}>
              <label className="withdraw-label" htmlFor="pin-account-password">
                Account password
              </label>
              <input
                id="pin-account-password"
                className="withdraw-input"
                type="password"
                autoComplete="current-password"
                value={accountPassword}
                onChange={(event) =>
                  setAccountPassword(event.target.value)
                }
                required
                disabled={creatingPin}
              />

              <label className="withdraw-label" htmlFor="new-payment-pin">
                New Payment PIN
              </label>
              <input
                id="new-payment-pin"
                className="withdraw-input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={newPaymentPin}
                onChange={(event) =>
                  setNewPaymentPin(
                    event.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder="Enter 4–6 digits"
                required
                disabled={creatingPin}
              />

              <label
                className="withdraw-label"
                htmlFor="confirm-new-payment-pin"
              >
                Confirm Payment PIN
              </label>
              <input
                id="confirm-new-payment-pin"
                className="withdraw-input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirmPaymentPin}
                onChange={(event) =>
                  setConfirmPaymentPin(
                    event.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder="Re-enter your PIN"
                required
                disabled={creatingPin}
              />

              <button
                type="submit"
                className="primary-button"
                disabled={
                  creatingPin ||
                  !accountPassword ||
                  !/^\d{4,6}$/.test(newPaymentPin) ||
                  newPaymentPin !== confirmPaymentPin
                }
              >
                {creatingPin ? "Creating PIN..." : "Create Payment PIN"}
              </button>

              <button
                type="button"
                className="light-button"
                disabled={creatingPin}
                onClick={() => {
                  setShowCreatePin(false);
                  setAccountPassword("");
                  setNewPaymentPin("");
                  setConfirmPaymentPin("");
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm existing or newly created Payment PIN */}
      {showPinConfirmation && (
        <div
          className="withdraw-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setShowPinConfirmation(false);
              setPaymentPin("");
            }
          }}
        >
          <div
            className="withdraw-pin-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-pin-title"
          >
            <h3 id="withdraw-pin-title">Confirm withdrawal</h3>

            <p>
              Amount: ₹{rupees.toLocaleString("en-IN")}
            </p>
            <p>
              Bank account ending in{" "}
              {selectedAccount
                ? String(selectedAccount.accountNumber).slice(-4)
                : "—"}
            </p>

            <form onSubmit={requestWithdrawal}>
              <label
                className="withdraw-label"
                htmlFor="withdraw-payment-pin"
              >
                Enter your Payment PIN
              </label>
              <input
                id="withdraw-payment-pin"
                className="withdraw-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={paymentPin}
                onChange={(event) =>
                  setPaymentPin(
                    event.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder="Enter 4–6 digit PIN"
                required
                disabled={submitting}
              />

              <button
                type="submit"
                className="primary-button"
                disabled={
                  submitting || !/^\d{4,6}$/.test(paymentPin)
                }
              >
                {submitting ? "Submitting..." : "Confirm withdrawal"}
              </button>

              <button
                type="button"
                className="light-button"
                disabled={submitting}
                onClick={() => {
                  setShowPinConfirmation(false);
                  setPaymentPin("");
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="withdraw-footer">
        <span>Secure wallet operations</span>
        <button
          className="light-button"
          type="button"
          onClick={() => window.location.reload()}
        >
          ↻ Refresh page
        </button>
      </div>
    </section>
  );
}


function WithdrawalHistoryPage({ token }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadHistory() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(apiUrl("/api/v1/wallet/withdraw"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load withdrawal history.");
      setWithdrawals(data.withdrawals || []);
    } catch (error) {
      setMessage(error.message || "Could not load withdrawal history.");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadHistory(); }, [token]);
  return (
    <section className="content-card">
      <div className="section-heading"><div><h2>Withdrawal History</h2><p>Recent withdrawal requests and their current statuses.</p></div><button className="light-button" type="button" onClick={loadHistory} disabled={loading}>Refresh</button></div>
      {loading ? <p className="form-help">Loading withdrawal history...</p> : message ? <p className="form-help error-text" role="alert">{message}</p> : withdrawals.length === 0 ? <p className="form-help">No withdrawal requests found.</p> : (
        <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Bank reference</th><th>Date</th></tr></thead><tbody>
          {withdrawals.map(item => <tr key={item._id || item.reference}><td>{item.reference || "—"}</td><td>₹{(Number(item.amount || 0) / 100).toFixed(2)}</td><td>{item.status || "Unknown"}</td><td>{item.bankRef || "—"}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "—"}</td></tr>)}
        </tbody></table></div>
      )}
      <p className="form-help">PENDING means accepted for processing, not confirmed as paid to the bank.</p>
    </section>
  );
}


export default App;