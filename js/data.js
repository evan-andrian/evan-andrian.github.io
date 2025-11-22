// Data layer: pages map, categories and posts (localStorage-friendly)
(function() {
  window.pagesMap = {};
  window.posts = [];

  window.initData = function() {
    // pages map
    $.getJSON('data/pages.json')
      .done(function(pages) { window.pagesMap = pages || {}; })
      .fail(function() { console.warn('페이지 맵을 불러오지 못했습니다: data/pages.json'); });

    // categories and posts prefer localStorage
    loadCategoriesToSelect();
    loadPosts();
  };

  window.loadCategoriesToSelect = function() {
    const stored = localStorage.getItem('categories');
    if (stored) {
      try { const cats = JSON.parse(stored); populateCategorySelect(cats); return; } catch (e) {}
    }
    $.getJSON('data/categories.json')
      .done(function(categories) { populateCategorySelect(categories); })
      .fail(function() { console.warn('카테고리 파일을 불러오지 못했습니다: data/categories.json'); });
  };

  function populateCategorySelect(categories) {
    const $select = $('#category-select');
    if (!$select.length) return;
    $select.empty().append($('<option>').val('').text('카테고리'));
    categories.forEach(function(cat) { $select.append($('<option>').val(cat.slug).text(cat.label)); });
  }

  window.saveCategories = function(categories) {
    try { localStorage.setItem('categories', JSON.stringify(categories)); } catch (e) {}
    loadCategoriesToSelect();
  };

  window.loadPosts = function() {
    const stored = localStorage.getItem('posts');
    if (stored) {
      try { window.posts = JSON.parse(stored); return; } catch (e) {}
    }
    $.getJSON('data/posts.json')
      .done(function(data) { window.posts = data || []; })
      .fail(function() { console.warn('포스트 데이터를 불러오지 못했습니다: data/posts.json'); });
  };

  window.savePosts = function(newPosts) {
    try { localStorage.setItem('posts', JSON.stringify(newPosts)); } catch (e) {}
    window.posts = newPosts;
  };
})();
