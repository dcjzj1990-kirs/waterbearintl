/**
 * WaterbearIntl - Payment Module
 * PayPal Sandbox and Stripe payment integration.
 * Records payment history in localStorage.
 */

(function () {
  'use strict';

  const HISTORY_KEY = 'water-bearintl_payment_history';
  let paypalLoaded = false;

  /** Load payment history from localStorage */
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  /** Save payment record to localStorage */
  function savePayment(record) {
    const history = loadHistory();
    history.unshift(record);
    if (history.length > 50) history.length = 50;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  /** Render payment history */
  function renderHistory() {
    const container = document.getElementById('paymentHistory');
    if (!container) return;
    const history = loadHistory();
    if (history.length === 0) {
      container.innerHTML = '<p class="no-history">No payment records yet</p>';
      return;
    }
    container.innerHTML = history.map((r, i) => `
      <div class="history-item ${r.status}">
        <div class="history-amount">$${parseFloat(r.amount).toFixed(2)}</div>
        <div class="history-detail">
          <span class="history-purpose">${escapeHtml(r.purpose || 'Sample Fee')}</span>
          <span class="history-method">${escapeHtml(r.method || 'PayPal')}</span>
        </div>
        <div class="history-time">${formatTime(r.time)}</div>
        <span class="history-status">${escapeHtml(r.status || 'completed')}</span>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /** Show payment status message */
  function showStatus(message, type) {
    const el = document.getElementById('paymentStatus');
    if (!el) return;
    el.style.display = 'block';
    el.className = 'payment-status ' + type;
    el.textContent = message;
    if (type === 'success') {
      setTimeout(() => { el.style.display = 'none'; }, 8000);
    }
  }

  /** Load PayPal SDK and render buttons */
  async function initPayPal() {
    // Check if PayPal is configured
    let clientId = null;
    try {
      const res = await fetch('/api/payment-config');
      if (res.ok) {
        const config = await res.json();
        clientId = config.paypalClientId;
      }
    } catch (_) { /* fallback */ }

    if (!clientId) {
      const container = document.getElementById('paypalButtonContainer');
      if (container) {
        container.innerHTML = '<p class="paypal-unavailable">PayPal is not configured. Please contact the administrator.</p>';
      }
      return;
    }

    // Load PayPal JS SDK
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=' + clientId + '&currency=USD&intent=capture';
    script.onload = () => {
      paypalLoaded = true;
      renderPayPalButtons(clientId);
    };
    script.onerror = () => {
      const container = document.getElementById('paypalButtonContainer');
      if (container) {
        container.innerHTML = '<p class="paypal-unavailable">Failed to load PayPal SDK. Please check your network or try again later.</p>';
      }
    };
    document.head.appendChild(script);
  }

  function renderPayPalButtons(clientId) {
    const container = document.getElementById('paypalButtonContainer');
    if (!container || !window.paypal) return;

    container.innerHTML = '';
    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal'
      },

      createOrder: async () => {
        const amount = document.getElementById('paymentAmount')?.value;
        const purpose = document.getElementById('paymentPurpose')?.value;
        const value = parseFloat(amount);
        if (!value || value < 50 || value > 2000) {
          showStatus('Amount must be between $50 and $2000', 'error');
          throw new Error('Invalid amount');
        }
        showStatus('Creating PayPal order...', 'pending');

        const res = await fetch('/api/create-paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: value, purpose })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create order');
        }
        const order = await res.json();
        return order.id;
      },

      onApprove: async (data) => {
        showStatus('Payment approved, capturing...', 'pending');
        const res = await fetch('/api/capture-paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderID })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showStatus(err.error || 'Payment capture failed', 'error');
          return;
        }
        const amount = document.getElementById('paymentAmount')?.value || '0';
        const purpose = document.getElementById('paymentPurpose')?.value || 'sample';
        showStatus('Payment successful! Thank you for your payment.', 'success');
        savePayment({
          orderId: data.orderID,
          amount: parseFloat(amount),
          purpose: purpose,
          method: 'PayPal',
          status: 'completed',
          time: new Date().toISOString()
        });
      },

      onCancel: () => {
        showStatus('Payment was cancelled.', 'error');
      },

      onError: (err) => {
        console.error('PayPal error:', err);
        showStatus('An error occurred during payment. Please try again.', 'error');
      }
    }).render('#paypalButtonContainer');
  }

  /** Set up amount preset buttons */
  function initPresetButtons() {
    const amountInput = document.getElementById('paymentAmount');
    if (!amountInput) return;

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        amountInput.value = btn.getAttribute('data-amount');
      });
    });
  }

  /** Handle URL params for post-payment redirect */
  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      showStatus('Payment completed successfully!', 'success');
    } else if (status === 'cancel') {
      showStatus('Payment was cancelled.', 'error');
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof i18n !== 'undefined') i18n.init();
    if (typeof geoDetect !== 'undefined') geoDetect.init();

    renderHistory();
    initPresetButtons();
    initPayPal();
    handleUrlParams();
  });

})();