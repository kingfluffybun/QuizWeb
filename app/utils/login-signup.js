document.addEventListener('DOMContentLoaded', () => {
  const auth = document.getElementById('auth');
  const inView = document.getElementById('signIn');
  const upView = document.getElementById('signUp');
  const modal = document.getElementById('forgot');
  const panelLabel = document.getElementById('panelLabel');
  const panelTitle = document.getElementById('panelTitle');
  const panelText = document.getElementById('panelText');
  const formLabel = document.getElementById('formLabel');
  const formTitle = document.getElementById('formTitle');
  const formText = document.getElementById('formText');
  const toggle = document.getElementById('toggleLink');
  const toggleText = document.getElementById('toggleText');
  const links = document.querySelectorAll('.link, .panel-toggle');
  const openForgot = document.querySelector('.forgot-link');
  const closeModal = document.querySelector('.modalClose');
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepLabel = document.getElementById('stepLabel');
  const stepTitle = document.getElementById('stepTitle');
  const stepText = document.getElementById('stepText');
  const actionButtons = document.querySelectorAll('.modal .submit-btn');
  const pwToggles = document.querySelectorAll('.toggle-pw');

      pwToggles.forEach((btn) => {
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });

    btn.addEventListener('click', () => {
      const input = btn.closest('.input-group').querySelector('input');
      if (!input) return;

      const cursorPosition = input.selectionStart;
      const isShowing = input.type === 'text';

      input.type = isShowing ? 'password' : 'text';
      btn.classList.toggle('is-visible', !isShowing);
      btn.setAttribute('aria-label', isShowing ? 'Show password' : 'Hide password');

      input.focus();

      requestAnimationFrame(() => {
        if (cursorPosition !== null) {
          input.setSelectionRange(cursorPosition, cursorPosition);
        }
      });
    });
  });

  const fadeEls = [panelTitle, panelText, formLabel, formTitle, formText, toggleText];
  const FADE_MS = 220;
  let fadeToken = 0;

  function fadeSwapText(applyFn) {
    const myToken = ++fadeToken;
    fadeEls.forEach((el) => el.classList.add('text-fade-out'));

    setTimeout(() => {
      if (myToken !== fadeToken) return;
      applyFn();
      void panelTitle.offsetWidth;
      fadeEls.forEach((el) => el.classList.remove('text-fade-out'));
    }, FADE_MS);
  }

  function setStep(n) {
    steps.forEach((step) => step.classList.remove('active'));
    document.getElementById(`step${n}`).classList.add('active');

    const copy = {
      1: ['Step 1', 'Enter your email', 'Use the registered email address for your account.'],
      2: ['Step 2', 'Verify OTP', 'A 6-digit code will appear here during future integration.'],
      3: ['Step 3', 'Reset password', 'You can place the new password fields here later.'],
      4: ['Complete', 'All set', 'Your password reset flow is ready for future backend integration.']
    };

    const [label, title, text] = copy[n];
    stepLabel.textContent = label;
    stepTitle.textContent = title;
    stepText.textContent = text;
  }

  function setView(mode, animate = true) {
    const applyMode = () => {
      if (mode === 'signup') {
        inView.classList.remove('active');
        upView.classList.add('active');
        panelTitle.textContent = 'Create account';
        panelText.textContent = 'Start learning with QuizWeb in minutes.';
        formLabel.textContent = 'Get started';
        formTitle.textContent = 'Create account';
        formText.textContent = 'A few details and you’re ready to go.';
        toggleText.textContent = 'Already have an account? Sign in';
        toggle.setAttribute('href', '#signin');
        toggle.setAttribute('data-mode', 'signin');
      } else {
        inView.classList.add('active');
        upView.classList.remove('active');
        panelTitle.textContent = 'Welcome back!';
        panelText.textContent = 'Pick up your HTML, CSS, and JS quizzes where you left off.';
        formLabel.textContent = 'Access your account';
        formTitle.textContent = 'Sign in';
        formText.textContent = 'Use your email and password to continue.';
        toggleText.textContent = 'New here? Create account';
        toggle.setAttribute('href', '#signup');
        toggle.setAttribute('data-mode', 'signup');
      }
    };

    if (mode === 'signup') {
      auth.classList.add('is-signup');
    } else {
      auth.classList.remove('is-signup');
    }

    if (animate) {
      fadeSwapText(applyMode);
    } else {
      fadeEls.forEach((el) => el.classList.remove('text-fade-out'));
      applyMode();
    }

    // window.location.hash = mode === 'signup' ? 'signup' : 'signin';
  }

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/login') {
      setView('signup', false);
    } else if (path === '/register') {
      setView('signin', false);
    }
});

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const mode = link.getAttribute('data-mode');
      if (mode === 'signup') {
        setView('signup');
      } else if (mode === 'signin') {
        modal.classList.remove('visible');
        setView('signin');
      }
    });
  });

  openForgot.addEventListener('click', (event) => {
    event.preventDefault();
    modal.classList.add('visible');
    setStep(1);
    window.location.hash = 'forgot-password';
  });

  closeModal.addEventListener('click', () => {
    modal.classList.remove('visible');
    setStep(1);
    window.location.hash = 'signin';
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.classList.remove('visible');
      setStep(1);
      window.location.hash = 'signin';
    }
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-next-step');
      const finish = button.getAttribute('data-finish');
      const mode = button.getAttribute('data-mode');

      if (next === '2') {
        setStep(2);
      } else if (next === '3') {
        setStep(3);
      } else if (finish === 'true') {
        setStep(4);
      } else if (mode === 'signin') {
        modal.classList.remove('visible');
        setView('signin');
      }
    });
  });

  if (window.location.hash === '#signup') {
    setView('signup', false);
  } else if (window.location.hash === '#forgot-password') {
    modal.classList.add('visible');
    setStep(1);
    setView('signin', false);
  } else {
    setView('signin', false);
  }

  const slides = Array.from(document.querySelectorAll('.preview-slide'));
  if (slides.length > 1) {
    let slideIndex = slides.findIndex((slide) => slide.classList.contains('active'));
    if (slideIndex === -1) slideIndex = 0;

    setInterval(() => {
      slides[slideIndex].classList.remove('active');
      slideIndex = (slideIndex + 1) % slides.length;
      slides[slideIndex].classList.add('active');
    }, 4500);
  }
});
