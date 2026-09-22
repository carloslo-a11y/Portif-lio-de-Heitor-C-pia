document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('cadastro-form');
  const nomeInput = document.getElementById('nome');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');
  const cadastroBtn = document.getElementById('cadastro-btn');

  function showError(text) {
    errorMsg.textContent = text;
    errorMsg.hidden = false;
    successMsg.hidden = true;
  }

  function showSuccess(text) {
    successMsg.textContent = text;
    successMsg.hidden = false;
    errorMsg.hidden = true;
  }

  function clearMessages() {
    errorMsg.hidden = true;
    successMsg.hidden = true;
  }

  [nomeInput, emailInput, passwordInput, document.getElementById('tipo')].forEach(input => {
    input.addEventListener('input', clearMessages);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const senha = passwordInput.value;
    const tipo = document.getElementById('tipo').value;

    if (!nome || !email || !senha) {
      showError('Todos os campos são obrigatórios.');
      return;
    }

    if (senha.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    cadastroBtn.classList.add('loading');
    cadastroBtn.textContent = 'Cadastrando...';

    try {
      // Verifica se o e-mail já existe no Supabase
      const { data: existingUser, error: checkError } = await _supabase
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        showError('E-mail já cadastrado.');
        return;
      }

      // Insere o novo utilizador na tabela do Supabase
      const { error: insertError } = await _supabase
        .from('usuarios')
        .insert([{ nome, email, senha, tipo }]);

      if (insertError) throw insertError;

      showSuccess('Cadastro realizado! Redirecionando...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } catch (err) {
      console.error(err);
      showError('Erro ao realizar o cadastro. Tente novamente.');
    } finally {
      cadastroBtn.classList.remove('loading');
      cadastroBtn.textContent = 'Cadastrar';
    }
  });
});