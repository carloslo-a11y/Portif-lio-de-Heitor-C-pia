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

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Preencha todos os campos.');
      return;
    }

    accessBtn.classList.add('loading');
    accessBtn.textContent = 'Entrando...';

    try {
      // Consulta o utilizador diretamente na tabela do Supabase
      const { data: user, error } = await _supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('senha', password)
        .maybeSingle();

      if (error) throw error;

      if (!user) {
        showError('E-mail ou senha incorretos.');
        return;
      }

      localStorage.setItem('user', JSON.stringify({
        id: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo
      }));

      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      showError('Erro ao efetuar login. Verifique a sua ligação.');
    } finally {
      accessBtn.classList.remove('loading');
      accessBtn.textContent = 'Acessar';
    }
  });
});