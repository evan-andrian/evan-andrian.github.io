$(document).ready(function() {
  // header / footer 로드
  $("#header").load("html/header.html");
  $("#footer").load("html/footer.html");

  // 초기 로드
  loadSection('home');
  
  // 전역 페이지 맵 (data/pages.json)
  let pagesMap = {};
  $.getJSON('data/pages.json')
    .done(function(pages) {
      pagesMap = pages;
    })
    .fail(function() {
      console.warn('페이지 맵을 불러오지 못했습니다: data/pages.json');
    });

  // 카테고리 목록 로드 (data/categories.json)
  // 카테고리 목록 로드 (data/categories.json) — localStorage 우선
  function loadCategoriesToSelect() {
    const stored = localStorage.getItem('categories');
    if (stored) {
      try {
        const cats = JSON.parse(stored);
        populateCategorySelect(cats);
        return;
      } catch (e) {}
    }
    $.getJSON('data/categories.json')
      .done(function(categories) {
        populateCategorySelect(categories);
      })
      .fail(function() {
        console.warn('카테고리 파일을 불러오지 못했습니다: data/categories.json');
      });
  }

  function populateCategorySelect(categories) {
    const $select = $('#category-select');
    $select.empty().append($('<option>').val('').text('카테고리'));
    categories.forEach(function(cat) {
      const $opt = $('<option>').val(cat.slug).text(cat.label);
      $select.append($opt);
    });
  }
  loadCategoriesToSelect();

  // 포스트 데이터 로드
  // posts도 localStorage 우선 로드
  let posts = [];
  function loadPosts() {
    const stored = localStorage.getItem('posts');
    if (stored) {
      try {
        posts = JSON.parse(stored);
        return;
      } catch (e) {}
    }
    $.getJSON('data/posts.json')
      .done(function(data) {
        posts = data;
      })
      .fail(function() {
        console.warn('포스트 데이터를 불러오지 못했습니다: data/posts.json');
      });
  }
  loadPosts();

  function saveCategories(categories) {
    try { localStorage.setItem('categories', JSON.stringify(categories)); } catch (e) {}
    loadCategoriesToSelect();
  }

  function savePosts(newPosts) {
    try { localStorage.setItem('posts', JSON.stringify(newPosts)); } catch (e) {}
    posts = newPosts;
  }

  // 네비게이션 클릭
  $(document).on("click", ".nav-item", function(e) {
    e.preventDefault();
    const target = $(this).data("target");
    loadSection(target);
  });

  // 카테고리 선택 (드롭다운) — 사용자 정의 그룹 로드
  $(document).on("change", "#category-select", function() {
    const slug = $(this).val();
    const label = $(this).find('option:selected').text();
    if (slug) {
      loadCategory(slug, label);
    }
  });

  function loadCategory(slug, label) {
    $('#content').load('html/section/category.html', function() {
      $('#category-title').text(label);
      renderPostsForCategory(slug);
    });
    $('#section-style').attr('href', 'css/sections/category.css');
    // 카테고리 선택은 라벨을 사용해 타이틀 설정
    document.title = `Evan's Blog - ${label}`;
  }

  function renderPostsForCategory(slug) {
    const $list = $('#category-list');
    $list.empty();
    const filtered = posts.filter(function(p) {
      return p.categories && p.categories.indexOf(slug) !== -1;
    });
    if (!filtered.length) {
      $list.append('<p class="muted">해당 카테고리의 포스트가 없습니다.</p>');
      return;
    }
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

  // 포스트 클릭 핸들러 (동적으로 생성된 .post-item)
  $(document).on('click', '.post-item', function() {
    const slug = $(this).data('slug');
    const post = posts.find(function(p) { return p.slug === slug; });
    if (post) loadPost(post);
  });

  function loadPost(post) {
    $('#content').load('html/section/post.html', function() {
      $('#post-title').text(post.title);
      $('#post-meta').text(post.date + ' • ' + (post.categories || []).join(', '));
      $('#post-content').html(post.content || '<p>내용 없음</p>');
      // back to category: go to first category of the post
      $('.back-to-category').off('click').on('click', function(e) {
        e.preventDefault();
        const firstCat = (post.categories && post.categories[0]) || '';
        const label = firstCat ? ($('#category-select option[value="' + firstCat + '"]').text() || firstCat) : '카테고리';
        if (firstCat) {
          $('#category-select').val(firstCat);
          loadCategory(firstCat, label);
        } else {
          loadSection('home');
        }
      });
    });
    $('#section-style').attr('href', 'css/sections/category.css');
    document.title = `Evan's Blog - ${post.title}`;
  }

  // ---- Management UI: 카테고리/포스트 추가, 삭제 (localStorage에 저장) ----
  // 관리 페이지 렌더
  function renderManagePage() {
    $('#content').load('html/section/manage.html', function() {
      // populate current categories and posts
      const cats = (() => { try { return JSON.parse(localStorage.getItem('categories') || JSON.stringify(requireDefault('data/categories.json'))); } catch(e){ return []; }})();
      const $catList = $('#manage-categories');
      $catList.empty();
      (cats || []).forEach(function(c) {
        const $li = $('<div>').addClass('manage-cat-item').text(c.label + ' (' + c.slug + ')');
        const $del = $('<button>').text('삭제').addClass('btn-del-cat').data('slug', c.slug);
        $li.append($del);
        $catList.append($li);
      });

      // posts
      const $postList = $('#manage-posts');
      $postList.empty();
      (posts || []).forEach(function(p) {
        const $li = $('<div>').addClass('manage-post-item').text(p.title + ' (' + p.slug + ')');
        const $del = $('<button>').text('삭제').addClass('btn-del-post').data('slug', p.slug);
        $li.append($del);
        $postList.append($li);
      });

      // form handlers
      $('#add-category-form').on('submit', function(e) {
        e.preventDefault();
        const label = $('#new-cat-label').val().trim();
        const slug = $('#new-cat-slug').val().trim();
        if (!label || !slug) return alert('슬러그와 라벨을 입력하세요.');
        const existing = (() => { try { return JSON.parse(localStorage.getItem('categories') || '[]'); } catch(e){ return []; }})();
        existing.push({slug: slug, label: label});
        saveCategories(existing);
        renderManagePage();
      });

      $('#add-post-form').on('submit', function(e) {
        e.preventDefault();
        const title = $('#new-post-title').val().trim();
        const slug = $('#new-post-slug').val().trim();
        const date = $('#new-post-date').val().trim() || new Date().toISOString().slice(0,10);
        const excerpt = $('#new-post-excerpt').val().trim();
        const content = $('#new-post-content').val();
        const catsSel = $('#new-post-cats').val() || [];
        if (!title || !slug) return alert('타이틀과 슬러그를 입력하세요');
        const existing = posts.slice();
        existing.unshift({id: 'local-'+slug, title: title, slug: slug, date: date, categories: catsSel, excerpt: excerpt, content: content});
        savePosts(existing);
        renderManagePage();
      });

      // delete handlers
      $(document).on('click', '.btn-del-cat', function() {
        const slug = $(this).data('slug');
        const cur = (() => { try { return JSON.parse(localStorage.getItem('categories') || '[]'); } catch(e){ return []; }})();
        const filtered = cur.filter(c => c.slug !== slug);
        saveCategories(filtered);
        renderManagePage();
      });

      $(document).on('click', '.btn-del-post', function() {
        const slug = $(this).data('slug');
        const filtered = posts.filter(p => p.slug !== slug);
        savePosts(filtered);
        renderManagePage();
      });

      // populate category multiselect in add-post form
      const $multi = $('#new-post-cats');
      $multi.empty();
      (cats || []).forEach(function(c) { $multi.append($('<option>').val(c.slug).text(c.label)); });
    });
  }

  // helper: try to synchronously require default JSON path (only used fallback for manage view population)
  function requireDefault(path) {
    // This is a lightweight fallback: AJAX synchronous call (not ideal but used for manage UI fallback)
    let res = [];
    try {
      $.ajax({url: path, async: false, dataType: 'json', success: function(data){ res = data; }});
    } catch(e) {}
    return res;
  }

  // nav에서 manage로 이동하면 renderManagePage 호출
  $(document).on('click', '.nav-manage', function(e) {
    e.preventDefault();
    renderManagePage();
  });
  // --------------------------------------------------------------

  function loadSection(sectionName) {
    $("#content").load(`html/section/${sectionName}.html`, function() {
      const label = pagesMap[sectionName] || sectionName;
      document.title = `Evan's Blog - ${label}`;
      // 추가 동작: projects 섹션이면 GitHub 레포 로드
      if (sectionName === 'projects') {
        loadProjects();
      }
    });
    $("#section-style").attr("href", `css/sections/${sectionName}.css`);
  }

  // --- Projects: GitHub 연동 -------------------------------------------------
  function loadProjects() {
    $('#projects-list').empty();
    $('#project-detail').hide().empty();
    // 설정에서 githubUser 가져오기
    $.getJSON('data/config.json')
      .done(function(cfg) {
        const user = cfg.githubUser;
        if (!user) {
          $('#projects-list').html('<p class="muted">GitHub 사용자명이 설정되지 않았습니다. data/config.json을 편집하세요.</p>');
          return;
        }
        $('#projects-list').html('<p class="muted">레포 목록을 불러오는 중...</p>');
        const api = `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=100`;
        $.getJSON(api)
          .done(function(repos) {
            renderRepoList(user, repos);
          })
          .fail(function() {
            $('#projects-list').html('<p class="muted">레포를 불러오지 못했습니다. GitHub API 제한 또는 사용자명 오류일 수 있습니다.</p>');
          });
      })
      .fail(function() {
        $('#projects-list').html('<p class="muted">설정 파일(data/config.json)을 불러오지 못했습니다.</p>');
      });
  }

  function renderRepoList(user, repos) {
    const $wrap = $('<div>').addClass('projects-list');
    if (!repos || !repos.length) {
      $('#projects-list').html('<p class="muted">저장소가 없습니다.</p>');
      return;
    }
    $('#projects-list').empty().append($wrap);

    // 바로 상세를 보여주기: 호출 수를 제한하여 상위 N개 레포만 상세 로드
    const limit = Math.min(repos.length, 12);
    for (let i = 0; i < limit; i++) {
      const r = repos[i];
      const $container = $('<div>').addClass('repo-card repo-loading').attr('data-repo', r.name);
      $container.append($('<h3>').text(r.name));
      $container.append($('<p>').addClass('muted').text('로딩 중...'));
      $wrap.append($container);

      // fetch languages and readme in parallel
      const langsApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(r.name)}/languages`;
      const readmeApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(r.name)}/readme`;

      $.when($.getJSON(langsApi), $.ajax({url: readmeApi, dataType: 'json'}))
        .done(function(langsResp, readmeResp) {
          const languages = langsResp[0] || {};
          const readmeData = readmeResp[0] || {};
          const readmeContent = base64ToUtf8(readmeData.content || '');
          const readmeHtml = renderReadmeContent(readmeContent);

          // build card
          const $card = $('<div>').addClass('repo-card');
          const $header = $('<div>').addClass('repo-card-header');
          const $owner = $('<div>').addClass('repo-owner');
          const $avatar = $('<img>').addClass('owner-avatar').attr('src', r.owner && r.owner.avatar_url);
          const $ownerInfo = $('<div>').addClass('owner-info');
          $ownerInfo.append($('<div>').addClass('owner-name').text(r.owner && r.owner.login));
          $ownerInfo.append($('<div>').addClass('repo-name').text(r.name));
          $owner.append($avatar).append($ownerInfo);
          const $stats = $('<div>').addClass('repo-stats');
          $stats.append($('<div>').addClass('stars').html('★ ' + (r.stargazers_count || 0)));
          $header.append($owner).append($stats);
          $card.append($header);

          // language bar
          const $langWrap = $('<div>').addClass('repo-languages');
          const total = Object.values(languages).reduce((a,b) => a + b, 0);
          const $bar = $('<div>').addClass('language-bar');
          const $legend = $('<div>').addClass('language-legend');
          if (total > 0) {
            Object.keys(languages).forEach(function(lang) {
              const bytes = languages[lang];
              const pct = Math.round((bytes / total) * 1000) / 10;
              const color = languageColor(lang);
              const $seg = $('<div>').addClass('lang-segment').css({width: pct + '%', 'background-color': color}).attr('title', `${lang} ${pct}%`);
              $bar.append($seg);
              const $leg = $('<span>').addClass('lang-item').html(`<strong style="color:${color}">■</strong> ${lang} ${pct}%`);
              $legend.append($leg);
            });
          } else {
            $bar.append($('<div>').addClass('lang-empty').text('언어 정보 없음'));
          }
          $langWrap.append($bar).append($legend);
          $card.append($langWrap);

          // readme
          const $readme = $('<div>').addClass('repo-readme');
          $readme.append($('<h4>').text('README'));
          // readmeHtml may be a jQuery element (slider) or a simple jQuery container
          const $readmeContent = $('<div>').addClass('readme-content');
          if (readmeHtml && readmeHtml.jquery) {
            $readmeContent.append(readmeHtml);
          } else {
            $readmeContent.html(readmeHtml || '<p class="muted">README가 없습니다.</p>');
          }
          $readme.append($readmeContent);
          $card.append($readme);

          $card.append($('<p>').append($('<a target="_blank">').attr('href', r.html_url).text('원본 저장소 열기')));

          $container.replaceWith($card);
        })
        .fail(function() {
          $container.find('p.muted').text('상세 정보를 불러오지 못했습니다 (rate limit 또는 비공개).');
        });
    }
  }

  // README 불러오기 및 렌더링
  $(document).on('click', '.view-readme', function(e) {
    e.preventDefault();
    const repo = $(this).data('repo');
    // config로부터 user 읽기
    $.getJSON('data/config.json')
      .done(function(cfg) {
        const user = cfg.githubUser || cfg.user || '';
        if (!user) return;
        loadRepoReadme(user, repo);
      });
  });

  function loadRepoReadme(user, repo) {
    // Show loading
    $('#project-detail').show().html('<p class="muted">프로젝트 정보를 불러오는 중...</p>');

    // 1) repo 정보
    const repoApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`;
    const langsApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/languages`;
    const readmeApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/readme`;

    $.getJSON(repoApi).done(function(repoInfo) {
      // 병렬로 languages와 readme를 가져오기
      $.when($.getJSON(langsApi), $.ajax({url: readmeApi, dataType: 'json'}))
        .done(function(langsResp, readmeResp) {
          const languages = langsResp[0] || {};
          const readmeData = readmeResp[0] || {};
          const readmeContent = base64ToUtf8(readmeData.content || '');
          const readmeHtml = renderReadmeContent(readmeContent);

          // 렌더링: 상단 카드(레포 이름, 오너 아바타/닉, 별 수), 언어 분포 그래프, README
          const $card = $('<div>').addClass('repo-card');
          const $header = $('<div>').addClass('repo-card-header');
          const $owner = $('<div>').addClass('repo-owner');
          const $avatar = $('<img>').addClass('owner-avatar').attr('src', repoInfo.owner && repoInfo.owner.avatar_url);
          const $ownerInfo = $('<div>').addClass('owner-info');
          $ownerInfo.append($('<div>').addClass('owner-name').text(repoInfo.owner && repoInfo.owner.login));
          $ownerInfo.append($('<div>').addClass('repo-name').text(repoInfo.name));
          $owner.append($avatar).append($ownerInfo);
          const $stats = $('<div>').addClass('repo-stats');
          $stats.append($('<div>').addClass('stars').html('★ ' + (repoInfo.stargazers_count || 0)));
          $header.append($owner).append($stats);

          $card.append($header);

          // 언어 분포 그래프
          const $langWrap = $('<div>').addClass('repo-languages');
          const total = Object.values(languages).reduce((a,b) => a + b, 0);
          const $bar = $('<div>').addClass('language-bar');
          const $legend = $('<div>').addClass('language-legend');
          if (total > 0) {
            Object.keys(languages).forEach(function(lang) {
              const bytes = languages[lang];
              const pct = Math.round((bytes / total) * 1000) / 10; // 1 decimal
              const color = languageColor(lang);
              const $seg = $('<div>').addClass('lang-segment').css({width: pct + '%', 'background-color': color}).attr('title', `${lang} ${pct}%`);
              $bar.append($seg);
              const $leg = $('<span>').addClass('lang-item').html(`<strong style="color:${color}">■</strong> ${lang} ${pct}%`);
              $legend.append($leg);
            });
          } else {
            $bar.append($('<div>').addClass('lang-empty').text('언어 정보 없음'));
          }
          $langWrap.append($bar).append($legend);
          $card.append($langWrap);

          // README
          const $readme = $('<div>').addClass('repo-readme');
          $readme.append($('<h4>').text('README'));
          const $readmeContent = $('<div>').addClass('readme-content');
          if (readmeHtml && readmeHtml.jquery) {
            $readmeContent.append(readmeHtml);
          } else {
            $readmeContent.html(readmeHtml || '<p class="muted">README가 없습니다.</p>');
          }
          $readme.append($readmeContent);
          $card.append($readme);

          // 링크
          $card.append($('<p>').append($('<a target="_blank">').attr('href', repoInfo.html_url).text('원본 저장소 열기')));

          $('#project-detail').empty().append($card);
          // 스크롤 이동
          window.scrollTo({ top: $('#project-detail').offset().top - 20, behavior: 'smooth' });
        })
        .fail(function() {
          $('#project-detail').html('<p class="muted">프로젝트 상세를 불러오지 못했습니다.</p>');
        });
    }).fail(function() {
      $('#project-detail').html('<p class="muted">레포 정보를 불러오지 못했습니다.</p>');
    });
  }

  function base64ToUtf8(b64) {
    // atob로 디코드한 뒤 UTF-8로 변환
    const binary = window.atob(b64.replace(/\s/g, ''));
    try {
      // UTF-8 디코딩
      return decodeURIComponent(escape(binary));
    } catch (e) {
      return binary; // fallback
    }
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 간단한 언어 색상 매핑 (확장 가능)
  function languageColor(lang) {
    const map = {
      'JavaScript': '#f1e05a', 'TypeScript': '#2b7489', 'HTML': '#e34c26', 'CSS': '#563d7c',
      'Python': '#3572A5', 'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584',
      'C++': '#f34b7d', 'C#': '#178600', 'Kotlin': '#F18E33', 'Swift': '#ffac45',
      'Android': '#3DDC84', 'Shell': '#89e051', 'Ruby': '#701516', 'PHP': '#4F5D95',
      'Dart': '#00B4AB', 'Objective-C': '#438eff'
    };
    return map[lang] || '#c0c0c0';
  }

  // README 렌더링: 10줄 초과 시 슬라이더로 분할
  function renderReadmeContent(raw) {
    if (!raw) return $('<div>').html('<p class="muted">README가 없습니다.</p>');
    // split into paragraphs (blocks separated by empty lines)
    const paragraphs = raw.split(/(?:\r?\n){2,}/).map(p => p.trim()).filter(p => p !== '');

    // count total non-empty lines
    const totalLines = raw.split(/\r?\n/).filter(l => l.trim() !== '').length;
    // if short, render normally
    if (totalLines <= 10) {
      let out = '';
      try { out = (typeof marked !== 'undefined') ? marked.parse(raw) : ('<pre>' + escapeHtml(raw) + '</pre>'); } catch(e) { out = '<pre>' + escapeHtml(raw) + '</pre>'; }
      // sanitize
      try { out = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(out) : out; } catch(e) {}
      return $('<div>').html(out);
    }

    // build slides by aggregating paragraphs until ~10 non-empty lines reached
    const slidesContent = [];
    let currentLines = 0;
    let currentParts = [];
    paragraphs.forEach(function(p) {
      const linesInP = p.split(/\r?\n/).filter(l => l.trim() !== '').length || 1;
      if (currentLines + linesInP > 10 && currentParts.length > 0) {
        slidesContent.push(currentParts.join('\n\n'));
        currentParts = [p];
        currentLines = linesInP;
      } else {
        currentParts.push(p);
        currentLines += linesInP;
      }
    });
    if (currentParts.length) slidesContent.push(currentParts.join('\n\n'));

    // create jQuery container with slides and controls
    const $container = $('<div>').addClass('readme-slider');
    const slides = [];
    slidesContent.forEach(function(chunk, idx) {
      let html = '';
      try { html = (typeof marked !== 'undefined') ? marked.parse(chunk) : ('<pre>' + escapeHtml(chunk) + '</pre>'); } catch(e) { html = '<pre>' + escapeHtml(chunk) + '</pre>'; }
      try { html = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(html) : html; } catch(e) {}
      const $slide = $('<div>').addClass('readme-slide').html(html);
      if (idx === 0) $slide.addClass('active');
      $container.append($slide);
      slides.push($slide);
    });

    const $controls = $('<div>').addClass('readme-controls');
    const $prev = $('<button type="button">').addClass('readme-prev').text('이전');
    const $counter = $('<span>').addClass('readme-slide-counter').text('1 / ' + slides.length);
    const $next = $('<button type="button">').addClass('readme-next').text('다음');
    const $play = $('<button type="button">').addClass('btn-play').text('재생');
    $controls.append($prev).append($counter).append($next).append($play);
    $container.append($controls);

    // slide control functions
    function showIndex(i) {
      $container.find('.readme-slide.active').removeClass('active');
      $container.find('.readme-slide').eq(i).addClass('active');
      $counter.text((i + 1) + ' / ' + slides.length);
    }
    let currentIdx = 0;
    $prev.on('click', function() { currentIdx = (currentIdx - 1 + slides.length) % slides.length; showIndex(currentIdx); });
    $next.on('click', function() { currentIdx = (currentIdx + 1) % slides.length; showIndex(currentIdx); });

    // autoplay
    let timer = null;
    const intervalMs = 5000;
    function startAuto() {
      if (timer) return;
      $play.removeClass('btn-play').addClass('btn-pause').text('일시정지');
      timer = setInterval(function() { currentIdx = (currentIdx + 1) % slides.length; showIndex(currentIdx); }, intervalMs);
      $container.data('autoplayTimer', timer);
    }
    function stopAuto() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      $play.removeClass('btn-pause').addClass('btn-play').text('재생');
      $container.data('autoplayTimer', null);
    }
    $play.on('click', function() {
      if (timer) stopAuto(); else startAuto();
    });
    // pause on hover
    $container.on('mouseenter', function() { if (timer) stopAuto(); });
    $container.on('mouseleave', function() { /* do not auto-restart to avoid surprise; user can click 재생 */ });

    return $container;
  }
  // -------------------------------------------------------------------------
});
