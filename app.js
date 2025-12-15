let expenses = [];
let filteredExpenses = [];

const expenseForm = document.getElementById('expenseForm');
const expensesList = document.getElementById('expensesList');
const categoryStats = document.getElementById('categoryStats');
const totalAmount = document.getElementById('totalAmount');
const filterCategory = document.getElementById('filterCategory');

async function initApp() {
    await loadExpenses();
    setupEventListeners();
}

function setupEventListeners() {
    expenseForm.addEventListener('submit', handleFormSubmit);
    filterCategory.addEventListener('change', handleFilterChange);
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const expense = {
        amount: parseFloat(formData.get('amount')),
        category: formData.get('category'),
        description: formData.get('description') || '',
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('expenses')
            .insert([expense])
            .select();

        if (error) throw error;

        expenseForm.reset();
        await loadExpenses();

    } catch (error) {
        console.error('Ошибка при добавлении расхода:', error);
        alert('Не удалось добавить расход. Проверьте подключение к базе данных.');
    }
}

async function loadExpenses() {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        expenses = data || [];
        filteredExpenses = expenses;

        renderExpenses();
        renderStats();

    } catch (error) {
        console.error('Ошибка при загрузке расходов:', error);
        expensesList.innerHTML = '<p class="no-data">Не удалось загрузить расходы. Убедитесь, что таблица "expenses" создана в Supabase.</p>';
        categoryStats.innerHTML = '<p class="no-data">Нет данных</p>';
    }
}

function handleFilterChange(e) {
    const selectedCategory = e.target.value;

    if (selectedCategory === 'all') {
        filteredExpenses = expenses;
    } else {
        filteredExpenses = expenses.filter(expense => expense.category === selectedCategory);
    }

    renderExpenses();
    renderStats();
}

function renderExpenses() {
    if (filteredExpenses.length === 0) {
        expensesList.innerHTML = '<p class="no-data">Нет расходов для отображения</p>';
        return;
    }

    expensesList.innerHTML = filteredExpenses.map(expense => `
        <div class="expense-item" data-id="${expense.id}">
            <div class="expense-date">
                ${formatDate(expense.created_at)}
            </div>
            <div class="expense-details">
                <div class="expense-category">${expense.category}</div>
                ${expense.description ? `<div class="expense-description">${expense.description}</div>` : ''}
            </div>
            <div class="expense-amount">${expense.amount.toFixed(2)} ₽</div>
            <button class="btn btn-danger" onclick="deleteExpense('${expense.id}')">Удалить</button>
        </div>
    `).join('');
}

function renderStats() {
    const stats = calculateCategoryStats();
    const total = calculateTotal();

    if (Object.keys(stats).length === 0) {
        categoryStats.innerHTML = '<p class="no-data">Нет данных для статистики</p>';
        totalAmount.textContent = '0.00';
        return;
    }

    categoryStats.innerHTML = Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => `
            <div class="stat-card">
                <h3>${category}</h3>
                <div class="amount">${amount.toFixed(2)} ₽</div>
            </div>
        `).join('');

    totalAmount.textContent = total.toFixed(2);
}

function calculateCategoryStats() {
    const stats = {};

    filteredExpenses.forEach(expense => {
        if (!stats[expense.category]) {
            stats[expense.category] = 0;
        }
        stats[expense.category] += expense.amount;
    });

    return stats;
}

function calculateTotal() {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

async function deleteExpense(id) {
    if (!confirm('Вы уверены, что хотите удалить этот расход?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadExpenses();

    } catch (error) {
        console.error('Ошибка при удалении расхода:', error);
        alert('Не удалось удалить расход');
    }
}

document.addEventListener('DOMContentLoaded', initApp);
