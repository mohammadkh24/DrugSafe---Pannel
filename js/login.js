(() => {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const message = document.getElementById('loginMessage');
  const button = document.getElementById('loginButton');

  if (localStorage.getItem('drugSafeAccessToken')) {
    window.location.replace('index.html');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.classList.remove('show');
    button.disabled = true;
    button.textContent = 'در حال ورود...';

    try {
      const response = await fetch(`${window.API_BASE_URL || 'http://localhost:3000'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim().toLowerCase(),
          password: passwordInput.value,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = Array.isArray(result.message)
          ? result.message.join('، ')
          : result.message || 'ایمیل یا رمز عبور اشتباه است.';
        throw new Error(errorMessage);
      }

      const payload = result.data ?? result;
      if (!payload.accessToken) throw new Error('توکن ورود از سرور دریافت نشد.');
      localStorage.setItem('drugSafeAccessToken', payload.accessToken);
      localStorage.setItem('drugSafeUser', JSON.stringify(payload.user ?? {}));
      window.location.replace('index.html');
    } catch (error) {
      message.textContent = error.message || 'ورود انجام نشد. اتصال سرور را بررسی کنید.';
      message.classList.add('show');
    } finally {
      button.disabled = false;
      button.innerHTML = 'ورود به پنل <span>←</span>';
    }
  });
})();