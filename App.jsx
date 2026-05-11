import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

// ── Category definitions ──
const CATEGORIES = [
  { id: 'food', emoji: '🍕', name: 'Food', color: 'amber' },
  { id: 'transport', emoji: '🚗', name: 'Transport', color: 'blue' },
  { id: 'entertainment', emoji: '🎬', name: 'Fun', color: 'purple' },
  { id: 'shopping', emoji: '🛍️', name: 'Shopping', color: 'rose' },
  { id: 'bills', emoji: '📄', name: 'Bills', color: 'green' },
  { id: 'other', emoji: '📦', name: 'Other', color: 'cyan' },
];

const AVATAR_COLORS = ['purple', 'green', 'blue', 'amber', 'rose', 'cyan'];

const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

const FAQ_DATA = [
  { q: 'How do I split an expense?', a: 'Tap the "+" button, enter the amount and description, select which friends to split with, pick a category, and hit Save. Each person\'s share is calculated automatically.' },
  { q: 'Can I edit an expense after saving?', a: 'Currently, expenses can be deleted and re-created. Inline editing is coming in the next update!' },
  { q: 'How is the split calculated?', a: 'Expenses are split equally among all selected people including yourself. For example, a ₹300 bill split among 3 people = ₹100 each.' },
  { q: 'What does "Saved by Splitting" mean?', a: 'It shows how much money you saved by splitting instead of paying the full amount. It\'s the difference between total expenses and your personal share.' },
  { q: 'Is my data secure?', a: 'All data is stored securely in Firebase Cloud Firestore with real-time encryption. Your information never leaves Google\'s secure servers.' },
  { q: 'Can I use SplitEase offline?', a: 'Firebase supports offline persistence, so your recent data is available even without internet. Changes sync automatically when you\'re back online.' },
];

export default function App() {
  // ── View & Theme ──
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('splitease-theme') || 'dark');
  const [showConfetti, setShowConfetti] = useState(false);

  // ── Auth State ──
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');

  // ── Data State ──
  const [friends, setFriends] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [bills, setBills] = useState([]);

  // ── Add Expense State ──
  const [billDesc, setBillDesc] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('food');

  // ── History filters ──
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // ── Settings State ──
  const [currency, setCurrency] = useState(() => localStorage.getItem('splitease-currency') || 'INR');
  const [monthlyBudget, setMonthlyBudget] = useState(() => localStorage.getItem('splitease-budget') || '');
  const [budgetInput, setBudgetInput] = useState('');
  const [notifications, setNotifications] = useState(true);

  // ── Help State ──
  const [openFaq, setOpenFaq] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeBar, setActiveBar] = useState(null);
  const [shareBillId, setShareBillId] = useState(null);

  // ── Apply theme ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('splitease-theme', theme);
  }, [theme]);

  // ── Persist currency ──
  useEffect(() => {
    localStorage.setItem('splitease-currency', currency);
  }, [currency]);

  // ── Firebase Integration ──
  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const billsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setBills(billsData);
      }, (error) => {
        console.error("Error fetching bills from Firebase:", error);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // ── Toast ──
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Confetti ──
  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  // ── Auth handlers ──
  const handleLogin = (e) => {
    e.preventDefault();
    if (authEmail) {
      setUser({ name: authName || 'User', email: authEmail });
      setView('dashboard');
      showToast('✨ Welcome back!');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (authName && authEmail) {
      setUser({ name: authName, email: authEmail });
      setView('dashboard');
      showToast('🎉 Account created!');
      triggerConfetti();
    }
  };

  // ── Social Login (Coming Soon) ──
  const handleSocialLogin = (providerName) => {
    const name = providerName.charAt(0).toUpperCase() + providerName.slice(1);
    showToast(`🚀 ${name} sign-in coming soon! Use email for now.`);
  };

  // ── Share Bill ──
  const generateShareText = (bill) => {
    const cat = getCategoryInfo(bill.category);
    return `💸 *SplitEase Bill*\n\n${cat.emoji} *${bill.description}*\n💰 Total: ${formatCurrency(bill.total)}\n👥 Split between: ${bill.splitBetween} people\n🧮 Each person pays: *${formatCurrency(bill.personalShare)}*\n\nSent via SplitEase — split smarter!`;
  };

  const handleShareWhatsApp = (bill) => {
    const text = generateShareText(bill);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShareBillId(null);
    showToast('📤 Opening WhatsApp...');
  };

  const handleCopyBill = (bill) => {
    const text = generateShareText(bill).replace(/\*/g, '');
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Bill copied to clipboard!');
    }).catch(() => {
      showToast('❌ Could not copy');
    });
    setShareBillId(null);
  };

  const handleNativeShare = async (bill) => {
    const text = generateShareText(bill).replace(/\*/g, '');
    if (navigator.share) {
      try {
        await navigator.share({ title: `SplitEase: ${bill.description}`, text });
        showToast('📤 Shared successfully!');
      } catch (e) {
        if (e.name !== 'AbortError') showToast('Share cancelled');
      }
    } else {
      handleCopyBill(bill);
    }
    setShareBillId(null);
  };

  // ── Friend handlers ──
  const handleAddFriend = (e) => {
    e.preventDefault();
    if (newFriend && !friends.includes(newFriend)) {
      setFriends([...friends, newFriend]);
      setNewFriend('');
      showToast(`👋 ${newFriend} added!`);
    }
  };

  const handleRemoveFriend = (friendToRemove) => {
    setFriends(friends.filter(f => f !== friendToRemove));
    if (selectedFriends.includes(friendToRemove)) {
      setSelectedFriends(selectedFriends.filter(f => f !== friendToRemove));
    }
  };

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev =>
      prev.includes(friend) ? prev.filter(f => f !== friend) : [...prev, friend]
    );
  };

  // ── Bill handlers ──
  const handleSplitBill = async (e) => {
    e.preventDefault();
    const totalAmount = parseFloat(billAmount);
    if (totalAmount > 0 && billDesc) {
      const totalPeople = selectedFriends.length + 1;
      const amountPerPerson = totalAmount / totalPeople;
      const newBillData = {
        description: billDesc,
        total: totalAmount,
        personalShare: amountPerPerson,
        splitBetween: totalPeople,
        category: selectedCategory,
        createdAt: serverTimestamp()
      };
      try {
        await addDoc(collection(db, 'bills'), newBillData);
        setBillDesc('');
        setBillAmount('');
        setSelectedFriends([]);
        setSelectedCategory('food');
        setView('dashboard');
        showToast('💸 Expense saved!');
        triggerConfetti();
      } catch (error) {
        console.error("Error saving bill to Firebase:", error);
      }
    }
  };

  const handleDeleteBill = async (billId) => {
    if (window.confirm("Delete this expense? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'bills', billId));
        showToast('🗑️ Expense deleted');
      } catch (error) {
        console.error("Error deleting bill:", error);
      }
    }
  };

  // ── Budget ──
  const handleSaveBudget = () => {
    if (budgetInput && parseFloat(budgetInput) > 0) {
      setMonthlyBudget(budgetInput);
      localStorage.setItem('splitease-budget', budgetInput);
      setBudgetInput('');
      showToast('🎯 Budget updated!');
    }
  };

  // ── Feedback ──
  const handleSendFeedback = (e) => {
    e.preventDefault();
    if (feedbackText.trim()) {
      setFeedbackText('');
      showToast('💬 Feedback sent! Thank you.');
    }
  };

  // ── Calculations ──
  const totalMonthlyExpense = bills.reduce((sum, bill) => sum + bill.total, 0);
  const totalPersonalExpense = bills.reduce((sum, bill) => sum + bill.personalShare, 0);
  const avgPerBill = bills.length > 0 ? totalMonthlyExpense / bills.length : 0;
  const totalSaved = totalMonthlyExpense - totalPersonalExpense;

  const budgetNum = parseFloat(monthlyBudget) || 0;
  const budgetUsed = budgetNum > 0 ? Math.min((totalPersonalExpense / budgetNum) * 100, 100) : 0;
  const budgetRemaining = budgetNum > 0 ? Math.max(budgetNum - totalPersonalExpense, 0) : 0;

  // ── Category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    bills.forEach(bill => {
      const cat = bill.category || 'other';
      if (!breakdown[cat]) breakdown[cat] = 0;
      breakdown[cat] += bill.total;
    });
    return CATEGORIES.map(cat => ({
      ...cat,
      total: breakdown[cat.id] || 0,
      percentage: totalMonthlyExpense > 0 ? ((breakdown[cat.id] || 0) / totalMonthlyExpense) * 100 : 0
    })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [bills, totalMonthlyExpense]);

  // ── Filtered bills ──
  const filteredBills = useMemo(() => {
    let result = bills;
    if (activeFilter !== 'all') result = result.filter(b => (b.category || 'other') === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => b.description.toLowerCase().includes(q));
    }
    return result;
  }, [bills, activeFilter, searchQuery]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    const last7 = bills.slice(0, 7).reverse();
    const max = Math.max(...last7.map(b => b.total), 1);
    return last7.map(b => ({
      height: `${Math.max((b.total / max) * 100, 8)}%`,
      amount: b.total
    }));
  }, [bills]);

  // ── Helpers ──
  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '₹';
  const formatCurrency = (amount) => `${currencySymbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const getCategoryInfo = (catId) => CATEGORIES.find(c => c.id === catId) || CATEGORIES[5];

  const splitPreviewAmount = billAmount ? (parseFloat(billAmount) / (selectedFriends.length + 1)) : 0;

  // ── Budget ring SVG calc ──
  const ringRadius = 25;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (budgetUsed / 100) * ringCircumference;
  const ringColor = budgetUsed > 90 ? '#f43f5e' : budgetUsed > 70 ? '#f59e0b' : '#a855f7';

  // ── Confetti pieces ──
  const confettiPieces = useMemo(() => {
    const colors = ['#7c3aed', '#a855f7', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#c084fc', '#06b6d4'];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[i % colors.length],
      delay: `${Math.random() * 1.5}s`,
      size: `${6 + Math.random() * 6}px`,
    }));
  }, []);

  return (
    <div className="app-container" data-theme={theme}>
      {/* ── Animated Background ── */}
      <div className="animated-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* ── Toast ── */}
      {toast && <div className="toast">{toast}</div>}

      {/* ── Confetti ── */}
      {showConfetti && (
        <div className="confetti-container">
          {confettiPieces.map(p => (
            <div
              key={p.id}
              className="confetti-piece"
              style={{
                left: p.left,
                background: p.color,
                animationDelay: p.delay,
                width: p.size,
                height: p.size,
              }}
            />
          ))}
        </div>
      )}

      {/* ════════════════ LOGIN ════════════════ */}
      {view === 'login' && (
        <div className="auth-container">
          <div className="app-logo">
            <div className="app-icon">SE</div>
            <span className="app-logo-text">SplitEase</span>
          </div>
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to track expenses, split bills, and settle up with friends effortlessly.</p>

          <div className="social-buttons">
            <button className="social-btn" type="button" onClick={() => handleSocialLogin('google')}>
              <span>🔵</span><span className="social-btn-text">Google</span>
            </button>
            <button className="social-btn" type="button" onClick={() => handleSocialLogin('apple')}>
              <span>⚫</span><span className="social-btn-text">Apple</span>
            </button>
            <button className="social-btn" type="button" onClick={() => handleSocialLogin('github')}>
              <span>🔷</span><span className="social-btn-text">GitHub</span>
            </button>
          </div>
          <div className="auth-divider">or continue with email</div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input id="login-email" type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="name@email.com" />
            </div>
            <div className="input-group">
              <input id="login-password" type="password" required placeholder="Enter your password" />
            </div>
            <button id="login-submit" type="submit" className="primary-btn">Sign In →</button>
          </form>
          <p className="auth-link">Don't have an account? <span onClick={() => setView('register')}>Create one</span></p>
        </div>
      )}

      {/* ════════════════ REGISTER ════════════════ */}
      {view === 'register' && (
        <div className="auth-container">
          <div className="app-logo">
            <div className="app-icon">SE</div>
            <span className="app-logo-text">SplitEase</span>
          </div>
          <h2>Create Account</h2>
          <p className="subtitle">Join thousands who split expenses smarter. It takes less than 30 seconds.</p>

          <form onSubmit={handleRegister}>
            <div className="input-group">
              <input id="register-name" type="text" required value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="input-group">
              <input id="register-email" type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="name@email.com" />
            </div>
            <div className="input-group">
              <input id="register-password" type="password" required placeholder="Create a password" />
            </div>
            <button id="register-submit" type="submit" className="primary-btn">Create Account →</button>
          </form>
          <p className="auth-link">Already have an account? <span onClick={() => setView('login')}>Sign In</span></p>
        </div>
      )}

      {/* ════════════════ DASHBOARD ════════════════ */}
      {view === 'dashboard' && user && (
        <>
          <div className="content-area">
            <div className="top-header">
              <div className="header-left">
                <h1>SplitEase</h1>
                <p className="greeting">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {'BADE SAHAB'} 👋</p>
              </div>
              <div className="header-right">
                <button className="notification-btn" title="Notifications">🔔<span className="notification-dot"></span></button>
                <div className="avatar" onClick={() => setView('profile')}>{getInitials(user.name)}</div>
              </div>
            </div>

            {/* Balance Card */}
            <div className="balance-card">
              <div className="balance-top">
                <div>
                  <div className="balance-label">Total Expenses</div>
                  <div className="balance-amount">{formatCurrency(totalMonthlyExpense)}</div>
                </div>
                <div className="balance-badge">{bills.length} {bills.length === 1 ? 'expense' : 'expenses'}</div>
              </div>
              <div className="balance-stats">
                <div className="balance-stat">
                  <div className="balance-stat-label">Your Share</div>
                  <div className="balance-stat-value">{formatCurrency(totalPersonalExpense)}</div>
                </div>
                <div className="balance-stat">
                  <div className="balance-stat-label">You Saved</div>
                  <div className="balance-stat-value">{formatCurrency(totalSaved)}</div>
                </div>
              </div>
            </div>

            {/* Budget Ring */}
            {budgetNum > 0 && (
              <div className="budget-ring-container">
                <svg className="budget-ring-svg" viewBox="0 0 60 60">
                  <circle className="budget-ring-bg" cx="30" cy="30" r={ringRadius} />
                  <circle
                    className="budget-ring-fill"
                    cx="30" cy="30" r={ringRadius}
                    stroke={ringColor}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="budget-ring-info">
                  <div className="budget-ring-label">Monthly Budget</div>
                  <div className="budget-ring-value">{formatCurrency(budgetRemaining)} left</div>
                  <div className="budget-ring-sub">of {formatCurrency(budgetNum)}</div>
                </div>
                <div className="budget-ring-percentage">{budgetUsed.toFixed(0)}%</div>
              </div>
            )}

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card purple">
                <div className="stat-icon purple">💰</div>
                <div className="stat-value">{bills.length}</div>
                <div className="stat-label">Total Bills</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green">👥</div>
                <div className="stat-value">{friends.length}</div>
                <div className="stat-label">Friends</div>
              </div>
              <div className="stat-card amber">
                <div className="stat-icon amber">📊</div>
                <div className="stat-value">{formatCurrency(avgPerBill)}</div>
                <div className="stat-label">Avg per Bill</div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon blue">🏷️</div>
                <div className="stat-value">{categoryBreakdown.length}</div>
                <div className="stat-label">Categories</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <button className="quick-action-btn" onClick={() => setView('add-expense')}>
                <div className="quick-action-icon purple">➕</div>
                <span className="quick-action-text">Add Bill</span>
              </button>
              <button className="quick-action-btn" onClick={() => setView('friends')}>
                <div className="quick-action-icon green">👥</div>
                <span className="quick-action-text">Friends</span>
              </button>
              <button className="quick-action-btn" onClick={() => setView('history')}>
                <div className="quick-action-icon rose">📋</div>
                <span className="quick-action-text">History</span>
              </button>
              <button className="quick-action-btn" onClick={() => setView('analytics')}>
                <div className="quick-action-icon blue">📊</div>
                <span className="quick-action-text">Analytics</span>
              </button>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <>
                <div className="section-header">
                  <h3>Spending Trend</h3>
                  <span className="section-badge">{chartData.length} latest</span>
                </div>
                <div className="mini-chart" onMouseLeave={() => setActiveBar(null)}>
                  {chartData.map((bar, i) => (
                    <div
                      key={i}
                      className={`mini-chart-bar ${activeBar === `dash-${i}` ? 'active' : ''}`}
                      style={{ height: bar.height }}
                      onClick={() => setActiveBar(activeBar === `dash-${i}` ? null : `dash-${i}`)}
                      onMouseEnter={() => setActiveBar(`dash-${i}`)}
                      onTouchStart={() => setActiveBar(activeBar === `dash-${i}` ? null : `dash-${i}`)}
                    >
                      {activeBar === `dash-${i}` && (
                        <div className="chart-tooltip">{formatCurrency(bar.amount)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Recent Activity */}
            <div className="section-header" style={{ marginTop: '1rem' }}>
              <h3>Recent Activity</h3>
              {bills.length > 3 && <button className="see-all-btn" onClick={() => setView('history')}>See All →</button>}
            </div>

            {bills.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧾</div>
                <h4>No expenses yet</h4>
                <p>Start by adding your first expense and splitting it with friends!</p>
              </div>
            ) : (
              <div className="activity-list">
                {bills.slice(0, 4).map((bill) => {
                  const cat = getCategoryInfo(bill.category);
                  return (
                    <div key={bill.id} className="activity-item">
                      <div className={`activity-icon cat-${cat.id}`}>{cat.emoji}</div>
                      <div className="activity-info">
                        <h4>{bill.description}</h4>
                        <p>{formatDateTime(bill.createdAt)} · {bill.splitBetween} people</p>
                      </div>
                      <div className="activity-amount share">{formatCurrency(bill.personalShare)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button className="floating-add" onClick={() => setView('add-expense')}>+</button>

          <div className="bottom-nav">
            <div className="nav-item active"><span className="nav-icon">🏠</span>Home</div>
            <div className="nav-item" onClick={() => setView('friends')}><span className="nav-icon">👥</span>Friends</div>
            <div className="nav-item" onClick={() => setView('history')}><span className="nav-icon">🧾</span>History</div>
            <div className="nav-item" onClick={() => setView('profile')}><span className="nav-icon">👤</span>Profile</div>
          </div>
        </>
      )}

      {/* ════════════════ FRIENDS ════════════════ */}
      {view === 'friends' && user && (
        <>
          <div className="content-area">
            <div className="modal-header">
              <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
              <h2>Friends</h2>
            </div>

            <form className="add-friend-form" onSubmit={handleAddFriend}>
              <input id="add-friend-input" type="text" placeholder="Add a friend's name..." value={newFriend} onChange={(e) => setNewFriend(e.target.value)} />
              <button type="submit" className="add-btn-small">+ Add</button>
            </form>

            <div className="section-header">
              <h3>Your Circle</h3>
              <span className="section-badge">{friends.length} friends</span>
            </div>

            {friends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👋</div>
                <h4>No friends yet</h4>
                <p>Add friends to start splitting expenses together!</p>
              </div>
            ) : (
              friends.map((friend, idx) => (
                <div key={idx} className="friend-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className={`friend-avatar ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>{getInitials(friend)}</div>
                  <div className="friend-info">
                    <h4>{friend}</h4>
                    <p className="friend-status"><span className="status-dot"></span> Ready to split</p>
                  </div>
                  <button className="remove-btn" onClick={() => handleRemoveFriend(friend)} title="Remove">×</button>
                </div>
              ))
            )}
          </div>

          <div className="bottom-nav">
            <div className="nav-item" onClick={() => setView('dashboard')}><span className="nav-icon">🏠</span>Home</div>
            <div className="nav-item active"><span className="nav-icon">👥</span>Friends</div>
            <div className="nav-item" onClick={() => setView('history')}><span className="nav-icon">🧾</span>History</div>
            <div className="nav-item" onClick={() => setView('profile')}><span className="nav-icon">👤</span>Profile</div>
          </div>
        </>
      )}

      {/* ════════════════ ADD EXPENSE ════════════════ */}
      {view === 'add-expense' && user && (
        <div className="content-area">
          <div className="modal-header">
            <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
            <h2>New Expense</h2>
          </div>

          <form onSubmit={handleSplitBill}>
            <div className="input-group"><label>Category</label></div>
            <div className="category-grid">
              {CATEGORIES.map(cat => (
                <div key={cat.id} className={`category-chip ${selectedCategory === cat.id ? 'selected' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
                  <span className="category-emoji">{cat.emoji}</span>
                  <span className="category-name">{cat.name}</span>
                </div>
              ))}
            </div>

            <div className="amount-display">
              <input id="expense-amount" type="number" placeholder={`${currencySymbol} 0`} value={billAmount} onChange={(e) => setBillAmount(e.target.value)} required min="1" step="0.01" />
              <div className="amount-currency">Enter total amount in {currency}</div>
            </div>

            <div className="input-group">
              <label>Description</label>
              <input id="expense-description" type="text" placeholder="e.g. Dinner at BBQ Nation" value={billDesc} onChange={(e) => setBillDesc(e.target.value)} required />
            </div>

            <div className="input-group" style={{ marginTop: '1.25rem' }}><label>Split Between</label></div>
            <div className="checkbox-group">
              <label className="checkbox-label selected">
                <input type="checkbox" checked disabled />
                {getCategoryInfo(selectedCategory).emoji} Me ({user.name.split(' ')[0]})
              </label>
              {friends.map((friend, idx) => (
                <label key={idx} className={`checkbox-label ${selectedFriends.includes(friend) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={selectedFriends.includes(friend)} onChange={() => toggleFriendSelection(friend)} />
                  {friend}
                </label>
              ))}
              {friends.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>
                  No friends added yet. <span style={{ color: 'var(--text-accent)', cursor: 'pointer' }} onClick={() => setView('friends')}>Add friends first →</span>
                </p>
              )}
            </div>

            {billAmount && parseFloat(billAmount) > 0 && (
              <div className="split-preview">
                <div className="split-preview-label">Each Person Pays</div>
                <div className="split-preview-amount">{formatCurrency(splitPreviewAmount)}</div>
                <div className="split-preview-detail">Split equally among {selectedFriends.length + 1} {selectedFriends.length + 1 === 1 ? 'person' : 'people'}</div>
              </div>
            )}

            <button type="submit" className="primary-btn">💸 Save Expense</button>
          </form>
        </div>
      )}

      {/* ════════════════ HISTORY ════════════════ */}
      {view === 'history' && user && (
        <>
          <div className="content-area">
            <div className="modal-header">
              <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
              <h2>Expense History</h2>
            </div>

            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input id="search-bills" type="search" placeholder="Search expenses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div className="filter-chips">
              <button className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All</button>
              {CATEGORIES.map(cat => (
                <button key={cat.id} className={`filter-chip ${activeFilter === cat.id ? 'active' : ''}`} onClick={() => setActiveFilter(cat.id)}>
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>

            {filteredBills.length > 0 && (
              <div className="month-summary">
                <div className="month-summary-header">
                  <span className="month-summary-title">Summary</span>
                  <span className="month-summary-total">{formatCurrency(filteredBills.reduce((s, b) => s + b.total, 0))}</span>
                </div>
                {categoryBreakdown.length > 0 && activeFilter === 'all' && (
                  <div className="category-breakdown">
                    {categoryBreakdown.slice(0, 4).map(cat => (
                      <div key={cat.id} className="category-row">
                        <div className={`category-row-icon cat-${cat.id}`}>{cat.emoji}</div>
                        <div className="category-row-info">
                          <div className="category-row-top">
                            <span className="category-row-name">{cat.name}</span>
                            <span className="category-row-amount">{formatCurrency(cat.total)}</span>
                          </div>
                          <div className="category-bar">
                            <div className={`category-bar-fill ${cat.color}`} style={{ width: `${cat.percentage}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {filteredBills.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h4>{searchQuery || activeFilter !== 'all' ? 'No matching expenses' : 'No expenses yet'}</h4>
                <p>{searchQuery || activeFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Start by adding your first expense!'}</p>
              </div>
            ) : (
              filteredBills.map((bill, idx) => {
                const cat = getCategoryInfo(bill.category);
                return (
                  <div key={bill.id} className="bill-item" style={{ animationDelay: `${idx * 0.04}s` }}>
                    <div className="bill-header">
                      <span className="bill-title">{bill.description}</span>
                      <div className="bill-amount-group">
                        <span className="bill-total">{formatCurrency(bill.total)}</span>
                        <button className="bill-action-btn share" onClick={() => setShareBillId(shareBillId === bill.id ? null : bill.id)} title="Share">📤</button>
                        <button className="bill-action-btn delete" onClick={() => handleDeleteBill(bill.id)} title="Delete">🗑</button>
                      </div>
                    </div>

                    {/* Share options dropdown */}
                    {shareBillId === bill.id && (
                      <div className="share-dropdown">
                        <button className="share-option whatsapp" onClick={() => handleShareWhatsApp(bill)}>
                          <span>💬</span> WhatsApp
                        </button>
                        <button className="share-option copy" onClick={() => handleCopyBill(bill)}>
                          <span>📋</span> Copy
                        </button>
                        <button className="share-option native" onClick={() => handleNativeShare(bill)}>
                          <span>📤</span> More
                        </button>
                      </div>
                    )}

                    <div className="bill-meta">
                      <span className={`bill-category-tag cat-${cat.id}`}>{cat.emoji} {cat.name}</span>
                      <span className="bill-date">{formatDateTime(bill.createdAt)}</span>
                    </div>
                    <div className="bill-footer">
                      <span className="bill-split-info">Split between {bill.splitBetween} people</span>
                      <span className="bill-your-share">You: {formatCurrency(bill.personalShare)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="bottom-nav">
            <div className="nav-item" onClick={() => setView('dashboard')}><span className="nav-icon">🏠</span>Home</div>
            <div className="nav-item" onClick={() => setView('friends')}><span className="nav-icon">👥</span>Friends</div>
            <div className="nav-item active"><span className="nav-icon">🧾</span>History</div>
            <div className="nav-item" onClick={() => setView('profile')}><span className="nav-icon">👤</span>Profile</div>
          </div>
        </>
      )}

      {/* ════════════════ ANALYTICS ════════════════ */}
      {view === 'analytics' && user && (
        <>
          <div className="content-area">
            <div className="modal-header">
              <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
              <h2>Analytics</h2>
            </div>

            <div className="stats-grid">
              <div className="stat-card purple">
                <div className="stat-icon purple">💸</div>
                <div className="stat-value">{formatCurrency(totalMonthlyExpense)}</div>
                <div className="stat-label">Total Spent</div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green">🎯</div>
                <div className="stat-value">{formatCurrency(totalSaved)}</div>
                <div className="stat-label">Saved by Splitting</div>
              </div>
            </div>

            {chartData.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '0.5rem' }}>
                  <h3>Expense Trend</h3>
                  <span className="section-badge">Last {chartData.length}</span>
                </div>
                <div className="mini-chart" style={{ height: '80px', marginBottom: '1.5rem' }} onMouseLeave={() => setActiveBar(null)}>
                  {chartData.map((bar, i) => (
                    <div
                      key={i}
                      className={`mini-chart-bar ${activeBar === `analytics-${i}` ? 'active' : ''}`}
                      style={{ height: bar.height }}
                      onClick={() => setActiveBar(activeBar === `analytics-${i}` ? null : `analytics-${i}`)}
                      onMouseEnter={() => setActiveBar(`analytics-${i}`)}
                      onTouchStart={() => setActiveBar(activeBar === `analytics-${i}` ? null : `analytics-${i}`)}
                    >
                      {activeBar === `analytics-${i}` && (
                        <div className="chart-tooltip">{formatCurrency(bar.amount)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="section-header"><h3>By Category</h3></div>
            {categoryBreakdown.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h4>No data yet</h4>
                <p>Add some expenses to see your spending breakdown.</p>
              </div>
            ) : (
              <div className="month-summary" style={{ marginTop: '0.5rem' }}>
                <div className="category-breakdown">
                  {categoryBreakdown.map(cat => (
                    <div key={cat.id} className="category-row">
                      <div className={`category-row-icon cat-${cat.id}`}>{cat.emoji}</div>
                      <div className="category-row-info">
                        <div className="category-row-top">
                          <span className="category-row-name">{cat.name} ({cat.percentage.toFixed(0)}%)</span>
                          <span className="category-row-amount">{formatCurrency(cat.total)}</span>
                        </div>
                        <div className="category-bar">
                          <div className={`category-bar-fill ${cat.color}`} style={{ width: `${cat.percentage}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="section-header" style={{ marginTop: '1rem' }}><h3>Insights</h3></div>
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon" style={{ background: 'rgba(124,58,237,0.15)' }}>💡</div>
                <div className="activity-info"><h4>Average Bill</h4><p>Across {bills.length} expenses</p></div>
                <div className="activity-amount share">{formatCurrency(avgPerBill)}</div>
              </div>
              <div className="activity-item">
                <div className="activity-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>🤝</div>
                <div className="activity-info"><h4>Split Partners</h4><p>Friends in your circle</p></div>
                <div className="activity-amount share">{friends.length}</div>
              </div>
              {categoryBreakdown[0] && (
                <div className="activity-item">
                  <div className={`activity-icon cat-${categoryBreakdown[0].id}`}>{categoryBreakdown[0].emoji}</div>
                  <div className="activity-info"><h4>Top Category</h4><p>{categoryBreakdown[0].name} · {categoryBreakdown[0].percentage.toFixed(0)}% of total</p></div>
                  <div className="activity-amount share">{formatCurrency(categoryBreakdown[0].total)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="bottom-nav">
            <div className="nav-item" onClick={() => setView('dashboard')}><span className="nav-icon">🏠</span>Home</div>
            <div className="nav-item" onClick={() => setView('friends')}><span className="nav-icon">👥</span>Friends</div>
            <div className="nav-item" onClick={() => setView('history')}><span className="nav-icon">🧾</span>History</div>
            <div className="nav-item" onClick={() => setView('profile')}><span className="nav-icon">👤</span>Profile</div>
          </div>
        </>
      )}

      {/* ════════════════ SETTINGS ════════════════ */}
      {view === 'settings' && user && (
        <div className="content-area">
          <div className="modal-header">
            <button className="back-btn" onClick={() => setView('profile')}>←</button>
            <h2>Settings</h2>
          </div>

          {/* Appearance */}
          <div className="settings-section">
            <div className="settings-section-title">Appearance</div>

            <div className="settings-item">
              <div className="settings-item-icon" style={{ background: 'rgba(124,58,237,0.12)' }}>
                {theme === 'dark' ? '🌙' : '☀️'}
              </div>
              <div className="settings-item-content">
                <h4>Dark Mode</h4>
                <p>Switch between dark and light themes</p>
              </div>
              <div className={`toggle-switch ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                <div className="toggle-knob" />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="settings-section">
            <div className="settings-section-title">Preferences</div>

            <div className="settings-item">
              <div className="settings-item-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>💱</div>
              <div className="settings-item-content">
                <h4>Currency</h4>
                <p>Select your preferred currency</p>
              </div>
              <div className="currency-options">
                {CURRENCIES.map(c => (
                  <button key={c.code} className={`currency-option ${currency === c.code ? 'active' : ''}`} onClick={() => { setCurrency(c.code); showToast(`Currency set to ${c.code}`); }}>
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>🎯</div>
              <div className="settings-item-content">
                <h4>Monthly Budget</h4>
                <p>{budgetNum > 0 ? `Currently ${formatCurrency(budgetNum)}` : 'Not set'}</p>
              </div>
              <div className="budget-input-group">
                <input type="number" placeholder={`${currencySymbol} 0`} value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} min="0" />
                <button className="budget-save-btn" onClick={handleSaveBudget}>Set</button>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>🔔</div>
              <div className="settings-item-content">
                <h4>Notifications</h4>
                <p>{notifications ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className={`toggle-switch ${notifications ? 'active' : ''}`} onClick={() => { setNotifications(n => !n); showToast(notifications ? '🔕 Notifications off' : '🔔 Notifications on'); }}>
                <div className="toggle-knob" />
              </div>
            </div>
          </div>

          {/* Data */}
          <div className="settings-section">
            <div className="settings-section-title">Data</div>

            <div className="settings-item" style={{ cursor: 'pointer' }} onClick={() => {
              const data = JSON.stringify({ bills, friends, currency, budget: monthlyBudget }, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `splitease-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              showToast('📥 Data exported!');
            }}>
              <div className="settings-item-icon" style={{ background: 'rgba(6,182,212,0.12)' }}>📥</div>
              <div className="settings-item-content">
                <h4>Export Data</h4>
                <p>Download your expenses as JSON</p>
              </div>
            </div>

            <button className="danger-btn" onClick={() => {
              if (window.confirm('Clear your monthly budget setting?')) {
                setMonthlyBudget('');
                localStorage.removeItem('splitease-budget');
                showToast('Budget cleared');
              }
            }}>
              Clear Budget
            </button>
          </div>

          <div className="app-version">
            SplitEase v2.0
            <span>Made with 💜 for smarter splitting</span>
          </div>
        </div>
      )}

      {/* ════════════════ HELP & SUPPORT ════════════════ */}
      {view === 'help' && user && (
        <div className="content-area">
          <div className="modal-header">
            <button className="back-btn" onClick={() => setView('profile')}>←</button>
            <h2>Help & Support</h2>
          </div>

          <div className="help-hero">
            <div className="help-hero-icon">💬</div>
            <h3>How can we help?</h3>
            <p>Browse FAQs below or reach out to us directly.</p>
          </div>

          {/* Contact Cards */}
          <div className="section-header"><h3>Get in Touch</h3></div>
          <div className="contact-grid">
            <a className="contact-card" href="mailto:support@splitease.app" target="_blank" rel="noopener noreferrer">
              <span className="contact-card-icon">📧</span>
              <span className="contact-card-title">Email</span>
              <span className="contact-card-desc">support@splitease.app</span>
            </a>
            <div className="contact-card" onClick={() => showToast('💬 Chat coming soon!')}>
              <span className="contact-card-icon">💬</span>
              <span className="contact-card-title">Live Chat</span>
              <span className="contact-card-desc">Available 9am–6pm</span>
            </div>
            <div className="contact-card" onClick={() => showToast('🐦 Follow us!')}>
              <span className="contact-card-icon">🐦</span>
              <span className="contact-card-title">Twitter</span>
              <span className="contact-card-desc">@splitease</span>
            </div>
            <div className="contact-card" onClick={() => showToast('📱 Opening WhatsApp...')}>
              <span className="contact-card-icon">📱</span>
              <span className="contact-card-title">WhatsApp</span>
              <span className="contact-card-desc">Quick support</span>
            </div>
          </div>

          {/* FAQ */}
          <div className="section-header"><h3>Frequently Asked Questions</h3></div>
          {FAQ_DATA.map((faq, idx) => (
            <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                {faq.q}
                <span className="faq-arrow">▼</span>
              </button>
              <div className="faq-answer">
                <div className="faq-answer-content">{faq.a}</div>
              </div>
            </div>
          ))}

          {/* Feedback */}
          <div className="section-header" style={{ marginTop: '1.5rem' }}><h3>Send Feedback</h3></div>
          <form className="feedback-form" onSubmit={handleSendFeedback}>
            <textarea placeholder="Tell us what you think, report a bug, or suggest a feature..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} required />
            <button type="submit" className="feedback-submit-btn">Send Feedback 🚀</button>
          </form>

          <div className="app-version">
            SplitEase v2.0 · Built with React + Firebase
            <span>We read every feedback message 💜</span>
          </div>
        </div>
      )}

      {/* ════════════════ PROFILE ════════════════ */}
      {view === 'profile' && user && (
        <>
          <div className="content-area">
            <div className="modal-header">
              <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
              <h2>Profile</h2>
            </div>

            <div className="profile-header">
              <div className="avatar avatar-large" style={{ margin: '0 auto 1rem' }}>{getInitials(user.name)}</div>
              <h3 className="profile-name">{user.name}</h3>
              <p className="profile-email">{user.email}</p>
            </div>

            <div className="profile-stats">
              <div className="profile-stat-card">
                <div className="profile-stat-value">{bills.length}</div>
                <div className="profile-stat-label">Expenses</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">{friends.length}</div>
                <div className="profile-stat-label">Friends</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">{formatCurrency(totalSaved)}</div>
                <div className="profile-stat-label">Saved</div>
              </div>
            </div>

            <div className="profile-menu">
              <div className="profile-menu-item" onClick={() => setView('analytics')}>
                <div className="profile-menu-icon" style={{ background: 'rgba(124,58,237,0.12)' }}>📊</div>
                <div className="profile-menu-text"><h4>Analytics</h4><p>View spending insights</p></div>
                <span className="profile-menu-arrow">→</span>
              </div>
              <div className="profile-menu-item" onClick={() => setView('history')}>
                <div className="profile-menu-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>🧾</div>
                <div className="profile-menu-text"><h4>All Expenses</h4><p>Browse your full history</p></div>
                <span className="profile-menu-arrow">→</span>
              </div>
              <div className="profile-menu-item" onClick={() => setView('friends')}>
                <div className="profile-menu-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>👥</div>
                <div className="profile-menu-text"><h4>Manage Friends</h4><p>{friends.length} friends in your circle</p></div>
                <span className="profile-menu-arrow">→</span>
              </div>
              <div className="profile-menu-item" onClick={() => setView('settings')}>
                <div className="profile-menu-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>⚙️</div>
                <div className="profile-menu-text"><h4>Settings</h4><p>Theme, currency, budget & more</p></div>
                <span className="profile-menu-arrow">→</span>
              </div>
              <div className="profile-menu-item" onClick={() => setView('help')}>
                <div className="profile-menu-icon" style={{ background: 'rgba(6,182,212,0.12)' }}>💬</div>
                <div className="profile-menu-text"><h4>Help & Support</h4><p>FAQs, feedback, contact us</p></div>
                <span className="profile-menu-arrow">→</span>
              </div>
            </div>

            <button className="logout-btn" onClick={() => { setUser(null); setView('login'); setFriends([]); }}>
              Sign Out
            </button>
          </div>

          <div className="bottom-nav">
            <div className="nav-item" onClick={() => setView('dashboard')}><span className="nav-icon">🏠</span>Home</div>
            <div className="nav-item" onClick={() => setView('friends')}><span className="nav-icon">👥</span>Friends</div>
            <div className="nav-item" onClick={() => setView('history')}><span className="nav-icon">🧾</span>History</div>
            <div className="nav-item active"><span className="nav-icon">👤</span>Profile</div>
          </div>
        </>
      )}
    </div>
  );
}