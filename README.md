# 💸 KaasuPay — Your Money, Your Control.

<p align="center">
  <strong>A smarter way to manage your digital wallet.</strong>
  <br />
  Add money. Transfer funds. Track transactions. Request payments.
</p>

<p align="center">
  <a href="https://kaasupay-frontend.onrender.com">🌐 Live Application</a>
  &nbsp; • &nbsp;
  <a href="https://github.com/sindhunelluri/kaasupay-frontend">💻 Frontend Source Code</a>
</p>

---

## ✨ About KaasuPay

**KaasuPay** is a digital wallet application designed to make everyday money management simple and convenient.

From adding funds to transferring money and managing payment requests, KaasuPay brings essential wallet operations together in one interface.

The frontend is built with React.js and Vite, connecting to a backend REST API to provide a smooth and interactive wallet experience.

> One wallet. Multiple ways to manage your money. A simpler digital payment experience.

## 🚀 Explore the Features

| Feature | What you can do |
|---|---|
| 🔐 Authentication | Register and securely sign in |
| 💰 Wallet Dashboard | View your available wallet balance |
| ➕ Add Money | Create payment orders and use the Razorpay payment flow |
| 🔄 Money Transfer | Send money to other registered users |
| 📊 Transaction History | Review your wallet transactions |
| 📩 Money Requests | Create and receive payment requests |
| ✅ Pay Requests | Pay pending incoming requests |
| ❌ Request Management | Decline incoming or cancel outgoing requests |
| 🔑 Security PIN | Manage wallet security PIN functionality |
| 👥 Recent Contacts | Access recent contacts for convenient transfers |

## 🔄 How KaasuPay Works

```text
          USER
           |
           ▼
    React.js Frontend
           |
           ▼
      REST API Calls
           |
           ▼
    Node.js / Express
           |
           ▼
       MongoDB
           |
           ▼
    Wallet Operations
           |
     ┌─────┼─────────┐
     ▼     ▼         ▼
   Add   Transfer   Money
  Money   Funds    Requests
```

*Payment processing also integrates with Razorpay.*

## 🧰 Technology Behind the Interface

<p align="center">
  <strong>FRONTEND TECHNOLOGIES</strong>
</p>

| Technology | Role |
|---|---|
| React.js | Component-based user interface |
| Vite | Development server and build tool |
| JavaScript | Application functionality |
| HTML5 | Page structure |
| CSS3 | Styling and responsive layouts |
| REST API | Frontend and backend communication |
| Razorpay | Payment flow integration |

**Development tools:** VS Code · Postman · Git · GitHub

## 🏗️ Project Structure

```text
kaasupay-frontend/
│
├── public/
│
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── MoneyRequestsPage.jsx
│   ├── RecentContacts.jsx
│   ├── SecurityPinPage.jsx
│   └── Other Components
│
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## ⚡ Get Started

Want to run KaasuPay locally? Follow these steps.

**1. Clone the repository**

```bash
git clone https://github.com/sindhunelluri/kaasupay-frontend.git
```

**2. Open the project**

```bash
cd kaasupay-frontend
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure the backend API**

Set the API base URL to your running KaasuPay backend using the configuration expected by the project.

**5. Start the development server**

```bash
npm run dev
```

**6. Build for production**

```bash
npm run build
```

## 🌍 Experience KaasuPay

<p align="center">
  <a href="https://kaasupay-frontend.onrender.com">
    <strong>🚀 OPEN KAASUPAY LIVE</strong>
  </a>
</p>

**Frontend:** [kaasupay-frontend.onrender.com](https://kaasupay-frontend.onrender.com)

**Backend:** Maintained in a private repository and deployed separately.

## 🧪 What to Explore

Try these application workflows:

- Create an account and sign in.
- Explore your wallet dashboard.
- Add money through the payment flow.
- Transfer money to another registered user.
- Review transaction history.
- Create a money request.
- Pay, decline, or cancel a request.

## 🔮 What's Next?

KaasuPay is an evolving project. Future improvements may include:

- Enhanced wallet analytics
- Improved transaction notifications
- Additional account management options
- Further UI and performance enhancements

## 👩‍💻 Built By

**Sindhu Nelluri**
Software Engineer

[GitHub](https://github.com/sindhunelluri) · [Portfolio](https://sindhunelluri.github.io/Sindhu_Nelluri_Portfolio/)

---

<p align="center">
  <strong>KAASUPAY</strong>
  <br />
  <em>Making digital wallet management simpler, one transaction at a time.</em>
</p>
