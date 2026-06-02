/**
 * WaterbearIntl - 联系表单处理
 * 用法：在 contact.html 页面底部引入
 */
(function() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const formData = {
      name: document.getElementById('inqName').value.trim(),
      email: document.getElementById('inqEmail').value.trim(),
      phone: document.getElementById('inqPhone').value.trim(),
      company: document.getElementById('inqCompany').value.trim(),
      country: document.getElementById('inqCountry').value,
      subject: document.getElementById('inqSubject').value,
      message: document.getElementById('inqMsg').value.trim()
    };

    // 简单验证
    if (!formData.name || !formData.email || !formData.message) {
      alert('Please fill in required fields: Name, Email, and Message.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    try {
      const result = await window.GlobexData?.submitContactForm?.(formData);
      if (result && result.success) {
        // 成功
        form.reset();
        const successMsg = document.createElement('div');
        successMsg.className = 'form-success';
        successMsg.innerHTML = `
          <div style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:16px;margin:16px 0;">
            <div style="display:flex;align-items:center;gap:8px;color:#22c55e;font-weight:600;">
              <span style="font-size:1.2em;">✓</span> Thank you for your inquiry!
            </div>
            <p style="margin-top:8px;color:rgba(255,255,255,.7);font-size:0.9em;">
              We have received your message and will get back to you within 24 hours.
            </p>
          </div>
        `;
        form.insertBefore(successMsg, form.firstChild);
        setTimeout(() => successMsg.remove(), 5000);
      } else {
        // API 失败，降级为邮件发送
        const mailto = `mailto:info@waterbearintl.com?subject=${encodeURIComponent(formData.subject || 'Inquiry')}&body=${encodeURIComponent(
`Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Company: ${formData.company}
Country: ${formData.country}
Message: ${formData.message}`)}`;
        window.location.href = mailto;
      }
    } catch (err) {
      console.error('Form submission error:', err);
      alert('Unable to submit form. Please try again later or email directly to info@waterbearintl.com');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // 为静态页面添加样式
  if (!document.querySelector('style#contact-form-styles')) {
    const style = document.createElement('style');
    style.id = 'contact-form-styles';
    style.textContent = `
      .form-success { animation: fadeIn 0.3s ease; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }
})();