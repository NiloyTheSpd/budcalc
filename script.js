// Full frontend-only script with localStorage
// User auth
let currentUser = localStorage.getItem('currentUser');
const users = JSON.parse(localStorage.getItem('users')) || {};
let currency = localStorage.getItem('currency') || '$';

// Validate currentUser
if (currentUser && !users[currentUser]) {
    localStorage.removeItem('currentUser');
    currentUser = null;
}

// Theme
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && prefersDark)) {
    document.documentElement.classList.add('dark');
}
const themeIcon = document.getElementById('theme-icon');
themeIcon.className = document.documentElement.classList.contains('dark') ? 'fas fa-sun' : 'fas fa-moon';

document.querySelector('.theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
});

// PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered'));
}

// Mobile navbar
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('hidden');
            navMenu.classList.add('flex', 'flex-col', 'absolute', 'top-full', 'left-0', 'w-full', 'bg-blue-500', 'p-4', 'space-y-4');
        });
    }
});

// Redirect if not logged in
if (!currentUser && !window.location.pathname.endsWith('login.html')) {
    window.location.href = 'login.html';
}

if (currentUser) {
    const userData = users[currentUser];
    let transactions = userData.transactions || [];
    let budgets = userData.budgets || {};
    let goals = userData.goals || {};

    function saveData() {
        users[currentUser].transactions = transactions;
        users[currentUser].budgets = budgets;
        users[currentUser].goals = goals;
        localStorage.setItem('users', JSON.stringify(users));
    }

    function calculateBalance() {
        return transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    }

    function getMonthlyData() {
        const monthly = {};
        transactions.forEach(t => {
            const month = new Date(t.date).toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!monthly[month]) monthly[month] = { income: 0, expense: 0 };
            monthly[month][t.type] += t.amount;
        });
        return monthly;
    }

    function getCategoryData(type) {
        const cats = {};
        transactions.filter(t => t.type === type).forEach(t => {
            cats[t.category] = (cats[t.category] || 0) + t.amount;
        });
        return cats;
    }

    function checkBudgetOverrun(category, spent) {
        if (budgets[category]) {
            const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
            const monthSpent = transactions.filter(t => t.category === category && new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' }) === currentMonth).reduce((acc, t) => acc + t.amount, 0);
            if (monthSpent > budgets[category]) {
                alert(`Budget overrun for ${category}! Spent: ${monthSpent}, Budget: ${budgets[category]}`);
            }
        }
    }

    // Transaction form
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('amount').value);
            const category = document.getElementById('category').value;
            const date = document.getElementById('date').value;
            const notes = document.getElementById('notes').value;
            transactions.push({ type: 'expense', amount, category, date, notes });
            saveData();
            const spent = transactions.filter(t => t.category === category && new Date(t.date).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.amount, 0);
            checkBudgetOverrun(category, spent);
            renderTransactions();
            transactionForm.reset();
        });

        document.getElementById('search')?.addEventListener('input', renderTransactions);
    }

    // Salary form
    const salaryForm = document.getElementById('salary-form');
    if (salaryForm) {
        salaryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('salary-amount').value);
            const date = document.getElementById('salary-date').value;
            const notes = document.getElementById('salary-notes').value || 'Salary';
            transactions.push({ type: 'income', amount, date, notes });
            saveData();
            document.getElementById('balance').textContent = calculateBalance();
            renderTransactions();
            salaryForm.reset();
        });
    }

    function renderTransactions() {
        const list = document.getElementById('transaction-list');
        if (!list || !transactions) return;
        list.innerHTML = '';
        const search = document.getElementById('search')?.value.toLowerCase() || '';
        transactions.filter(t => (t.notes.toLowerCase().includes(search) || (t.category && t.category.toLowerCase().includes(search)))).forEach(t => {
            const li = document.createElement('li');
            li.classList.add(t.type);
            li.innerHTML = `${t.date} - ${t.category || t.notes} - ${t.amount} (${t.type})`;
            list.appendChild(li);
        });
    }

    // Budget form
    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
        budgetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const category = document.getElementById('budget-category').value;
            const amount = parseFloat(document.getElementById('budget-amount').value);
            budgets[category] = amount;
            saveData();
            renderBudgets();
            budgetForm.reset();
        });
    }

    function renderBudgets() {
        const list = document.querySelector('.budget-list');
        if (!list || !budgets) return;
        list.innerHTML = '';
        Object.keys(budgets).forEach(cat => {
            const spent = transactions.filter(t => t.category === cat && t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth()).reduce((acc, t) => acc + t.amount, 0);
            const div = document.createElement('div');
            div.innerHTML = `<p>${cat}: Budget ${budgets[cat]}, Spent ${spent}</p>
                <div class="progress-bar"><div class="progress" style="width: ${(spent / budgets[cat]) * 100 || 0}%"></div></div>`;
            if (spent > budgets[cat]) div.classList.add('overrun');
            list.appendChild(div);
        });
    }

    // Dashboard
    if (document.getElementById('balance')) {
        document.getElementById('balance').textContent = calculateBalance();
        const recentList = document.getElementById('recent-list');
        transactions.slice(-5).forEach(t => {
            const li = document.createElement('li');
            li.classList.add(t.type);
            li.textContent = `${t.date} - ${t.amount} (${t.category || t.notes})`;
            recentList.appendChild(li);
        });

        // Backup reminder (only on dashboard, once per session)
        function showBackupReminder() {
            if (window.location.pathname.endsWith('index.html') && !sessionStorage.getItem('backupReminderShown')) {
                const lastExport = localStorage.getItem('lastExport');
                if (!lastExport || (Date.now() - parseInt(lastExport) > 7 * 24 * 60 * 60 * 1000)) {
                    alert('Remember to export your data for backup!');
                    sessionStorage.setItem('backupReminderShown', 'true');
                }
            }
        }
        showBackupReminder();

        // Dashboard chart
        if (document.getElementById('dashboardChart')) {
            const ctx = document.getElementById('dashboardChart').getContext('2d');
            const catData = getCategoryData('expense');
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(catData),
                    datasets: [{ data: Object.values(catData), backgroundColor: ['#ff6384', '#36a2eb', '#ffce56'] }]
                }
            });
        }

        renderBudgets();
    }

    // Reports
    if (document.getElementById('monthlyLine')) {
        const monthlyData = getMonthlyData();
        const labels = Object.keys(monthlyData);
        const incomeData = labels.map(m => monthlyData[m].income);
        const expenseData = labels.map(m => monthlyData[m].expense);

        if (document.getElementById('monthlyLine')) {
            new Chart(document.getElementById('monthlyLine').getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Income', data: incomeData, borderColor: 'green' },
                        { label: 'Expense', data: expenseData, borderColor: 'red' }
                    ]
                }
            });
        }

        if (document.getElementById('categoryPie')) {
            const catData = getCategoryData('expense');
            new Chart(document.getElementById('categoryPie').getContext('2d'), {
                type: 'pie',
                data: {
                    labels: Object.keys(catData),
                    datasets: [{ data: Object.values(catData), backgroundColor: ['#ff6384', '#36a2eb', '#ffce56'] }]
                }
            });
        }
    }

    // Data export/import
    if (document.getElementById('export-btn')) {
        document.getElementById('export-btn').addEventListener('click', () => {
            const data = JSON.stringify({ transactions, budgets, goals });
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'finance-data.json';
            a.click();
            localStorage.setItem('lastExport', Date.now());
        });

        document.getElementById('import-btn').addEventListener('click', () => {
            const file = document.getElementById('import-file').files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imported = JSON.parse(e.target.result);
                    transactions = imported.transactions || [];
                    budgets = imported.budgets || {};
                    goals = imported.goals || {};
                    saveData();
                    renderTransactions();
                    renderBudgets();
                };
                reader.readAsText(file);
            }
        });
    }

    // Initial renders
    renderTransactions();
    renderBudgets();
}