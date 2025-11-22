// Management UI: 카테고리/포스트 추가, 삭제 (localStorage)
(function() {
  window.renderManagePage = function() {
    $('#content').load('html/section/manage.html', function() {
      const cats = (() => { try { return JSON.parse(localStorage.getItem('categories') || JSON.stringify(window.requireDefault('data/categories.json'))); } catch(e){ return []; }})();
      const $catList = $('#manage-categories');
      $catList.empty();
      (cats || []).forEach(function(c) {
        const $li = $('<div>').addClass('manage-cat-item').text(c.label + ' (' + c.slug + ')');
        const $del = $('<button>').text('삭제').addClass('btn-del-cat').data('slug', c.slug);
        $li.append($del);
        $catList.append($li);
      });

      const $postList = $('#manage-posts');
      $postList.empty();
      (window.posts || []).forEach(function(p) {
        const $li = $('<div>').addClass('manage-post-item').text(p.title + ' (' + p.slug + ')');
        const $del = $('<button>').text('삭제').addClass('btn-del-post').data('slug', p.slug);
        $li.append($del);
        $postList.append($li);
      });

      $('#add-category-form').off('submit').on('submit', function(e) {
        e.preventDefault();
        const label = $('#new-cat-label').val().trim();
        const slug = $('#new-cat-slug').val().trim();
        if (!label || !slug) return alert('슬러그와 라벨을 입력하세요.');
        const existing = (() => { try { return JSON.parse(localStorage.getItem('categories') || '[]'); } catch(e){ return []; }})();
        existing.push({slug: slug, label: label});
        window.saveCategories(existing);
        window.renderManagePage();
      });

      $('#add-post-form').off('submit').on('submit', function(e) {
        e.preventDefault();
        const title = $('#new-post-title').val().trim();
        const slug = $('#new-post-slug').val().trim();
        const date = $('#new-post-date').val().trim() || new Date().toISOString().slice(0,10);
        const excerpt = $('#new-post-excerpt').val().trim();
        const content = $('#new-post-content').val();
        const catsSel = $('#new-post-cats').val() || [];
        if (!title || !slug) return alert('타이틀과 슬러그를 입력하세요');
        const existing = (window.posts || []).slice();
        existing.unshift({id: 'local-'+slug, title: title, slug: slug, date: date, categories: catsSel, excerpt: excerpt, content: content});
        window.savePosts(existing);
        window.renderManagePage();
      });

      // delete handlers (scoped)
      $('#content').off('click.manage').on('click.manage', '.btn-del-cat', function() {
        const slug = $(this).data('slug');
        const cur = (() => { try { return JSON.parse(localStorage.getItem('categories') || '[]'); } catch(e){ return []; }})();
        const filtered = cur.filter(c => c.slug !== slug);
        window.saveCategories(filtered);
        window.renderManagePage();
      });

      $('#content').off('click.manage-post').on('click.manage-post', '.btn-del-post', function() {
        const slug = $(this).data('slug');
        const filtered = (window.posts || []).filter(p => p.slug !== slug);
        window.savePosts(filtered);
        window.renderManagePage();
      });

      const $multi = $('#new-post-cats');
      $multi.empty();
      (cats || []).forEach(function(c) { $multi.append($('<option>').val(c.slug).text(c.label)); });
    });
  };
})();
