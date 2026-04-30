const API_URL = 'https://prospectly-production-a949.up.railway.app';

window.Auth = {
  getToken() {
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

    // safe redirect (évite reload loops)
    window.location.replace('/Prospectly/login.html');
  },

  authHeaders() {
    const token = this.getToken();

    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  requireAuth() {
    // Check if we're on login page - allow access without token
    const isLoginPage = window.location.pathname.includes('login.html');
    if (isLoginPage) return true;

    const token = this.getToken();
    
    // If no token, redirect to login
    if (!token) {
      this.logout();
      return false;
    }

    // Check expiration WITHOUT side effect
    const expired = this.isExpired();
    if (expired) {
      this.logout();
      return false;
    }

    return true;
  },

  checkSession() {
    const token = this.getToken();
    if (!token) return false;
    if (this.isExpired()) {
      this.logout();
      return false;
    }
    return true;
  }
};

window.API_URL = API_URL;