document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorMsg = document.getElementById('login-error');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (user === 'admin' && pass === '12345') {
      errorMsg.style.display = 'none';
      showStartDayModal();
    } else {
      errorMsg.textContent = 'Usuario o contraseña incorrectos.';
      errorMsg.style.display = 'block';
    }
  });
});

function showStartDayModal() {
  // Crear modal Bootstrap
  const modalHtml = `
    <div class="modal fade" id="startDayModal" tabindex="-1" aria-labelledby="startDayLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="startDayLabel">Valor inicial del día</h5>
          </div>
          <div class="modal-body">
            <label class="form-label">Ingrese el valor con el que inicia el día:</label>
            <input id="start-day-value" type="number" class="form-control" min="0" autofocus required>
          </div>
          <div class="modal-footer">
            <button id="start-day-btn" class="btn btn-primary">Continuar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = new bootstrap.Modal(document.getElementById('startDayModal'));
  modal.show();
  document.getElementById('start-day-btn').onclick = () => {
    const value = document.getElementById('start-day-value').value;
    if (value === '' || isNaN(value) || Number(value) < 0) {
      document.getElementById('start-day-value').classList.add('is-invalid');
      return;
    }
    // Guardar valor inicial del día y estado de login
    localStorage.setItem('valor_inicial_dia', value);
    localStorage.setItem('logueado', 'true');
    modal.hide();
    window.location.href = 'index.html';
  };
}
