document.addEventListener('DOMContentLoaded', function() {
  // Show loading state

  fetch('../html/navbar.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('navbar-placeholder').innerHTML = data;
      
      // Highlight active link based on current page
      const path = window.location.pathname.split('/').pop();
      if (path === 'dashboard.html' || path === 'index.html' || path === '') {
        document.getElementById('nav-dashboard').classList.add('active');
      } else if (path === 'devices.html') {
        document.getElementById('nav-devices').classList.add('active');
      } else if (path === 'automation.html') {
        document.getElementById('nav-automation').classList.add('active');
      } else if (path === 'settings.html') {
        document.getElementById('nav-settings').classList.add('active');
      } else if (path === 'manual.html') {
        document.getElementById('nav-manual').classList.add('active');
      }
      
      // Enhanced navbar show/hide on scroll with smooth transitions
      let lastScrollTop = 0;
      const navbar = document.querySelector('nav');
      let ticking = false;
      
      function updateNavbar() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
          // Scroll Down - hide navbar
          navbar.style.transform = 'translateY(-100%)';
        } else {
          // Scroll Up - show navbar
          navbar.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        ticking = false;
      }
      
      if (navbar) {
        window.addEventListener('scroll', function() {
          if (!ticking) {
            requestAnimationFrame(updateNavbar);
            ticking = true;
          }
        });
      }
      
      // Add smooth page transitions
      const navLinks = document.querySelectorAll('.nav-links a');
      navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
          // Don't prevent default for external links or same page
          if (this.href === window.location.href) {
            e.preventDefault();
            return;
          }
          
          // Add loading state for page transitions
          document.body.classList.add('loading');
          
          // Small delay to show loading state
          setTimeout(() => {
            window.location.href = this.href;
          }, 100);
        });
      });
      
      // Remove loading state after navbar is loaded
      setTimeout(() => {
        document.body.classList.remove('loading');
      }, 100);
    })
    .catch(error => {
      console.error('Error loading navbar:', error);
      document.body.classList.remove('loading');
    });
  
  // Preload other pages for faster navigation
  const pagesToPreload = ['devices.html', 'automation.html', 'settings.html', 'manual.html', 'index.html'];
  pagesToPreload.forEach(page => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = page;
    document.head.appendChild(link);
  });
});