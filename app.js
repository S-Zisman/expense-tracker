let expenses = [];
let filteredExpenses = [];
let currentSortBy = 'date-desc';
let currentDate = new Date();
let selectedDate = null;
let currentUser = null;
let currentCurrency = 'ILS';
let exchangeRates = {};
let selectedModalCurrency = null;
let userCategories = [];

const currencySymbols = {
    'ILS': '₪',
    'USD': '$',
    'RUB': '₽',
    'EUR': '€'
};

// API для получения курсов валют (бесплатный, без ключа)
const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/';

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
const expenseCurrencySelect = document.getElementById('expenseCurrency');

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'auth.html';
        return false;
    }
    currentUser = session.user;
    return true;
}

async function initApp() {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;

    setupUserInfo();
    await checkAndSetupDefaultCurrency();
    await loadUserCategories();
    await loadExchangeRates();
    await loadExpenses();
    setupEventListeners();
    setupModalListeners();
    renderCalendar();
    setDefaultDate();
}

function setupUserInfo() {
    const header = document.querySelector('header');
    const userInfo = document.createElement('div');
    userInfo.style.cssText = 'text-align: center; margin-top: 15px;';
    userInfo.innerHTML = `
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 10px;">
            ${currentUser.email}
        </p>
        <button onclick="handleLogout()" class="btn" style="padding: 8px 20px; font-size: 0.85rem; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;">
            Выйти
        </button>
    `;
    header.appendChild(userInfo);
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'auth.html';
}

function setDefaultDate() {
    const dateInput = document.getElementById('expenseDate');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    dateInput.value = formattedDate;
}

// Проверяем и настраиваем валюту по умолчанию
async function checkAndSetupDefaultCurrency() {
    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('default_currency')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (data) {
            currentCurrency = data.default_currency;
            expenseCurrencySelect.value = currentCurrency;
        } else {
            showCurrencyModal();
        }

        updateCurrencyDisplay();
    } catch (error) {
        console.error('Ошибка при загрузке настроек валюты:', error);
        showCurrencyModal();
    }
}

// Показываем модальное окно выбора валюты
function showCurrencyModal() {
    const modal = document.getElementById('currencyModal');
    modal.classList.add('show');
}

// Настройка слушателей для модального окна
function setupModalListeners() {
    const currencyOptions = document.querySelectorAll('.currency-option');
    const saveCurrencyBtn = document.getElementById('saveCurrencyBtn');

    currencyOptions.forEach(option => {
        option.addEventListener('click', () => {
            currencyOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedModalCurrency = option.dataset.currency;
            saveCurrencyBtn.disabled = false;
        });
    });

    saveCurrencyBtn.addEventListener('click', async () => {
        if (selectedModalCurrency) {
            await saveDefaultCurrency(selectedModalCurrency);
            currentCurrency = selectedModalCurrency;
            expenseCurrencySelect.value = currentCurrency;
            updateCurrencyDisplay();
            document.getElementById('currencyModal').classList.remove('show');
            await loadExpenses();
        }
    });
}

// Сохранение основной валюты пользователя в базу
async function saveDefaultCurrency(currency) {
    try {
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: currentUser.id,
                default_currency: currency,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) throw error;
    } catch (error) {
        console.error('Ошибка при сохранении валюты:', error);
        alert('Не удалось сохранить настройки валюты');
    }
}

// Загрузка курсов валют
async function loadExchangeRates() {
    try {
        const response = await fetch(`${EXCHANGE_API_URL}${currentCurrency}`);
        const data = await response.json();

        if (data.result === 'success') {
            exchangeRates = data.rates;
        } else {
            console.error('Ошибка загрузки курсов валют');
            exchangeRates = { ILS: 1, USD: 1, RUB: 1, EUR: 1 };
        }
    } catch (error) {
        console.error('Ошибка при загрузке курсов валют:', error);
        exchangeRates = { ILS: 1, USD: 1, RUB: 1, EUR: 1 };
    }
}

// Конвертация суммы из одной валюты в другую
function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;

    if (!exchangeRates[toCurrency]) {
        return amount;
    }

    if (fromCurrency === currentCurrency) {
        return amount * exchangeRates[toCurrency];
    }

    const amountInBaseCurrency = amount / exchangeRates[fromCurrency];
    return amountInBaseCurrency;
}

// Конвертация расхода в основную валюту пользователя
function convertToUserCurrency(expense) {
    const expenseCurrency = expense.currency || currentCurrency;
    return convertCurrency(expense.amount, expenseCurrency, currentCurrency);
}

function updateCurrencyDisplay() {
    const symbol = currencySymbols[currentCurrency];
    const totalCurrency = document.getElementById('totalCurrency');

    if (totalCurrency) {
        totalCurrency.textContent = symbol;
    }
}

function getCurrencySymbol(currency = null) {
    return currencySymbols[currency || currentCurrency];
}

// ============ УПРАВЛЕНИЕ КАТЕГОРИЯМИ ============

// Загрузка категорий пользователя
async function loadUserCategories() {
    try {
        const { data, error } = await supabase
            .from('user_categories')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('name');

        if (error) throw error;

        userCategories = data || [];

        // Если у пользователя нет категорий, создаем стандартные
        if (userCategories.length === 0) {
            await createDefaultCategories();
            await loadUserCategories();
        } else {
            updateCategorySelects();
        }
    } catch (error) {
        console.error('Ошибка при загрузке категорий:', error);
        userCategories = [];
    }
}

// Создание стандартных категорий для нового пользователя
async function createDefaultCategories() {
    const defaultCategories = [
        'Продукты',
        'Транспорт',
        'Развлечения',
        'Путешествия',
        'Здоровье',
        'Одежда',
        'Образование',
        'Коммунальные услуги',
        'Другое'
    ];

    try {
        const categories = defaultCategories.map(name => ({
            user_id: currentUser.id,
            name: name
        }));

        const { error } = await supabase
            .from('user_categories')
            .insert(categories);

        if (error) throw error;
    } catch (error) {
        console.error('Ошибка при создании стандартных категорий:', error);
    }
}

// Обновление выпадающих списков категорий
function updateCategorySelects() {
    const categorySelect = document.getElementById('category');
    const filterCategorySelect = document.getElementById('filterCategory');

    // Обновляем основной селект
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    userCategories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });

    // Обновляем фильтр
    filterCategorySelect.innerHTML = '<option value="all">Все категории</option>';
    userCategories.forEach(cat => {
        filterCategorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
}

// Показать модальное окно управления категориями
function showCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    modal.classList.add('show');
    renderCategoriesList();
}

// Закрыть модальное окно категорий
function closeCategoriesModal() {
    const modal = document.getElementById('categoriesModal');
    modal.classList.remove('show');
    document.getElementById('newCategoryInput').value = '';
}

// Отображение списка категорий в модальном окне
function renderCategoriesList() {
    const list = document.getElementById('categoriesList');

    if (userCategories.length === 0) {
        list.innerHTML = '<p class="no-data">Нет категорий</p>';
        return;
    }

    list.innerHTML = userCategories.map(cat => `
        <div class="category-item" id="cat-${cat.id}">
            <span class="category-name">${cat.name}</span>
            <div class="category-actions">
                <button class="btn btn-edit" onclick="editCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')">
                    Изменить
                </button>
                <button class="btn btn-delete" onclick="deleteCategory('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')">
                    Удалить
                </button>
            </div>
        </div>
    `).join('');
}

// Добавление новой категории
async function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const name = input.value.trim();

    if (!name) {
        alert('Введите название категории');
        return;
    }

    // Проверка на дубликат
    if (userCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        alert('Категория с таким названием уже существует');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('user_categories')
            .insert([{
                user_id: currentUser.id,
                name: name
            }])
            .select();

        if (error) throw error;

        input.value = '';
        await loadUserCategories();
        renderCategoriesList();
    } catch (error) {
        console.error('Ошибка при добавлении категории:', error);
        alert('Не удалось добавить категорию');
    }
}

// Редактирование категории
function editCategory(id, currentName) {
    const item = document.getElementById(`cat-${id}`);
    item.classList.add('editing');

    item.innerHTML = `
        <input type="text" class="category-name-input" id="edit-input-${id}" value="${currentName}" maxlength="50">
        <div class="category-actions">
            <button class="btn btn-save" onclick="saveCategory('${id}')">
                Сохранить
            </button>
            <button class="btn btn-cancel" onclick="cancelEdit('${id}', '${currentName.replace(/'/g, "\\'")}')">
                Отмена
            </button>
        </div>
    `;

    document.getElementById(`edit-input-${id}`).focus();
}

// Отмена редактирования
function cancelEdit(id, originalName) {
    const item = document.getElementById(`cat-${id}`);
    item.classList.remove('editing');
    renderCategoriesList();
}

// Сохранение отредактированной категории
async function saveCategory(id) {
    const input = document.getElementById(`edit-input-${id}`);
    const newName = input.value.trim();

    if (!newName) {
        alert('Название категории не может быть пустым');
        return;
    }

    // Проверка на дубликат (исключая текущую категорию)
    if (userCategories.some(cat => cat.id !== id && cat.name.toLowerCase() === newName.toLowerCase())) {
        alert('Категория с таким названием уже существует');
        return;
    }

    try {
        // Получаем старое название категории
        const oldCategory = userCategories.find(cat => cat.id === id);
        const oldName = oldCategory.name;

        // Обновляем категорию
        const { error: updateError } = await supabase
            .from('user_categories')
            .update({ name: newName })
            .eq('id', id);

        if (updateError) throw updateError;

        // Обновляем категории во всех расходах с таким названием
        const { error: expensesError } = await supabase
            .from('expenses')
            .update({ category: newName })
            .eq('user_id', currentUser.id)
            .eq('category', oldName);

        if (expensesError) throw expensesError;

        await loadUserCategories();
        await loadExpenses();
        renderCategoriesList();
    } catch (error) {
        console.error('Ошибка при сохранении категории:', error);
        alert('Не удалось сохранить категорию');
    }
}

// Удаление категории
async function deleteCategory(id, name) {
    // Проверяем, есть ли расходы с этой категорией
    const expensesWithCategory = expenses.filter(exp => exp.category === name);

    if (expensesWithCategory.length > 0) {
        const confirm = window.confirm(
            `У вас есть ${expensesWithCategory.length} расход(ов) в категории "${name}". ` +
            `Удаление категории переместит эти расходы в категорию "Другое". Продолжить?`
        );

        if (!confirm) return;

        // Переносим расходы в категорию "Другое"
        try {
            const { error: updateError } = await supabase
                .from('expenses')
                .update({ category: 'Другое' })
                .eq('user_id', currentUser.id)
                .eq('category', name);

            if (updateError) throw updateError;
        } catch (error) {
            console.error('Ошибка при переносе расходов:', error);
            alert('Не удалось перенести расходы');
            return;
        }
    } else {
        if (!window.confirm(`Удалить категорию "${name}"?`)) {
            return;
        }
    }

    try {
        const { error } = await supabase
            .from('user_categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadUserCategories();
        await loadExpenses();
        renderCategoriesList();
    } catch (error) {
        console.error('Ошибка при удалении категории:', error);
        alert('Не удалось удалить категорию');
    }
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
        currency: formData.get('expenseCurrency'),
        created_at: dateTime.toISOString(),
        user_id: currentUser.id
    };

    try {
        const { data, error } = await supabase
            .from('expenses')
            .insert([expense])
            .select();

        if (error) throw error;

        expenseForm.reset();
        setDefaultDate();
        expenseCurrencySelect.value = currentCurrency;
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
            .eq('user_id', currentUser.id)
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

    expensesList.innerHTML = filteredExpenses.map(expense => {
        const expenseCurrency = expense.currency || currentCurrency;
        const expenseSymbol = getCurrencySymbol(expenseCurrency);
        const convertedAmount = convertToUserCurrency(expense);
        const showConversion = expenseCurrency !== currentCurrency;

        return `
            <div class="expense-item" data-id="${expense.id}">
                <div class="expense-date">
                    ${formatDate(expense.created_at)}
                </div>
                <div class="expense-details">
                    <div class="expense-category">${expense.category}</div>
                    ${expense.description ? `<div class="expense-description">${expense.description}</div>` : ''}
                </div>
                <div class="expense-amount">
                    ${expense.amount.toFixed(2)} ${expenseSymbol}
                    ${showConversion ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">(≈ ${convertedAmount.toFixed(2)} ${getCurrencySymbol()})</div>` : ''}
                </div>
                <button class="btn btn-danger" onclick="deleteExpense('${expense.id}')">Удалить</button>
            </div>
        `;
    }).join('');
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
                <div class="amount">${amount.toFixed(2)} ${getCurrencySymbol()}</div>
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
        const convertedAmount = convertToUserCurrency(expense);
        stats[expense.category] += convertedAmount;
    });

    return stats;
}

function calculateTotal() {
    return filteredExpenses.reduce((sum, expense) => {
        const convertedAmount = convertToUserCurrency(expense);
        return sum + convertedAmount;
    }, 0);
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
        const totalAmount = dayExpenses.reduce((sum, exp) => {
            return sum + convertToUserCurrency(exp);
        }, 0);

        const hasExpenses = dayExpenses.length > 0;
        const isSelected = selectedDate === dateStr;

        days.push(`
            <div class="calendar-day ${hasExpenses ? 'has-expenses' : ''} ${isSelected ? 'selected' : ''}"
                 onclick="selectCalendarDay('${dateStr}')">
                <div class="day-number">${day}</div>
                ${hasExpenses ? `<div class="day-amount">${totalAmount.toFixed(0)} ${getCurrencySymbol()}</div>` : ''}
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
