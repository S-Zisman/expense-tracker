let expenses = [];
let filteredExpenses = [];
let currentSortBy = 'date-desc';
let currentDate = new Date();
let selectedDate = null;

const expenseForm = document.getElementById('expenseForm');
const expensesList = document.getElementById('expensesList');
const categoryStats = document.getElementById('categoryStats');
const totalAmount = document.getElementById('totalAmount');
const filterCategory = document.getElementById('filterCategory');
const sortBy = document.getElementById('sortBy');
const calendar = document.getElementById('calendar');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

async function initApp() {
    await loadExpenses();
    setupEventListeners();
    renderCalendar();
    setDefaultDate();
}

function setDefaultDate() {
    const dateInput = document.getElementById('expenseDate');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    dateInput.value = formattedDate;
}

function setupEventListeners() {
    expenseForm.addEventListener('submit', handleFormSubmit);
    filterCategory.addEventListener('change', handleFilterChange);
    sortBy.addEventListener('change', handleSortChange);
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const selectedDate = formData.get('expenseDate');
    const dateTime = new Date(selectedDate + 'T' + new Date().toTimeString().split(' ')[0]);

    const expense = {
        amount: parseFloat(formData.get('amount')),
        category: formData.get('category'),
        description: formData.get('description') || '',
        created_at: dateTime.toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('expenses')
            .insert([expense])
            .select();

        if (error) throw error;

        expenseForm.reset();
        setDefaultDate();
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
        filteredExpenses = [...expenses];

        applySort();
        renderExpenses();
        renderStats();
        renderCalendar();

    } catch (error) {
        console.error('Ошибка при загрузке расходов:', error);
        expensesList.innerHTML = '<p class="no-data">Не удалось загрузить расходы. Убедитесь, что таблица "expenses" создана в Supabase.</p>';
        categoryStats.innerHTML = '<p class="no-data">Нет данных</p>';
    }
}

function handleFilterChange(e) {
    const selectedCategory = e.target.value;

    if (selectedCategory === 'all') {
        filteredExpenses = [...expenses];
    } else {
        filteredExpenses = expenses.filter(expense => expense.category === selectedCategory);
    }

    applySort();
    renderExpenses();
    renderStats();
}

function handleSortChange(e) {
    currentSortBy = e.target.value;
    applySort();
    renderExpenses();
}

function applySort() {
    switch (currentSortBy) {
        case 'date-desc':
            filteredExpenses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'date-asc':
            filteredExpenses.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'amount-desc':
            filteredExpenses.sort((a, b) => b.amount - a.amount);
            break;
        case 'amount-asc':
            filteredExpenses.sort((a, b) => a.amount - b.amount);
            break;
        case 'category':
            filteredExpenses.sort((a, b) => a.category.localeCompare(b.category, 'ru'));
            break;
    }
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
            <div class="expense-amount">${expense.amount.toFixed(2)} ₪</div>
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
                <div class="amount">${amount.toFixed(2)} ₪</div>
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

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    currentMonthEl.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const days = [];

    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(header => {
        days.push(`<div class="calendar-day-header">${header}</div>`);
    });

    for (let i = startDay; i > 0; i--) {
        const day = prevLastDay.getDate() - i + 1;
        days.push(`<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayExpenses = expenses.filter(exp => exp.created_at.startsWith(dateStr));
        const totalAmount = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        const hasExpenses = dayExpenses.length > 0;
        const isSelected = selectedDate === dateStr;

        days.push(`
            <div class="calendar-day ${hasExpenses ? 'has-expenses' : ''} ${isSelected ? 'selected' : ''}"
                 onclick="selectCalendarDay('${dateStr}')">
                <div class="day-number">${day}</div>
                ${hasExpenses ? `<div class="day-amount">${totalAmount.toFixed(0)} ₪</div>` : ''}
            </div>
        `);
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
        days.push(`<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`);
    }

    calendar.innerHTML = days.join('');
}

function selectCalendarDay(dateStr) {
    selectedDate = dateStr;
    renderCalendar();

    filteredExpenses = expenses.filter(exp => exp.created_at.startsWith(dateStr));

    if (filteredExpenses.length > 0) {
        applySort();
        renderExpenses();
        renderStats();

        document.querySelector('.expenses-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        expensesList.innerHTML = '<p class="no-data">Нет расходов за выбранную дату</p>';
        categoryStats.innerHTML = '<p class="no-data">Нет данных</p>';
        totalAmount.textContent = '0.00';
    }
}

document.addEventListener('DOMContentLoaded', initApp);
