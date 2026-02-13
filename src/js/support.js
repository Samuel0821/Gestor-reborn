document.addEventListener('DOMContentLoaded', () => {
  // Layout manejado por layout.js

  // Lógica del formulario de soporte
  const form = document.getElementById('support-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('support-subject').value;
    const message = document.getElementById('support-message').value;
    
    const result = await window.api.sendSupportTicket({ subject, message });
    if(result.success) {
        Swal.fire({
            icon: 'success',
            title: 'Acción completada',
            text: 'Se ha abierto tu cliente de correo para que envíes el reporte.',
            timer: 3000,
            showConfirmButton: false
        });
        form.reset();
    }
  });
});