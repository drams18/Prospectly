const API_URL = 'https://prospectly-production-a949.up.railway.app';

window.Auth = {
  getToken() {
    return localStorage.getItem('prospectly_token');
  },

  getUsername() {
    return localStorage.getItem('prospectly_username');
  },

  setSession(token, username) {
    localStorage.setItem('prospectly_token', token);
    localStorage.setItem('prospectly_username', username);
  },

  logout() {
    localStorage.removeItem('prospectly_token');
    localStorage.removeItem('prospectly_username');
    window.location.href = 'login.html';
  },

  authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`,
    };
  },

  requireAuth() {
    if (!this.getToken()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },
};

window.API_URL = API_URL;
