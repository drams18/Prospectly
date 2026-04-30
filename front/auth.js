const API_URL = 'https://prospectly-production-a949.up.railway.app';

window.Auth = {
  getToken() {
    if (this.isExpired()) {
      this.logout();
      return null;
    }
    return localStorage.getItem('prospectly_token');
  },

  getUsername() {
    return localStorage.getItem('prospectly_username');
  },

  setSession(token, username) {
    const oneYear = 1000 * 60 * 60 * 24 * 365;

    localStorage.setItem('prospectly_token', token);
    localStorage.setItem('prospectly_username', username);
    localStorage.setItem('prospectly_expiry', Date.now() + oneYear);
  },

  isExpired() {
    const expiry = localStorage.getItem('prospectly_expiry');
    if (!expiry) return true;
    return Date.now() > Number(expiry);
  },

  logout() {
    localStorage.removeItem('prospectly_token');
    localStorage.removeItem('prospectly_username');
    localStorage.removeItem('prospectly_expiry');
  
    window.location.href = '/Prospectly/login.html';
  },

  authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`,
    };
  },

  requireAuth() {
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!this.getToken() && !isLoginPage) {
      window.location.href = '/Prospectly/login.html';
      return false;
    }
    return true;
  },
};

window.API_URL = API_URL;