function switchTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        tabs[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('signupForm').classList.add('active');
    }

    clearMessages();
}

function showError(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

function showSuccess(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = `<div class="success-message">${message}</div>`;
}

function clearMessages() {
    document.getElementById('error-container').innerHTML = '';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        window.location.href = 'index.html';
    } catch (error) {
        showError(error.message || 'Ошибка входа. Проверьте email и пароль.');
    }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showError('Пароли не совпадают');
        return;
    }

    if (password.length < 6) {
        showError('Пароль должен содержать минимум 6 символов');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        showSuccess('Регистрация успешна! Проверьте email для подтверждения или войдите сразу.');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    } catch (error) {
        showError(error.message || 'Ошибка регистрации');
    }
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
    }
}

checkAuth();
