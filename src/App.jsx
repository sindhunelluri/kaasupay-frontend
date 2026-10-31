import React,{ Fragment, useEffect, useRef, useState } from "react";
import "./App.css";
import { apiUrl } from "./api";
import SecurityPinPage from "./SecurityPinPage";
import { apiErrorMessage } from "./apiErrors";
import MoneyRequestsPage from "./MoneyRequestsPage";
import RecentContacts, { getRecentContacts } from "./RecentContacts.jsx";


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
  
const [theme, setTheme] = useState(() => {
  const saved = localStorage.getItem("kaasupay-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
});


useEffect(() => {
  // Dark mode only applies once the user is signed in (the landing page stays light).
  document.documentElement.dataset.theme = token ? theme : "light";
  try {
    localStorage.setItem("kaasupay-theme", theme);
  } catch {
    // storage blocked: the theme still works for this visit
  }
}, [theme, token]);

  const [authMode, setAuthMode] = useState("signin");
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);

  // Daily send limit (shown in the top bar) and "log out of all devices"
  const [limits, setLimits] = useState(null);
  const [limitsStatus, setLimitsStatus] = useState("idle"); // idle | loading | ready | error
  const [limitsError, setLimitsError] = useState("");
  const [showLimit, setShowLimit] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
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
    { name: "Dashboard", icon: "dashboard" },
    { name: "Add Money", icon: "plus" },
    { name: "Transfer", icon: "transfer" },
    { name: "Bank Accounts", icon: "bank" },
    { name: "Withdraw", icon: "withdraw" },
    { name: "Money Requests", icon: "swap" },
    { name: "Transactions", icon: "swap" },
    { name: "Security & PIN", icon: "shield" }
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

  async function loadLimits() {
    if (!token) return;
    setLimitsStatus((current) => (current === "ready" ? current : "loading"));

    try {
      const response = await fetch(apiUrl("/api/v1/wallet/limits"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Limit service not found. Restart your backend."
            : data.error || `Could not load limit (${response.status}).`
        );
      }

      setLimits(data);
      setLimitsStatus("ready");
      setLimitsError("");
    } catch (error) {
      setLimitsStatus("error");
      setLimitsError(error.message || "Could not reach the server.");
    }
  }

  async function logoutAllDevices() {
    if (
      !window.confirm(
        "Sign out of KaasuPay on every device, including this one?"
      )
    ) {
      return;
    }

    setLoggingOutAll(true);

    try {
      const response = await fetch(apiUrl("/api/v1/user/logout-all"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Could not sign out (${response.status}).`);
      }

      logout();
    } catch (error) {
      window.alert(error.message);
    } finally {
      setLoggingOutAll(false);
    }
  }

  // Load the limit after sign in, and whenever wallet data is refreshed.
  useEffect(() => {
    if (token) loadLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // After a password change the server sends a fresh token for THIS device.
  function updateToken(newToken) {
    sessionStorage.setItem("kaasupay_token", newToken);
    setToken(newToken);
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

  loadLimits();

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
          <Icon name="arrow-left" /> Back to Overview
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
  const recentContacts = getRecentContacts(transactions, txDirection);

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
            <Icon name="close" />
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
              <span className="nav-icon"><Icon name={item.icon} /></span>
              {item.name}
              {item.name === "Transactions" && (
                <span className="nav-arrow"><Icon name="chevron-right" /></span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          

          
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
      <Icon name={showProfileMenu ? "chevron-up" : "chevron-down"} />
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
        <Icon name="logout" />
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
              <Icon name="menu" />
            </button>
            <div>
              <p className="breadcrumb">Workspace / {activePage}</p>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-chip theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
              </button>
            <div className="limit-wrap">
              <button
                type="button"
                className={`topbar-chip limit-chip ${limitsStatus === "error" ? "is-error" : ""}`}
                onClick={() => {
                  if (limitsStatus === "error") loadLimits();
                  setShowLimit((open) => !open);
                }}
                aria-expanded={showLimit}
                title="Daily send limit"
              >
                <span className="chip-icon" aria-hidden="true">◔</span>
                <span className="chip-text">
                  {limitsStatus === "ready" && limits
                    ? `₹${(limits.leftToday / 100).toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })} left today`
                    : limitsStatus === "error"
                      ? "Limit unavailable"
                      : "Loading limit…"}
                </span>
              </button>

              {showLimit && (
                <>
                  <button
                    type="button"
                    className="limit-backdrop"
                    aria-label="Close daily limit"
                    onClick={() => setShowLimit(false)}
                  />
                  <div className="limit-pop" role="dialog" aria-label="Daily send limit">
                    <h4>Daily send limit</h4>
                    {limitsStatus === "ready" && limits ? (
                      <>
                        <div className="sec-meter">
                          <span
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((limits.usedToday / limits.dailyLimit) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="sec-limit-row">
                          <span>
                            Used ₹{(limits.usedToday / 100).toLocaleString("en-IN")} of ₹
                            {(limits.dailyLimit / 100).toLocaleString("en-IN")}
                          </span>
                          <strong>
                            ₹{(limits.leftToday / 100).toLocaleString("en-IN")} left
                          </strong>
                        </div>
                        <p className="sec-hint">
                          Sends and bank withdrawals count together. Resets at midnight
                          India time.
                        </p>
                      </>
                    ) : limitsStatus === "error" ? (
                      <>
                        <p className="sec-note bad">{limitsError}</p>
                        <button type="button" className="sec-retry" onClick={loadLimits}>
                          Try again
                        </button>
                      </>
                    ) : (
                      <p className="sec-hint">Loading your limit…</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              className="topbar-chip logout-chip"
              onClick={logoutAllDevices}
              disabled={loggingOutAll}
              title="Sign out on every device"
            >
              <span className="chip-icon" aria-hidden="true">⎋</span>
              <span className="chip-text">
                {loggingOutAll ? "Signing out…" : "Log out of all devices"}
              </span>
            </button>

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
                <h2>Welcome back, {user?.firstName || "User"}</h2>
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
                    <Icon name={showBalance ? "eye" : "eye-off"} />
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
                    <Icon name="transfer" /> Transfer
                  </button>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Total top-ups</span>
                  <span className="stat-icon green"><Icon name="withdraw" /></span>
                </div>
                <h2>₹{totalTopups.toFixed(2)}</h2>
                <p>From the currently loaded records</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Transactions</span>
                  <span className="stat-icon purple"><Icon name="swap" /></span>
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
                  <span className="quick-arrow"><Icon name="chevron-right" /></span>
                </button>

                <button onClick={() => navigate("Transfer")}>
                  <span className="quick-icon blue"><Icon name="transfer" /></span>
                  <span>
                    <strong>Transfer money</strong>
                    <small>Send to another user</small>
                  </span>
                  <span className="quick-arrow"><Icon name="chevron-right" /></span>
                </button>

                <button onClick={() => navigate("Transactions")}>
                  <span className="quick-icon purple"><Icon name="swap" /></span>
                  <span>
                    <strong>Transaction history</strong>
                    <small>Review wallet activity</small>
                  </span>
                  <span className="quick-arrow"><Icon name="chevron-right" /></span>
                </button>

                <button onClick={() => navigate("Bank Accounts")}>
                  <span className="quick-icon blue"><Icon name="bank" /></span>
                  <span>
                    <strong>Bank accounts</strong>
                    <small>Manage saved bank details</small>
                  </span>
                  <span className="quick-arrow"><Icon name="chevron-right" /></span>
                </button>

                <button onClick={() => navigate("Withdraw")}>
                  <span className="quick-icon orange"><Icon name="withdraw" /></span>
                  <span>
                    <strong>Withdraw money</strong>
                    <small>Review withdrawal requirements</small>
                  </span>
                  <span className="quick-arrow"><Icon name="chevron-right" /></span>
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
    contacts={recentContacts}
  />
)}

        {activePage === "Bank Accounts" && (
  <BankAccountsPage token={token} />
)}

{activePage === "Withdraw" && (
  <WithdrawPage
    token={token}
    onNavigate={navigate}
    onSuccess={refreshWalletData}
    balance={walletBalance}
    showBalance={showBalance}
    setShowBalance={setShowBalance}
  />
)}
{activePage === "Money Requests" && (
  <MoneyRequestsPage
    token={token}
    onSuccess={refreshWalletData}
    contacts={recentContacts}
  />
)}

        {activePage === "Transactions" && (
          <section className="content-card transactions-page">
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

        {activePage === "Security & PIN" && (
  <SecurityPinPage
    token={token}
    hasPaymentPin={Boolean(user?.hasPaymentPin)}
    onTokenChange={updateToken}
    onPinChanged={() =>
      setUser((current) =>
        current ? { ...current, hasPaymentPin: true } : current
      )
    }
  />
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
    <span><Icon name={mobileMenuOpen ? "close" : "menu"} /></span>
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
              <span><Icon name="check" /></span> Wallet activity in one place
              <span><Icon name="check" /></span> Transaction history
            </div>
          </div>

          <div className="landing-wallet-visual">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />

            <div className="landing-wallet-card">
              <div className="landing-wallet-top">
                <span className="landing-logo">K</span>
                <span>KAASUPAY WALLET</span>
                <span className="landing-card-dot" aria-hidden="true" />
              </div>

              <p>Digital wallet</p>
              <h2>Money management, simplified.</h2>

              <div className="landing-card-bottom">
                <span>Secure access</span>
                <span>•••• 2026</span>
              </div>
            </div>

            <div className="landing-floating-card landing-float-top">
              <span className="landing-float-icon"><Icon name="transfer" /></span>
              <div>
                <strong>Easy transfers</strong>
                <small>Send to another user</small>
              </div>
            </div>

            <div className="landing-floating-card landing-float-bottom">
              <span className="landing-float-icon"><Icon name="swap" /></span>
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
              <span className="landing-feature-icon"><Icon name="plus" /></span>
              <h3>Add Money</h3>
              <p>Create a top-up order and use available payment options.</p>
            </article>

            <article className="landing-feature">
              <span className="landing-feature-icon"><Icon name="transfer" /></span>
              <h3>Transfer Funds</h3>
              <p>Send money to another KaasuPay user.</p>
            </article>

            <article className="landing-feature">
              <span className="landing-feature-icon"><Icon name="swap" /></span>
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
        <span className="landing-step-icon"><Icon name="user" /></span>
      </div>

      <h3>Select Recipient & Amount</h3>
      <p>
        Choose the intended recipient and enter the amount
        you want to transfer.
      </p>

      <div className="landing-step-details">
        <div><Icon name="check" /> Select the recipient</div>
        <div><Icon name="check" /> Enter the transfer amount</div>
        <div><Icon name="check" /> Review the details</div>
      </div>

      <span className="landing-step-link">
        Choose recipient <span>→</span>
      </span>
    </article>

    <article className="landing-step-card">
      <div className="landing-step-top">
        <span className="landing-step-number">02</span>
        <span className="landing-step-icon"><Icon name="lock" /></span>
      </div>

      <h3>Choose & Authorize</h3>
      <p>
        Review the available transaction options and
        authorize the transfer using the required verification.
      </p>

      <div className="landing-step-details">
        <div><Icon name="check" /> Review transaction options</div>
        <div><Icon name="check" /> Verify the transfer details</div>
        <div><Icon name="check" /> Authorize when prompted</div>
      </div>

      <span className="landing-step-link">
        Verify details <span>→</span>
      </span>
    </article>

    <article className="landing-step-card">
      <div className="landing-step-top">
        <span className="landing-step-number">03</span>
        <span className="landing-step-icon"><Icon name="receipt" /></span>
      </div>

      <h3>Transfer & Receipt</h3>
      <p>
        Check the transfer result and view the transaction
        reference when the server returns it.
      </p>

      <div className="landing-step-details">
        <div><Icon name="check" /> Check the transaction status</div>
        <div><Icon name="check" /> Review the transfer record</div>
        <div><Icon name="check" /> Keep the receipt details</div>
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
      <div className="integrity-icon"><Icon name="shield" /></div>
      <span className="integrity-label">01 · TRANSACTION CONTROL</span>
      <h3>Daily Transfer Limit</h3>
      <p>
        Manage daily transfer limits to help control
        the amount sent from your wallet.
      </p>
    </article>

    <article className="integrity-card">
      <div className="integrity-icon"><Icon name="lock" /></div>
      <span className="integrity-label">02 · AUTHORIZATION</span>
      <h3>Payment PIN</h3>
      <p>
        Add a verification step to help authorize
        wallet transactions securely.
      </p>
    </article>

    <article className="integrity-card">
      <div className="integrity-icon"><Icon name="bank" /></div>
      <span className="integrity-label">03 · DATA PRIVACY</span>
      <h3>Encrypted Bank Details</h3>
      <p>
        Protect sensitive banking information through
        appropriate encryption and secure data handling.
      </p>
    </article>

    <article className="integrity-card">
      <div className="integrity-icon"><Icon name="logout" /></div>
      <span className="integrity-label">04 · SESSION CONTROL</span>
      <h3>All-Device Sign Out</h3>
      <p>
        Lost your phone or used a public computer? Sign out of
        every active device at once from your settings.
      </p>
    </article>

  </div>
</section>


{/* ---------- WHAT IF SOMETHING GOES WRONG ---------- */}
        <section className="kp-safety" id="safety">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">YOUR SAFETY NET</span>
            <h2>What if something goes wrong?</h2>
            <p>
              Good money apps stay calm when things break. Here is what
              KaasuPay does in six messy moments.
            </p>
          </div>

          <div className="kp-cases">
            {[
              ["user", "A friend borrows your unlocked phone", "Sending or withdrawing needs your payment PIN. Three wrong tries lock it for 15 minutes."],
              ["swap", "You tap Send twice", "Both taps carry the same request key, so the money moves only once."],
              ["refresh", "Your internet drops halfway", "A payment finishes for both wallets or not at all. There is no half-sent money."],
              ["bank", "The bank is slow or down", "Your withdrawal is retried automatically. If the bank finally refuses, the money comes back to your wallet."],
              ["logout", "You lose your phone", "Tap Log out of all devices in the top bar and every old session stops working."],
              ["receipt", "You want to know what happened", "Your history shows every top-up, payment, withdrawal and refund."],
            ].map(([icon, ifText, thenText]) => (
              <article className="kp-case" key={ifText}>
                <div className="kp-case-if">
                  <span className="kp-case-icon"><Icon name={icon} /></span>
                  <div>
                    <small>If</small>
                    <h3>{ifText}</h3>
                  </div>
                </div>
                <span className="kp-case-arrow" aria-hidden="true">→</span>
                <div className="kp-case-then">
                  <small>Then</small>
                  <p>{thenText}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

{/* ---------- FAQ ---------- */}
        <section className="kp-faq" id="faq">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">QUICK ANSWERS</span>
            <h2>Things people ask first.</h2>
          </div>

          <div className="kp-faq-list">
            <details>
              <summary>Is my full bank account number shown anywhere?</summary>
              <p>
                No. Once you save an account, the app shows only the last four
                digits.
              </p>
            </details>

            <details>
              <summary>Do I need my PIN to add money?</summary>
              <p>
                No. Only sending and withdrawing need it, because those are the
                two ways money can leave your wallet.
              </p>
            </details>

            <details>
              <summary>How long does a withdrawal take?</summary>
              <p>
                It is accepted straight away and then paid in the background.
                You will see Processing until the bank confirms, and a failed
                payout is returned to your wallet.
              </p>
            </details>

            <details>
              <summary>If a withdrawal fails, do I get my daily limit back?</summary>
              <p>
                Your money returns to the wallet, but the day's limit is not
                given back. That keeps the daily cap honest.
              </p>
            </details>

            <details>
              <summary>Can I change my PIN?</summary>
              <p>
                Yes. Open Security &amp; PIN, enter your account password and
                choose a new 4 or 6 digit PIN.
              </p>
            </details>
          </div>
        </section>

        {/* ---------- FINAL CALL TO ACTION ---------- */}
        <section className="kp-final">
          <div className="kp-final-card">
            <h2>Your coins are waiting.</h2>
            <p>
              Create an account, set your PIN and make your first top-up in a
              few minutes.
            </p>
            <div className="landing-hero-actions kp-final-actions">
              <button className="landing-cta" onClick={onCreateAccount}>
                Create my account →
              </button>
              <button className="kp-final-ghost" onClick={onSignIn}>
                Sign in
              </button>
            </div>
          </div>
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
                <span><Icon name="card" /></span>
              </div>
              <div className="add-money-method-copy">
                <strong>Razorpay Checkout</strong>
                <small>Cards and other available methods</small>
              </div>
              <span className="add-money-method-check"><Icon name="check" /></span>
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
              {!loading && <Icon name="arrow-right" />}
            </button>

            <p className="add-money-security">
              <Icon name="lock" />
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
          <div className="add-money-info-icon"><Icon name="check" /></div>
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
              <Icon name="close" />
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
              <Icon name={mode === "signin" ? "user" : "user-plus"} />
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
            <Icon name="lock" />
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
  contacts = [],
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
        throw new Error(apiErrorMessage(response, data, "Transfer failed"));
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
          <Icon name="transfer" />
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
            <Icon name={showBalance ? "eye" : "eye-off"} />
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
            <Icon name="swap" />
          </div>
        </div>

        <form
          className="transfer-form"
          onSubmit={(event) => {
            event.preventDefault();
            openPinModal();
          }}
        >
          <RecentContacts contacts={contacts} onPick={setTo} disabled={loading} />
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
            Send Money <Icon name="transfer" />
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
              <Icon name="lock" />
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



/* ==========================================================================
   Transaction history: card layout, grouped by day, with search + filters.
   Paste this block in place of your existing `function TransactionTable`.
   It uses only things App.jsx already has: Fragment, useState and <Icon />.
   ========================================================================== */

const TX_TYPE_CHIPS = [
  { key: "ALL", label: "All" },
  { key: "SENT", label: "Sent" },
  { key: "RECEIVED", label: "Received" },
  { key: "TOPUP", label: "Added" },
  { key: "WITHDRAWAL", label: "Withdrawals" },
];

const TX_STATUS_OPTIONS = [
  { key: "ALL", label: "Any status" },
  { key: "success", label: "Success" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

const TX_RANGE_OPTIONS = [
  { key: "ALL", label: "All time" },
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "7 days" },
  { key: "30D", label: "30 days" },
  { key: "CUSTOM", label: "Custom" },
];

const TX_SORT_OPTIONS = [
  { key: "NEWEST", label: "Newest first" },
  { key: "OLDEST", label: "Oldest first" },
  { key: "HIGHEST", label: "Highest amount" },
  { key: "LOWEST", label: "Lowest amount" },
];

function txStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function txFormatAmount(amount) {
  return `₹${(Number(amount || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function txFormatDate(date) {
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txFormatTime(date) {
  if (!date) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txDayLabel(date) {
  const days = Math.round(
    (txStartOfDay(new Date()) - txStartOfDay(date)) / 86400000
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function txPerson(person) {
  if (!person) return "External payment / wallet";

  const name = `${person.firstName || ""} ${person.lastName || ""}`.trim();

  return name
    ? `${name} (@${person.username || "user"})`
    : `@${person.username || "user"}`;
}

function txDirection(item) {
  if (item.type === "TOPUP" || item.type === "DEPOSIT") return "CREDIT";
  if (item.type === "REVERSAL") return "CREDIT";
  if (item.type === "WITHDRAWAL") return "DEBIT";

  if (item.type === "TRANSFER") {
    return item.withWhom?.startsWith("Transfer from") ? "CREDIT" : "DEBIT";
  }

  return item.fromUserId ? "DEBIT" : "CREDIT";
}

function txTitle(item) {
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

function txIconName(item, direction) {
  if (item.type === "TOPUP" || item.type === "DEPOSIT") return "plus";
  if (item.type === "WITHDRAWAL") return "bank";
  if (item.type === "REVERSAL") return "refresh";
  return direction === "CREDIT" ? "withdraw" : "transfer";
}

function txStatusKey(status) {
  switch (String(status || "").toUpperCase()) {
    case "SUCCESS":
    case "PAID":
    case "COMPLETED":
      return "success";
    case "PENDING":
    case "PROCESSING":
    case "NEEDS_REVIEW":
      return "pending";
    case "FAILED":
    case "REJECTED":
    case "CANCELLED":
      return "failed";
    default:
      return "unknown";
  }
}

function txSender(item) {
  if (item.type === "TOPUP" || item.type === "DEPOSIT") return "Payment gateway";
  if (item.type === "REVERSAL") return "Wallet reversal";
  return item.fromUserId ? txPerson(item.fromUserId) : "External source";
}

function txRecipient(item) {
  if (item.type === "WITHDRAWAL") return "Bank account";
  return item.toUserId ? txPerson(item.toUserId) : "External destination";
}

function txMatchesType(entry, key) {
  const { item, direction } = entry;

  if (key === "ALL") return true;
  if (key === "SENT") return item.type === "TRANSFER" && direction === "DEBIT";
  if (key === "RECEIVED") return item.type === "TRANSFER" && direction === "CREDIT";
  if (key === "TOPUP") return ["TOPUP", "DEPOSIT"].includes(item.type);
  if (key === "WITHDRAWAL") return item.type === "WITHDRAWAL";

  return true;
}

function txMatchesRange(entry, range, fromDate, toDate) {
  if (range === "ALL") return true;
  if (!entry.date) return false;

  const time = entry.date.getTime();
  const today = txStartOfDay(new Date());

  if (range === "TODAY") return time >= today.getTime();

  if (range === "7D" || range === "30D") {
    const start = new Date(today);
    start.setDate(start.getDate() - (range === "7D" ? 6 : 29));
    return time >= start.getTime();
  }

  if (range === "CUSTOM") {
    if (fromDate && time < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && time > new Date(`${toDate}T23:59:59.999`).getTime()) return false;
  }

  return true;
}

function TransactionTable({ items = [], compact = false }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [range, setRange] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("NEWEST");
  const [selectedId, setSelectedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [receiptEntry, setReceiptEntry] = useState(null);

  // Prepare every transaction once, including one searchable text string.
  const entries = items.map((item) => {
    const direction = txDirection(item);
    const rawDate = item.createdAt ? new Date(item.createdAt) : null;
    const date = rawDate && !Number.isNaN(rawDate.getTime()) ? rawDate : null;
    const sender = txSender(item);
    const recipient = txRecipient(item);
    const rupees = Number(item.amount || 0) / 100;

    const text = [
      item._id,
      item.type,
      item.status,
      item.note,
      item.withWhom,
      txTitle(item),
      sender,
      recipient,
      String(rupees),
      rupees.toFixed(2),
      txFormatAmount(item.amount),
      txFormatDate(date),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      item,
      direction,
      date,
      sender,
      recipient,
      statusKey: txStatusKey(item.status),
      text,
    };
  });

  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = entries.filter((entry) => {
    if (words.length && !words.every((word) => entry.text.includes(word))) return false;
    if (!txMatchesType(entry, typeFilter)) return false;
    if (statusFilter !== "ALL" && entry.statusKey !== statusFilter) return false;
    if (!txMatchesRange(entry, range, fromDate, toDate)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const timeA = a.date ? a.date.getTime() : 0;
    const timeB = b.date ? b.date.getTime() : 0;

    if (sortBy === "OLDEST") return timeA - timeB;
    if (sortBy === "HIGHEST") return Number(b.item.amount || 0) - Number(a.item.amount || 0);
    if (sortBy === "LOWEST") return Number(a.item.amount || 0) - Number(b.item.amount || 0);
    return timeB - timeA;
  });

  // Group by day when sorted by date; one flat list when sorted by amount.
  const groups = [];

  if (sortBy === "NEWEST" || sortBy === "OLDEST") {
    sorted.forEach((entry) => {
      const key = entry.date
        ? `${entry.date.getFullYear()}-${entry.date.getMonth()}-${entry.date.getDate()}`
        : "unknown";
      const last = groups[groups.length - 1];

      if (last && last.key === key) {
        last.entries.push(entry);
      } else {
        groups.push({
          key,
          label: entry.date ? txDayLabel(entry.date) : "Unknown date",
          entries: [entry],
        });
      }
    });
  } else if (sorted.length > 0) {
    groups.push({
      key: "amount",
      label: sortBy === "HIGHEST" ? "Highest amount first" : "Lowest amount first",
      entries: sorted,
    });
  }

  const activeFilters =
    (words.length ? 1 : 0) +
    (typeFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0) +
    (range !== "ALL" ? 1 : 0);

  function clearAll() {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setRange("ALL");
    setFromDate("");
    setToDate("");
    setSortBy("NEWEST");
  }

  function chooseRange(key) {
    setRange(key);

    if (key !== "CUSTOM") {
      setFromDate("");
      setToDate("");
    }
  }

  function copyId(id) {
    if (!id) return;

    try {
      navigator.clipboard?.writeText(String(id));
    } catch (error) {
      // Clipboard may be unavailable; the ID is still visible to copy by hand.
    }

    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
  }

  return (
    <div className="th-wrap">
      {!compact && (
        <div className="th-filters">
          <div className="th-search">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>

            <input
              type="search"
              aria-label="Search transactions"
              placeholder="Search by name, note, amount, date or ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                className="th-search-clear"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <div className="th-chip-row" role="group" aria-label="Transaction type">
            {TX_TYPE_CHIPS.map((chip) => {
              const count = entries.filter((entry) => txMatchesType(entry, chip.key)).length;

              return (
                <button
                  key={chip.key}
                  type="button"
                  className={typeFilter === chip.key ? "th-chip active" : "th-chip"}
                  aria-pressed={typeFilter === chip.key}
                  onClick={() => setTypeFilter(chip.key)}
                >
                  {chip.label}
                  <em>{count}</em>
                </button>
              );
            })}
          </div>

          <div className="th-filter-line">
            <div className="th-group">
              <span className="th-group-label">Status</span>
              <div className="th-seg" role="group" aria-label="Status">
                {TX_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={statusFilter === option.key ? "active" : ""}
                    aria-pressed={statusFilter === option.key}
                    onClick={() => setStatusFilter(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="th-group">
              <span className="th-group-label">Date</span>
              <div className="th-seg" role="group" aria-label="Date range">
                {TX_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={range === option.key ? "active" : ""}
                    aria-pressed={range === option.key}
                    onClick={() => chooseRange(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="th-group">
              <span className="th-group-label">Sort</span>
              <select
                className="th-select"
                aria-label="Sort transactions"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {TX_SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {range === "CUSTOM" && (
            <div className="th-dates">
              <label>
                From
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
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
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="th-results">
          <span>
            Showing <strong>{filtered.length}</strong> of {items.length} loaded transactions
          </span>

          {(activeFilters > 0 || sortBy !== "NEWEST") && (
            <button type="button" className="th-clear" onClick={clearAll}>
              Clear {activeFilters > 0 ? `${activeFilters} filter${activeFilters > 1 ? "s" : ""}` : "sorting"}
            </button>
          )}
        </div>
      )}

      {groups.map((group) => (
        <Fragment key={group.key}>
          <section className="th-day">
            <h3 className="th-day-head">
              {group.label}
              <span>{group.entries.length}</span>
            </h3>

            <div className="th-day-list">
              {group.entries.map((entry) => {
                const { item, direction, date, sender, recipient, statusKey } = entry;
                const isCredit = direction === "CREDIT";
                const isOpen = selectedId === item._id;
                const statusText = String(item.status || "Unknown").toLowerCase();

                return (
                  <article key={item._id} className={isOpen ? "th-item open" : "th-item"}>
                    <button
                      type="button"
                      className="th-item-main"
                      aria-expanded={isOpen}
                      onClick={() => setSelectedId(isOpen ? null : item._id)}
                    >
                      <span className={isCredit ? "th-icon in" : "th-icon out"}>
                        <Icon name={txIconName(item, direction)} />
                      </span>

                      <span className="th-info">
                        <strong>{txTitle(item)}</strong>
                        <small>
                          {isCredit ? `From ${sender}` : `To ${recipient}`}
                          {date ? ` · ${txFormatTime(date)}` : ""}
                        </small>
                      </span>

                      <span className="th-right">
                        <b className={isCredit ? "in" : ""}>
                          {isCredit ? "+" : "−"}
                          {txFormatAmount(item.amount)}
                        </b>
                        <span className={`th-status th-status-${statusKey}`}>
                          <i />
                          {statusText}
                        </span>
                      </span>

                      <span className="th-chevron">
                        <Icon name={isOpen ? "chevron-up" : "chevron-down"} />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="th-detail">
                        <div className="th-field th-field-wide">
                          <span>Transaction ID</span>
                          <p>
                            <code>{item._id || "—"}</code>
                            {item._id && (
                              <button
                                type="button"
                                className="th-copy"
                                onClick={() => copyId(item._id)}
                              >
                                {copiedId === item._id ? "Copied" : "Copy"}
                              </button>
                            )}
                          </p>
                        </div>

                        <div className="th-field">
                          <span>Type</span>
                          <p>{item.type || "—"}</p>
                        </div>
                        <div className="th-field">
                          <span>Date</span>
                          <p>{txFormatDate(date)}</p>
                        </div>
                        <div className="th-field">
                          <span>Sender</span>
                          <p>{sender}</p>
                        </div>
                        <div className="th-field">
                          <span>Recipient</span>
                          <p>{recipient}</p>
                        </div>
                        <div className="th-field">
                          <span>Amount</span>
                          <p>{txFormatAmount(item.amount)}</p>
                        </div>
                        <div className="th-field">
                          <span>Status</span>
                          <p>{item.status || "Unknown"}</p>
                        </div>
                        <div className="th-field th-field-wide">
                          <span>Note</span>
                          <p>{item.note || "No note provided"}</p>
                        </div>
                        <div className="th-field th-field-wide">
                          <button type="button" className="th-receipt-btn" onClick={() => setReceiptEntry(entry)}>
                            View receipt
                          </button>
                        </div>
                        
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </Fragment>
      ))}

      {groups.length === 0 && (
        <div className="th-empty">
          <span className="th-empty-icon">
            <Icon name="receipt" />
          </span>

          {items.length === 0 ? (
            <>
              <h4>No transactions yet</h4>
              <p>When you add money, send money or withdraw, it will appear here.</p>
            </>
          ) : (
            <>
              <h4>Nothing matches your search</h4>
              <p>Try a different word, or clear the filters to see everything.</p>
              <button type="button" className="light-button" onClick={clearAll}>
                Clear filters
              </button>
            </>
          )}
        </div>
      )}
      {receiptEntry && (
  <TxReceiptModal entry={receiptEntry} onClose={() => setReceiptEntry(null)} />
)}
    </div>
  );
}

/* ---------- Receipt popup (paste ABOVE `function TransactionTable`) ---------- */
function TxReceiptModal({ entry, onClose }) {
  const { item, direction, date, sender, recipient } = entry;
  const isCredit = direction === "CREDIT";
  const [shared, setShared] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = [
    ["Type", item.type || "—"],
    ["Date", txFormatDate(date)],
    ["From", sender],
    ["To", recipient],
    ["Status", item.status || "Unknown"],
    ["Note", item.note || "—"],
    ["Transaction ID", item._id || "—"],
  ];

  const summary = [
    "KaasuPay receipt",
    `${txTitle(item)}: ${txFormatAmount(item.amount)}`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "KaasuPay receipt", text: summary });
        return;
      }
      await navigator.clipboard.writeText(summary);
      setShared("Receipt copied");
    } catch (error) {
      setShared("Could not share");
    }
    setTimeout(() => setShared(""), 1800);
  }

  return (
    <div
      className="tx-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="tx-receipt" role="dialog" aria-modal="true" aria-label="Transaction receipt">
        <button type="button" className="tx-receipt-close no-print" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="tx-receipt-head">
          <span className="tx-receipt-brand">KaasuPay</span>
          <small>Payment receipt</small>
          <h3 className={isCredit ? "in" : ""}>
            {isCredit ? "+" : "−"}
            {txFormatAmount(item.amount)}
          </h3>
          <p>{txTitle(item)}</p>
        </div>

        <dl className="tx-receipt-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="tx-receipt-actions no-print">
          <button type="button" className="light-button" onClick={share}>
            {shared || "Share"}
          </button>
          <button type="button" className="primary-button" onClick={() => window.print()}>
            Download / Print
          </button>
        </div>
      </div>
    </div>
  );
}

/*function TransactionTable({ items = [] }) {
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
                          <Icon name={isCredit ? "withdraw" : "transfer"} />
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
} */


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
          <div style={styles.heroIcon} aria-hidden="true"><Icon name="bank" /></div>
          <div>
            <h2 style={styles.heroTitle}>Bank accounts</h2>
            <p style={styles.subtitle}>Manage your saved accounts for future withdrawal requests.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderRadius: 999, background: "#fff", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12, fontWeight: 700 }}>
          <Icon name="check" /> Private account details
        </div>
      </header>

      <div className="bank-account-layout" style={styles.layout}>
        <div style={styles.panel}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <div style={{ ...styles.bankIcon, width: 38, height: 38, fontSize: 18 }}><Icon name="plus" /></div>
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
            <button style={styles.primary} type="submit" disabled={saving}>{saving ? "Saving account…" : <><Icon name="plus" /> Save bank account</>}</button>
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
            <button style={styles.secondary} type="button" onClick={loadAccounts} disabled={loading}>{loading ? "Loading…" : <><Icon name="refresh" /> Refresh</>}</button>
          </div>
          {loading ? (
            <div style={styles.empty}><p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>Loading your saved accounts…</p></div>
          ) : accounts.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ ...styles.bankIcon, width: 50, height: 50, margin: "0 auto 12px", fontSize: 23 }}><Icon name="bank" /></div>
              <p style={{ margin: "0 0 6px", color: "#374151", fontSize: 14, fontWeight: 700 }}>No bank accounts yet</p>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>Add your first account using the form. Saved account numbers will be masked here.</p>
            </div>
          ) : (
            <div style={styles.accountList}>
              {accounts.map(account => (
                <article key={account.id} style={styles.account}>
                  <div style={styles.accountTop}>
                    <div style={styles.bankIcon} aria-hidden="true"><Icon name="bank" /></div>
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


function WithdrawPage({
  token,
  onNavigate,
  onSuccess,
  balance,
  showBalance,
  setShowBalance,
}) {
  const [accounts, setAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);

  const [pin, setPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Payment PIN state
  const [hasPaymentPin, setHasPaymentPin] = useState(null);
  const [checkingPin, setCheckingPin] = useState(true);

  // Create Payment PIN state
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [creatingPin, setCreatingPin] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  // Wallet balance is stored in rupees.
  const availableBalance =
    balance === null || balance === undefined || balance === ""
      ? null
      : Number(balance);

  const balanceLoaded =
    availableBalance !== null &&
    Number.isFinite(availableBalance) &&
    availableBalance >= 0;

  const rupees = Number(amount);

  const validAmount =
    amount.trim() !== "" &&
    Number.isInteger(rupees) &&
    rupees >= 100 &&
    rupees <= 25000;

  const hasSufficientBalance =
    balanceLoaded && rupees <= availableBalance;

  const selectedAccount = accounts.find(
    (account) => account.id === bankAccountId
  );

  const canContinue =
    Boolean(token) &&
    Boolean(selectedAccount) &&
    !loading &&
    !submitting &&
    !checkingPin;

  function showError(text) {
    setMessage(text);
    setMessageType("error");
  }

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
          showError(
            error.message || "Could not load bank accounts."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (token) {
      loadBankAccounts();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Check whether the user already has a Payment PIN.
  useEffect(() => {
    let cancelled = false;

    async function checkPaymentPin() {
      setCheckingPin(true);

      try {
        const response = await fetch(apiUrl("/api/v1/user/me"), {
  method: "GET",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  cache: "no-store",
});

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not check Payment PIN status."
          );
        }

        if (typeof data.user?.hasPaymentPin !== "boolean") {
          throw new Error(
            "Payment PIN status is missing from the server response."
          );
        }

        if (!cancelled) {
          setHasPaymentPin(data.user.hasPaymentPin);
        }
      } catch (error) {
        if (!cancelled) {
          setHasPaymentPin(null);
          showError(error.message);
        }
      } finally {
        if (!cancelled) {
          setCheckingPin(false);
        }
      }
    }

    if (token) {
      checkPaymentPin();
    } else {
      setHasPaymentPin(null);
      setCheckingPin(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Validate details and decide which PIN popup to open.
  function openPinModal() {
    setMessage("");
    setMessageType("");

    if (!token) {
      showError("Please sign in again to continue.");
      return;
    }

    if (!selectedAccount) {
      showError("Please choose a bank account.");
      return;
    }

    if (!validAmount) {
      showError(
        "Enter a whole-rupee amount between ₹100 and ₹25,000."
      );
      return;
    }

    if (!balanceLoaded) {
      showError("Your wallet balance is still loading.");
      return;
    }

    if (!hasSufficientBalance) {
      showError("Insufficient wallet balance for this withdrawal.");
      return;
    }

    if (checkingPin || hasPaymentPin === null) {
      showError("Payment PIN status is unavailable. Please try again.");
      return;
    }

    setPin("");

    if (hasPaymentPin) {
      // Existing user: ask for the saved PIN.
      setShowPinModal(true);
    } else {
      // First-time user: create a PIN.
      setShowCreatePin(true);
    }
  }

  // Submit withdrawal using the saved Payment PIN.
  async function handleWithdraw(event) {
    event.preventDefault();

    if (submitting) return;

    setMessage("");
    setMessageType("");

    if (!/^(\d{4}|\d{6})$/.test(pin)) {
      showError("Please enter your 4–6 digit Payment PIN.");
      return;
    }

    setSubmitting(true);

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
            pin,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "Set your payment PIN first") {
          setHasPaymentPin(false);
          setShowPinModal(false);
          setPin("");
          setShowCreatePin(true);
          return;
        }

        throw new Error(apiErrorMessage(response, data, "Withdrawal request failed"));
      }

      setMessage(
        `Withdrawal request accepted. Reference: ${
          data.withdrawal?.reference || "Pending"
        }. It will be processed shortly.`
      );

      setMessageType("success");

      setAmount("");
      setPin("");
      setShowPinModal(false);

      if (typeof onSuccess === "function") {
        await onSuccess();
      }
    } catch (error) {
      showError(
        error.message || "Could not submit the withdrawal request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Create a Payment PIN for first-time users.
  async function createPaymentPin(event) {
    event.preventDefault();

    if (creatingPin) return;

    setCreateMessage("");

    if (!accountPassword) {
      setCreateMessage("Enter your account password.");
      return;
    }

    if (!/^(\d{4}|\d{6})$/.test(newPin)) {
      setCreateMessage("Enter a PIN containing 4 to 6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setCreateMessage("The Payment PINs do not match.");
      return;
    }

    setCreatingPin(true);

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
            pin: newPin,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      // If a PIN already exists, ask the user to enter that PIN.
      if (response.status === 409) {
        setHasPaymentPin(true);
        setShowCreatePin(false);
        setAccountPassword("");
        setNewPin("");
        setConfirmPin("");
        setPin("");
        setShowPinModal(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Could not create your Payment PIN."
        );
      }

      // PIN created successfully.
      setHasPaymentPin(true);
      setShowCreatePin(false);

      setAccountPassword("");
      setNewPin("");
      setConfirmPin("");
      setPin("");

      setCreateMessage("");
      setMessage("Payment PIN created. Enter it to confirm withdrawal.");
      setMessageType("success");

      // Immediately open the PIN-entry popup.
      setShowPinModal(true);
    } catch (error) {
      setCreateMessage(
        error.message || "Could not create your Payment PIN."
      );
    } finally {
      setCreatingPin(false);
    }
  }

  return (
    <section className="transfer-page">
      <header className="transfer-page-header">
        <div className="transfer-header-icon" aria-hidden="true">
          <Icon name="withdraw" />
        </div>

        <div>
          <p className="transfer-eyebrow">WALLET SERVICES</p>
          <h2>Withdraw Money</h2>
          <p className="transfer-tagline">
            Send money from your wallet to your saved bank account.
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

          {typeof setShowBalance === "function" && (
            <button
              type="button"
              className="eye-button transfer-balance-eye"
              onClick={() =>
                setShowBalance((previous) => !previous)
              }
              aria-label={showBalance ? "Hide balance" : "Show balance"}
              aria-pressed={showBalance}
            >
              <Icon name={showBalance ? "eye" : "eye-off"} />
            </button>
          )}
        </div>

        <p className="transfer-balance-caption">
          Amount currently available in your wallet
        </p>
      </section>

      {/* Withdrawal details */}
      <section className="transfer-details-card">
        <div className="transfer-card-heading">
          <div>
            <p className="transfer-eyebrow">PAYOUT DETAILS</p>
            <h3>Withdrawal Details</h3>
            <p>Choose a bank account and enter the amount.</p>
          </div>

          <div className="transfer-details-icon" aria-hidden="true">
            <Icon name="swap" />
          </div>
        </div>

        {loading ? (
          <p className="form-help">Loading bank accounts...</p>
        ) : accounts.length === 0 ? (
          <div className="withdraw-empty-state">
            <div className="withdraw-empty-icon" aria-hidden="true">
              <Icon name="bank" />
            </div>
            <h4>No bank accounts linked</h4>
            <p>Link a bank account before requesting a withdrawal.</p>

            <button
              type="button"
              className="withdraw-link-account-btn"
              onClick={() => onNavigate?.("Bank Accounts")}
            >
              + Link Bank Account
            </button>
          </div>
        ) : (
          <form
            className="transfer-form"
            onSubmit={(event) => {
              event.preventDefault();
              openPinModal();
            }}
          >
            <div className="transfer-field">
              <label htmlFor="withdraw-bank">Bank account</label>

              <select
                id="withdraw-bank"
                value={bankAccountId}
                onChange={(event) =>
                  setBankAccountId(event.target.value)
                }
                disabled={submitting}
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
                  <div
                    className="withdraw-bank-symbol"
                    aria-hidden="true"
                  >
                    <Icon name="bank" />
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
            </div>

            <div className="transfer-field">
              <label htmlFor="withdraw-amount">Amount</label>

              <div className="transfer-amount-wrap">
                <span aria-hidden="true">₹</span>

                <input
                  id="withdraw-amount"
                  type="number"
                  min="100"
                  max="25000"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="0"
                  inputMode="numeric"
                  required
                  disabled={submitting}
                />

                <span className="transfer-currency">INR</span>
              </div>

              <div className="quick-amounts">
                {[500, 1000, 5000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      Number(amount) === value
                        ? "quick-amount selected"
                        : "quick-amount"
                    }
                    onClick={() => setAmount(String(value))}
                    disabled={submitting}
                  >
                    ₹{value.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <p className="transfer-field-help">
                ₹100–₹25,000 per withdrawal, subject to backend limits.
              </p>
            </div>

            <div className="transfer-summary">
              <div>
                <span>Withdrawal amount</span>

                <strong>
                  {amount.trim() && Number.isFinite(rupees)
                    ? `₹${rupees.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "₹0.00"}
                </strong>
              </div>

              <p>
                An accepted request does not confirm that money has
                reached your bank account.
              </p>
            </div>

            {message && !showPinModal && !showCreatePin && (
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
              disabled={!canContinue}
            >
              {checkingPin ? "Checking..." : <>Continue <Icon name="withdraw" /></>}
            </button>

            <p className="transfer-security-note">
              Check your bank details carefully before withdrawing.
            </p>
          </form>
        )}
      </section>

      {/* Enter existing Payment PIN */}
      {showPinModal && (
        <div
          className="transfer-pin-overlay"
          onClick={() => {
            if (!submitting) {
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
            aria-labelledby="withdraw-pin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="transfer-pin-icon" aria-hidden="true">
              <Icon name="lock" />
            </div>

            <h3 id="withdraw-pin-title">Confirm Withdrawal</h3>

            <p>
              Enter your Payment PIN to withdraw{" "}
              <strong>
                ₹
                {rupees.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>{" "}
              to the account ending in{" "}
              {selectedAccount
                ? String(selectedAccount.accountNumber).slice(-4)
                : "—"}
              .
            </p>

            <form onSubmit={handleWithdraw}>
              <div className="transfer-field">
                <label htmlFor="withdraw-payment-pin">
                  Payment PIN
                </label>

                <input
                  id="withdraw-payment-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(event) =>
                    setPin(
                      event.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="Enter your Payment PIN"
                  required
                  autoFocus
                  disabled={submitting}
                />
              </div>

              {message && (
                <div
                  className={`transfer-message ${
                    messageType === "success" ? "is-success" : "is-error"
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
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="transfer-submit"
                  disabled={
                    submitting || !/^(\d{4}|\d{6})$/.test(pin)
                  }
                >
                  {submitting ? "Processing..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Payment PIN for first-time users */}
      {showCreatePin && (
        <div
          className="transfer-pin-overlay"
          onClick={() => {
            if (!creatingPin) {
              setShowCreatePin(false);
              setAccountPassword("");
              setNewPin("");
              setConfirmPin("");
              setCreateMessage("");
            }
          }}
        >
          <div
            className="transfer-pin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-payment-pin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="transfer-pin-icon" aria-hidden="true">
              <Icon name="key" />
            </div>

            <h3 id="create-payment-pin-title">
              Create Payment PIN
            </h3>

            <p>
              Set a 4–6 digit PIN. You can use the same PIN for
              transfers and withdrawals.
            </p>

            <form onSubmit={createPaymentPin}>
              <div className="transfer-field">
                <label htmlFor="pin-account-password">
                  Account password
                </label>

                <input
                  id="pin-account-password"
                  type="password"
                  autoComplete="current-password"
                  value={accountPassword}
                  onChange={(event) =>
                    setAccountPassword(event.target.value)
                  }
                  required
                  disabled={creatingPin}
                />
              </div>

              <div className="transfer-field">
                <label htmlFor="new-payment-pin">
                  New Payment PIN
                </label>

                <input
                  id="new-payment-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={newPin}
                  onChange={(event) =>
                    setNewPin(
                      event.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="Enter 4–6 digits"
                  required
                  disabled={creatingPin}
                />
              </div>

              <div className="transfer-field">
                <label htmlFor="confirm-new-payment-pin">
                  Confirm Payment PIN
                </label>

                <input
                  id="confirm-new-payment-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(event) =>
                    setConfirmPin(
                      event.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="Re-enter your PIN"
                  required
                  disabled={creatingPin}
                />
              </div>

              {createMessage && (
                <div className="transfer-message is-error" role="alert">
                  {createMessage}
                </div>
              )}

              <div className="transfer-pin-actions">
                <button
                  type="button"
                  className="transfer-pin-cancel"
                  disabled={creatingPin}
                  onClick={() => {
                    setShowCreatePin(false);
                    setAccountPassword("");
                    setNewPin("");
                    setConfirmPin("");
                    setCreateMessage("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="transfer-submit"
                  disabled={
                    creatingPin ||
                    !accountPassword ||
                    !/^(\d{4}|\d{6})$/.test(newPin) ||
                    newPin !== confirmPin
                  }
                >
                  {creatingPin ? "Creating..." : "Create PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

/* Lightweight inline SVG icon set (stroke icons, inherit colour and size from CSS) */
const ICON_PATHS = {
  dashboard: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  transfer: (<><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>),
  withdraw: (<><path d="M12 4v14" /><path d="m6 12 6 6 6-6" /></>),
  swap: (<><path d="M4 8h14" /><path d="m14 4 4 4-4 4" /><path d="M20 16H6" /><path d="m10 12-4 4 4 4" /></>),
  bank: (<><path d="M3 10 12 4l9 6" /><path d="M5 10v8" /><path d="M10 10v8" /><path d="M14 10v8" /><path d="M19 10v8" /><path d="M3 21h18" /></>),
  shield: (<><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>),
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9" /><path d="m16 7 3 3" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
  "eye-off": (<><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9" /><path d="M6.6 6.7A17 17 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "arrow-right": (<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>),
  "arrow-left": (<><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>),
  menu: (<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>),
  close: (<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  "user-plus": (<><circle cx="10" cy="8" r="4" /><path d="M2 21a8 8 0 0 1 16 0" /><path d="M19 8v6" /><path d="M16 11h6" /></>),
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6" /><path d="M9 12h6" /></>),
  card: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></>),
  refresh: (<><path d="M20 11a8 8 0 0 0-14.5-4" /><path d="M5 3v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4" /><path d="M19 21v-4h-4" /></>),
};

function Icon({ name, size = "1em", className = "" }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export default App;