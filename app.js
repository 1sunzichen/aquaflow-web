// AQUAFLOW_OS Core Logic

function switchModule(moduleId) {
    // Update modules
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    const target = document.getElementById(moduleId);
    if (target) target.classList.add('active');

    // Update nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(moduleId)) {
            link.classList.add('active');
        }
    });

    // Close any open modals
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// System Time Update
function updateTime() {
    const timeEl = document.getElementById('system-time');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = `TIMESTAMP: ${now.getFullYear()}.${String(now.getMonth()+1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
}

// Initializations
window.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);

    // Close modal on outside click
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    }
});
