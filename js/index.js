require('dotenv').config();
$(document).ready(function() {
  // Initialize header/footer and data, then wire navigation
  if (window.initHeaderFooter) window.initHeaderFooter();
  if (window.initData) window.initData();
  if (window.initNavigation) window.initNavigation();

  // initial section
  if (window.loadSection) window.loadSection('home');

  // attach global handler for README view links (delegated)
  $(document).on('click', '.view-readme', function(e) {
    e.preventDefault();
    const repo = $(this).data('repo');

        const user = process.env.githubUser || process.env.user || '';
        if (!user) return;
        if (window.loadRepoReadme) window.loadRepoReadme(user, repo);
  });
});
