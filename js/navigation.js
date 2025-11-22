// Navigation and section loader
(function() {
  window.initNavigation = function() {
    $(document).on("click", ".nav-item", function(e) {
      e.preventDefault();
      const target = $(this).data("target");
      if (target) loadSection(target);
    });

    $(document).on("change", "#category-select", function() {
      const slug = $(this).val();
      const label = $(this).find('option:selected').text();
      if (slug) loadCategory(slug, label);
    });

    $(document).on('click', '.post-item', function() {
      const slug = $(this).data('slug');
      const post = (window.posts || []).find(function(p) { return p.slug === slug; });
      if (post) loadPost(post);
    });

    $(document).on('click', '.nav-manage', function(e) {
      e.preventDefault();
      if (window.renderManagePage) window.renderManagePage();
    });
  };

  window.loadSection = function(sectionName) {
    $("#content").load(`html/section/${sectionName}.html`, function() {
      const label = (window.pagesMap && window.pagesMap[sectionName]) || sectionName;
      document.title = `Evan's Blog - ${label}`;
      if (sectionName === 'projects' && window.loadProjects) window.loadProjects();
    });
    $("#section-style").attr("href", `css/sections/${sectionName}.css`);
  };

  window.loadCategory = function(slug, label) {
    $('#content').load('html/section/category.html', function() {
      $('#category-title').text(label);
      renderPostsForCategory(slug);
    });
    $('#section-style').attr('href', 'css/sections/category.css');
    document.title = `Evan's Blog - ${label}`;
  };

  function renderPostsForCategory(slug) {
    const $list = $('#category-list');
    $list.empty();
    const filtered = (window.posts || []).filter(function(p) { return p.categories && p.categories.indexOf(slug) !== -1; });
    if (!filtered.length) { $list.append('<p class="muted">해당 카테고리의 포스트가 없습니다.</p>'); return; }
    const $wrap = $('<div>').addClass('post-list');
    filtered.forEach(function(p) {
      const $item = $('<div>').addClass('post-item').attr('data-slug', p.slug);
      $item.append($('<h3>').text(p.title));
      $item.append($('<div>').addClass('excerpt').text(p.excerpt));
      $item.append($('<div>').addClass('meta').text(p.date));
      $wrap.append($item);
    });
    $list.append($wrap);
  }

  window.renderPostsForCategory = renderPostsForCategory;

  window.loadPost = function(post) {
    $('#content').load('html/section/post.html', function() {
      $('#post-title').text(post.title);
      $('#post-meta').text(post.date + ' • ' + (post.categories || []).join(', '));
      $('#post-content').html(post.content || '<p>내용 없음</p>');
      $('.back-to-category').off('click').on('click', function(e) {
        e.preventDefault();
        const firstCat = (post.categories && post.categories[0]) || '';
        const label = firstCat ? ($('#category-select option[value="' + firstCat + '"]').text() || firstCat) : '카테고리';
        if (firstCat) { $('#category-select').val(firstCat); loadCategory(firstCat, label); } else { loadSection('home'); }
      });
    });
    $('#section-style').attr('href', 'css/sections/category.css');
    document.title = `Evan's Blog - ${post.title}`;
  };
})();
