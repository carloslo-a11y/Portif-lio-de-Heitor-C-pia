document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorMsg = document.getElementById('error-msg');
  const accessBtn = document.getElementById('access-btn');

  function showError(text) {
    errorMsg.textContent = text;
    errorMsg.hidden = false;
    emailInput.classList.add('invalid');
    passwordInput.classList.add('invalid');
  }

  function clearError() {
    errorMsg.hidden = true;
    emailInput.classList.remove('invalid');
    passwordInput.classList.remove('invalid');
  }

  [emailInput, passwordInput].forEach(input => {
    input.addEventListener('input', clearError);
  });

form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        if (!window.SB || !window.SB.ready()) {
            showError(window._supabaseError || 'Falha de conexão com o banco. Recarregue a página e tente novamente.');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

    if (!email || !password) {
      showError('Preencha todos os campos.');
      return;
    }

    accessBtn.classList.add('loading');
    accessBtn.textContent = 'Entrando...';

    try {
      const user = await window.SB.login(email, password);

      if (!user) {
        showError('E-mail ou senha incorretos.');
        return;
      }

      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      showError(window.SB ? window.SB.msgErro(err) : 'Erro ao efetuar login.');
    } finally {
      accessBtn.classList.remove('loading');
      accessBtn.textContent = 'Acessar';
    }
  });
});