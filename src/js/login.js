document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('login-user');
  const passwordInput = document.getElementById('login-pass');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const capsLockWarning = document.getElementById('caps-lock-warning');
  const loginBtn = document.getElementById('login-btn');
  const btnText = loginBtn.querySelector('.btn-text');
  const spinner = document.getElementById('login-spinner');
  const alertBox = document.getElementById('login-alert');
  const alertMsg = document.getElementById('login-alert-msg');
  const rememberCheck = document.getElementById('remember-me');

  // 1. Cargar usuario recordado
  const savedUser = localStorage.getItem('remembered_user');
  if (savedUser) {
      usernameInput.value = savedUser;
      rememberCheck.checked = true;
      passwordInput.focus();
  } else {
      usernameInput.focus();
  }

  // 2. Toggle mostrar/ocultar contraseña
  togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePasswordBtn.querySelector('i').classList.toggle('fa-eye');
      togglePasswordBtn.querySelector('i').classList.toggle('fa-eye-slash');
  });

  // 3. Detección de Caps Lock
  passwordInput.addEventListener('keyup', (e) => {
      if (e.getModifierState('CapsLock')) {
          capsLockWarning.style.display = 'flex';
      } else {
          capsLockWarning.style.display = 'none';
      }
  });

  // 4. Manejo del Submit
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Reset UI
    alertBox.classList.add('d-none');
    setLoading(true);

    const user = usernameInput.value.trim();
    const pass = passwordInput.value;
    
    const res = await window.api.login({ username: user, password: pass });
    
    if (res.success) {
      // Guardar preferencia de usuario
      if (rememberCheck.checked) {
          localStorage.setItem('remembered_user', user);
      } else {
          localStorage.removeItem('remembered_user');
      }

      // Guardar sesión
      localStorage.setItem('user_id', res.user.id);
      localStorage.setItem('user_role', res.user.role);
      localStorage.setItem('user_name', res.user.name || res.user.username);
      
      // Marcar como logueado y redirigir directamente al módulo de caja
      // El valor inicial ahora se gestiona exclusivamente en cash_register.html
      localStorage.setItem('logueado', 'true');
      window.location.href = 'cash_register.html';
    } else {
      alertMsg.textContent = res.message || 'Usuario o contraseña incorrectos.';
      alertBox.classList.remove('d-none');
      passwordInput.value = '';
      passwordInput.focus();
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
      loginBtn.disabled = isLoading;
      if (isLoading) {
          btnText.classList.add('d-none');
          spinner.classList.remove('d-none');
      } else {
          btnText.classList.remove('d-none');
          spinner.classList.add('d-none');
      }
  }
});
