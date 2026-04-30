// Profile page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Check authentication
  if (!Auth.requireAuth()) return;

  // Load user data
  loadUserData();

  // Setup event listeners
  setupEventListeners();
});

let currentUser = null;
let pendingAction = null;

async function loadUserData() {
  try {
    const res = await fetch(`${API_URL}/me`, { headers: Auth.authHeaders() });
    if (!res.ok) {
      if (res.status === 401) {
        Auth.logout();
        return;
      }
      throw new Error('Erreur lors du chargement des données');
    }

    currentUser = await res.json();

    // Update UI
    const usernameDisplay = document.getElementById('usernameDisplay');
    const displayUsername = document.getElementById('displayUsername');
    const displayAddress = document.getElementById('displayAddress');

    if (usernameDisplay) {
      usernameDisplay.textContent = currentUser.username || '';
    }

    if (displayUsername) {
      displayUsername.textContent = currentUser.username || '-';
    }

    if (displayAddress) {
      displayAddress.textContent = currentUser.start_address || 'Non définie';
    }

    // Pre-fill form with current data
    const newAddressInput = document.getElementById('newAddress');
    if (newAddressInput && currentUser.start_address) {
      newAddressInput.value = currentUser.start_address;
    }

  } catch (err) {
    console.error('[Profile] Erreur chargement données:', err);
    showStatus('Erreur lors du chargement des données du profil', true);
  }
}

function setupEventListeners() {
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => Auth.logout());
  }

  // Profile form submission
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  // Danger zone buttons
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      showConfirmModal(
        'Supprimer l\'historique',
        'Êtes-vous sûr de vouloir supprimer tout votre historique de recherches et les prospects déjà vus ? Cette action est irréversible.',
        clearHistory
      );
    });
  }

  const clearParcoursBtn = document.getElementById('clearParcoursBtn');
  if (clearParcoursBtn) {
    clearParcoursBtn.addEventListener('click', () => {
      showConfirmModal(
        'Supprimer le parcours',
        'Êtes-vous sûr de vouloir supprimer tous les prospects de votre parcours ? Cette action est irréversible.',
        clearParcours
      );
    });
  }

  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => {
      showConfirmModal(
        'Supprimer le compte',
        'Êtes-vous ABSOLUMENT SÛR de vouloir supprimer votre compte ? Cette action est IRRÉVERSIBLE et supprimera :\n\n• Votre compte utilisateur\n• Tous les prospects de votre parcours\n• Tout votre historique de recherches\n• Tous les prospects déjà vus\n\nIl n\'y a pas de retour en arrière possible.',
        deleteAccount,
        true
      );
    });
  }

  // Modal buttons
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', hideConfirmModal);
  }

  const modalConfirmBtn = document.getElementById('modalConfirmBtn');
  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', executePendingAction);
  }

  const modalBackdrop = document.querySelector('.modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', hideConfirmModal);
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();

  const newUsername = document.getElementById('newUsername').value.trim();
  const currentPassword = document.getElementById('currentPassword').value;
  const newAddress = document.getElementById('newAddress').value.trim();

  // Validate
  if (!newUsername && !newAddress) {
    showStatus('Veuillez remplir au moins un champ à modifier', true);
    return;
  }

  if (newUsername && newUsername.length < 3) {
    showStatus('Le nouveau nom d\'utilisateur doit faire au moins 3 caractères', true);
    return;
  }

  if (newUsername && !currentPassword) {
    showStatus('Veuillez entrer votre mot de passe actuel pour changer le nom d\'utilisateur', true);
    return;
  }

  try {
    // Update address if changed
    if (newAddress && newAddress !== currentUser.start_address) {
      const res = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: Auth.authHeaders(),
        body: JSON.stringify({ start_address: newAddress })
      });

      if (!res.ok) throw new Error('Erreur lors de la mise à jour de l\'adresse');
    }

    // Update username if changed (requires password verification)
    if (newUsername && newUsername !== currentUser.username) {
      const res = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: Auth.authHeaders(),
        body: JSON.stringify({ 
          username: newUsername,
          current_password: currentPassword
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur lors de la mise à jour du nom d\'utilisateur');
      }

      // Update localStorage with new username
      localStorage.setItem('prospectly_username', newUsername);
    }

    showStatus('Profil mis à jour avec succès !');
    
    // Clear form
    document.getElementById('newUsername').value = '';
    document.getElementById('currentPassword').value = '';
    
    // Reload user data
    await loadUserData();

  } catch (err) {
    console.error('[Profile] Erreur mise à jour:', err);
    showStatus(err.message || 'Erreur lors de la mise à jour du profil', true);
  }
}

async function clearHistory() {
  try {
    // Clear search history
    await fetch(`${API_URL}/history`, {
      method: 'DELETE',
      headers: Auth.authHeaders()
    });

    // Clear seen prospects (we'll need to add this endpoint)
    await fetch(`${API_URL}/seen/clear`, {
      method: 'DELETE',
      headers: Auth.authHeaders()
    });

    showStatus('Historique supprimé avec succès');
  } catch (err) {
    console.error('[Profile] Erreur suppression historique:', err);
    showStatus('Erreur lors de la suppression de l\'historique', true);
  }
}

async function clearParcours() {
  try {
    // Get all parcours items
    const res = await fetch(`${API_URL}/parcours`, {
      headers: Auth.authHeaders()
    });

    if (!res.ok) throw new Error('Erreur lors de la récupération du parcours');

    const data = await res.json();
    const parcours = data.parcours || [];

    // Delete each item
    for (const item of parcours) {
      await fetch(`${API_URL}/parcours/${item.id}`, {
        method: 'DELETE',
        headers: Auth.authHeaders()
      });
    }

    showStatus('Parcours supprimé avec succès');
  } catch (err) {
    console.error('[Profile] Erreur suppression parcours:', err);
    showStatus('Erreur lors de la suppression du parcours', true);
  }
}

async function deleteAccount() {
  try {
    const res = await fetch(`${API_URL}/account`, {
      method: 'DELETE',
      headers: Auth.authHeaders()
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de la suppression du compte');
    }

    // Logout and redirect to login
    Auth.logout();
    showStatus('Compte supprimé avec succès. Redirection...');
    
  } catch (err) {
    console.error('[Profile] Erreur suppression compte:', err);
    showStatus(err.message || 'Erreur lors de la suppression du compte', true);
  }
}

// Modal management
function showConfirmModal(title, message, action, isCritical = false) {
  const modal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');

  if (!modal) return;

  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalMessage.style.whiteSpace = isCritical ? 'pre-line' : 'normal';
  
  if (isCritical) {
    modalConfirmBtn.className = 'btn-danger btn-danger-critical';
  } else {
    modalConfirmBtn.className = 'btn-danger';
  }

  pendingAction = action;
  modal.classList.remove('hidden');
}

function hideConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  pendingAction = null;
}

function executePendingAction() {
  hideConfirmModal();
  if (pendingAction) {
    pendingAction();
  }
}

// Status message
function showStatus(message, isError = false) {
  // Create status element if it doesn't exist
  let statusEl = document.getElementById('profileStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'profileStatus';
    statusEl.className = 'status-message';
    const profileContainer = document.querySelector('.profile-container');
    if (profileContainer) {
      profileContainer.insertBefore(statusEl, profileContainer.firstChild);
    }
  }

  statusEl.textContent = message;
  statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
  statusEl.classList.remove('hidden');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 5000);
}