// Authentication client - login + OTP-verified signup
(function() {
  'use strict';

  const API_BASE = 'http://localhost:3000/api/auth';
  let pendingSignupEmail = '';

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

  function showAuthPanel(panelId) {
    ['panel-login', 'panel-signup', 'panel-signup-otp'].forEach((id) => {
      const panel = document.getElementById(id);
      if (panel) {
        panel.classList.toggle('hidden', id !== panelId);
      }
    });
  }

  function storeUserSession(user, token) {
    localStorage.setItem('gms_user', JSON.stringify({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone || null,
      token: token || null,
      loggedInAt: new Date().toISOString()
    }));
  }

  function showOtpPanel(email, devOtp) {
    pendingSignupEmail = email;
    const emailDisplay = document.getElementById('otp-email-display');
    const devHint = document.getElementById('otp-dev-hint');

    if (emailDisplay) {
      emailDisplay.textContent = email;
    }

    if (devHint) {
      if (devOtp) {
        devHint.hidden = false;
        devHint.textContent = `Dev mode: your code is ${devOtp} (also printed in the server console).`;
      } else {
        devHint.hidden = true;
        devHint.textContent = '';
      }
    }

    const otpInput = document.querySelector('#form-signup-otp input[name="otp"]');
    if (otpInput) {
      otpInput.value = '';
    }

    showAuthPanel('panel-signup-otp');
  }

  async function handleSignup(e) {
    e.preventDefault();

    const displayName = document.querySelector('#form-signup input[name="displayName"]').value.trim();
    const email = document.querySelector('#form-signup input[name="email"]').value.trim();
    const phone = document.querySelector('#form-signup input[name="phone"]').value.trim();
    const password = document.querySelector('#form-signup input[name="password"]').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending code...';

    try {
      const response = await fetch(`${API_BASE}/signup/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email, phone, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(data.message, 'success');
        showOtpPanel(data.email, data.devOtp);
      } else {
        showToast(data.message || 'Could not send verification code', 'error');
      }
    } catch (error) {
      console.error('Signup error:', error);
      showToast('Network error. Make sure server is running on port 3000.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();

    const otp = document.querySelector('#form-signup-otp input[name="otp"]').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    try {
      const response = await fetch(`${API_BASE}/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingSignupEmail, otp })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(`Welcome ${data.user.displayName}! Account verified (+${data.bonusXP} XP)`, 'success');
        storeUserSession(data.user);
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      } else {
        showToast(data.message || 'Verification failed', 'error');
      }
    } catch (error) {
      console.error('OTP verify error:', error);
      showToast('Network error. Make sure server is running on port 3000.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async function handleResendOtp() {
    if (!pendingSignupEmail) {
      showToast('Start sign up again to request a new code', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/signup/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingSignupEmail })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(data.message, 'success');
        if (data.devOtp) {
          const devHint = document.getElementById('otp-dev-hint');
          if (devHint) {
            devHint.hidden = false;
            devHint.textContent = `Dev mode: your new code is ${data.devOtp}.`;
          }
        }
      } else {
        showToast(data.message || 'Could not resend code', 'error');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      showToast('Network error. Make sure server is running on port 3000.', 'error');
    }
  }

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast(`Welcome back ${data.user.displayName}!`, 'success');
        storeUserSession(data.user, data.token);
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

  function initializeAuth() {
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');
    const otpForm = document.getElementById('form-signup-otp');
    const btnShowSignup = document.getElementById('btn-show-signup');
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnResendOtp = document.getElementById('btn-resend-otp');
    const btnBackSignup = document.getElementById('btn-back-signup');

    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
      signupForm.addEventListener('submit', handleSignup);
    }

    if (otpForm) {
      otpForm.addEventListener('submit', handleVerifyOtp);
    }

    if (btnShowSignup) {
      btnShowSignup.addEventListener('click', () => showAuthPanel('panel-signup'));
    }

    if (btnShowLogin) {
      btnShowLogin.addEventListener('click', () => showAuthPanel('panel-login'));
    }

    if (btnResendOtp) {
      btnResendOtp.addEventListener('click', handleResendOtp);
    }

    if (btnBackSignup) {
      btnBackSignup.addEventListener('click', () => showAuthPanel('panel-signup'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
  } else {
    initializeAuth();
  }
})();
