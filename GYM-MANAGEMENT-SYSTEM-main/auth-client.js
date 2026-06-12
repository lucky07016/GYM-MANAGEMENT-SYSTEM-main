// Authentication client - handles login/signup with database integration
(function() {
  'use strict';

  const API_BASE = 'http://localhost:3000/api/auth';

  // Show toast notification
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const toastHost = document.getElementById('toast-host');
    if (toastHost) {
      toastHost.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

  // Handle signup form submission
  async function handleSignup(e) {
    e.preventDefault();
    
    const displayName = document.querySelector('#form-signup input[name="displayName"]').value;
    const email = document.querySelector('#form-signup input[name="email"]').value;
    const password = document.querySelector('#form-signup input[name="password"]').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName,
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(`Welcome ${displayName}! Account created (+${data.bonusXP} XP)`, 'success');
        
        // Store user info locally
        localStorage.setItem('gms_user', JSON.stringify({
          id: data.user.id,
          displayName: data.user.displayName,
          email: data.user.email,
          loggedInAt: new Date().toISOString()
        }));

        // Redirect to home
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      } else {
        showToast(data.message || 'Signup failed', 'error');
      }
    } catch (error) {
      console.error('Signup error:', error);
      showToast('Network error. Make sure server is running on port 3000.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // Handle login form submission
  async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.querySelector('#form-login input[name="email"]').value;
    const password = document.querySelector('#form-login input[name="password"]').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(`Welcome back ${data.user.displayName}!`, 'success');
        
        // Store user info and session token
        localStorage.setItem('gms_user', JSON.stringify({
          id: data.user.id,
          displayName: data.user.displayName,
          email: data.user.email,
          token: data.token,
          loggedInAt: new Date().toISOString()
        }));

        // Redirect to home
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      } else {
        showToast(data.message || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('Network error. Make sure server is running on port 3000.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // Initialize auth forms when DOM is ready
  function initializeAuth() {
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');
    const btnShowSignup = document.getElementById('btn-show-signup');
    const btnShowLogin = document.getElementById('btn-show-login');

    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
      signupForm.addEventListener('submit', handleSignup);
    }

    if (btnShowSignup) {
      btnShowSignup.addEventListener('click', () => {
        document.getElementById('panel-login').classList.add('hidden');
        document.getElementById('panel-signup').classList.remove('hidden');
      });
    }

    if (btnShowLogin) {
      btnShowLogin.addEventListener('click', () => {
        document.getElementById('panel-signup').classList.add('hidden');
        document.getElementById('panel-login').classList.remove('hidden');
      });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
  } else {
    initializeAuth();
  }
})();
