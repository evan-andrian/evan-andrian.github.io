// GitHub projects integration (copied from previous implementation)
require('dotenv').config();
(function() {
  // helper: format relative time like '3 hours ago'
  function formatTimeAgo(iso) {
    try {
      const then = new Date(iso).getTime();
      const diff = Date.now() - then;
      const secs = Math.floor(diff / 1000);
      if (secs < 60) return secs + ' seconds ago';
      const mins = Math.floor(secs / 60);
      if (mins < 60) return mins + ' minutes ago';
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + ' hours ago';
      const days = Math.floor(hours / 24);
      if (days < 30) return days + ' days ago';
      const months = Math.floor(days / 30);
      if (months < 12) return months + ' months ago';
      const years = Math.floor(months / 12);
      return years + ' years ago';
    } catch (e) { return iso || ''; }
  }
  // helper: show a dismissible notice above the projects list
  function showProjectsNotice(message, kind) {
    try {
      // remove existing
      $('#projects-notice').remove();
      const $notice = $(
        `<div id="projects-notice" class="projects-notice ${kind || ''}">` +
        `<div class="projects-notice-body">${message}</div>` +
        `<button class="projects-notice-close" aria-label="닫기">×</button>` +
        `</div>`
      );
      $notice.find('.projects-notice-close').on('click', function() { $notice.remove(); });
      // insert before the list container
      $('#projects-list').before($notice);
    } catch (e) { console.warn('showProjectsNotice failed', e); }
  }
  // prevent clicks on README <summary> from bubbling to the card (which opens the repo)
  try {
    $(document).on('click', '.readme-details summary, .readme-markdown summary', function(e) {
      e.stopPropagation();
    });
  } catch (e) { /* ignore if jQuery missing */ }
  window.loadProjects = function() {
    $('#projects-list').empty();
    $('#project-detail').hide().empty();
    // 설정에서 githubUser 가져오기
    
        const user = process.env.githubUser;
        if (!user) {
          $('#projects-list').html('<p class="muted">GitHub 사용자명이 설정되지 않았습니다. data/config.json을 편집하세요.</p>');
          return;
        }
        $('#projects-list').html('<p class="muted">레포 목록을 불러오는 중...</p>');
        // initial page from URL query (?page=)
        const initialPage = (function(){
          try { return Math.max(1, parseInt((new URLSearchParams(window.location.search)).get('page')||'1', 10) || 1); } catch(e) { return 1; }
        })();

        // API base and headers (no proxy). support multiple token config keys.
        const api = `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=100`;
        const headers = {};
        const token = process.env && (process.env.githubToken || process.env.gitHubToken || process.env.token);
        if (token) headers['Authorization'] = 'Bearer ' + token;
        headers['X-GitHub-Api-Version'] = '2022-11-28';
        headers['Accept'] = 'application/vnd.github+json';

        // helper: seed star counts into sessionStorage and render the repo list
        function seedStarsAndRender(userParam, reposParam) {
          // count private repositories (hidden)
          const privateCount = (reposParam || []).filter(function(r){ return r && r.private; }).length;
          // filter out private repositories (do not display private repos)
          const visible = (reposParam || []).filter(function(r) { return r && !r.private; }).filter(Boolean);
          try {
            visible.forEach(function(r) {
              const full = r && r.full_name ? r.full_name : ((r.owner && r.owner.login ? r.owner.login : userParam) + '/' + (r.name || ''));
              const key = 'repoStars:' + full;
              const payload = { count: r.stargazers_count || 0, ts: Date.now() };
              sessionStorage.setItem(key, JSON.stringify(payload));
            });
          } catch (e) { /* ignore storage errors */ }
          renderRepoList(userParam, visible, headers, initialPage, { privateCount: privateCount });
        }

        $.ajax({ url: api, dataType: 'json', headers: headers })
          .done(function(repos) {
            // Try to fetch organizations for the user and include their repos
            const orgsApi = `https://api.github.com/users/${encodeURIComponent(user)}/orgs`;
            $.ajax({ url: orgsApi, dataType: 'json', headers: headers })
              .done(function(orgs) {
                // Allow explicit extra orgs from config (various keys: extraOrgs, includeOrgs, organizations, organization, orgs)
                try {
                  let extra = [];
                  if (process.env) {
                    ['extraOrgs', 'includeOrgs', 'organizations', 'organization', 'orgs'].forEach(function(k) {
                      const v = process.env[k];
                      if (!v) return;
                      if (Array.isArray(v)) extra = extra.concat(v);
                      else extra.push(v);
                    });
                  }
                  extra = (extra || []).map(function(n) { return n ? String(n).trim() : ''; }).filter(Boolean);
                  if (extra.length) {
                    const existingLogins = (orgs || []).map(o => o && o.login).filter(Boolean);
                    extra.forEach(function(name) {
                      if (existingLogins.indexOf(name) === -1) {
                        (orgs = orgs || []).push({ login: name, fromConfig: true });
                      }
                    });
                  }
                } catch (e) {
                  // ignore config parsing errors and proceed with fetched orgs
                }

                if (!orgs || !orgs.length) {
                  seedStarsAndRender(user, repos);
                  return;
                }

                const orgPromises = orgs.map(function(o) {
                  const login = (o && o.login) ? o.login : '';
                  const orgReposApi = `https://api.github.com/orgs/${encodeURIComponent(login)}/repos?per_page=100&type=all`;
                  // Wrap each ajax call in a deferred that always resolves with {login, ok, data, xhr}
                  const deferred = $.Deferred();
                  $.ajax({ url: orgReposApi, dataType: 'json', headers: headers })
                    .done(function(data) { deferred.resolve({ login: login, ok: true, data: data }); })
                    .fail(function(xhr) { deferred.resolve({ login: login, ok: false, xhr: xhr }); });
                  return deferred.promise();
                });

                if (!orgPromises.length) {
                  seedStarsAndRender(user, repos);
                  return;
                }

                // Wait for all org fetch wrappers to finish (they always resolve)
                $.when.apply($, orgPromises).done(function() {
                  const results = Array.prototype.slice.call(arguments);
                  // ensure array shape when single result
                  const resArray = (results && results.length) ? results : [results];
                  const missing = [];
                  const forbidden = [];
                  let orgRepos = [];
                  resArray.forEach(function(r) {
                    if (!r) return;
                    if (r.ok) {
                      if (Array.isArray(r.data)) orgRepos = orgRepos.concat(r.data);
                    } else {
                      const status = r.xhr && r.xhr.status;
                      if (status === 404) missing.push(r.login);
                      else if (status === 403) forbidden.push(r.login);
                    }
                  });

                  if (missing.length) {
                    showProjectsNotice('다음 조직을 찾을 수 없습니다: ' + missing.join(', '), 'missing-orgs');
                  }
                  if (forbidden.length) {
                    showProjectsNotice('권한이 없습니다 (403): ' + forbidden.join(', '), 'forbidden-orgs');
                  }

                  // merge and dedupe by full_name
                  const combined = (repos || []).slice();
                  const seen = {};
                  combined.forEach(function(rr) { if (rr && rr.full_name) seen[rr.full_name] = true; });
                  orgRepos.forEach(function(or) {
                    if (or && or.full_name && !seen[or.full_name]) {
                      combined.push(or);
                      seen[or.full_name] = true;
                    }
                  });

                  seedStarsAndRender(user, combined);
                });
              })
              .fail(function() {
                seedStarsAndRender(user, repos);
              });
          })
          .fail(function(xhr) {
            let msg = '레포를 불러오지 못했습니다. GitHub API 제한 또는 사용자명 오류일 수 있습니다.';
            if (xhr && xhr.status === 401) msg = 'GitHub 인증에 실패했습니다. data/config.json의 토큰을 확인하세요.';
            if (xhr && xhr.status === 403) msg = 'GitHub 요청이 거부되었습니다(레이트리밋 또는 권한).';
            $('#projects-list').html(`<p class="muted">${msg}</p>`);
          });
      }
      .fail(function() {
        $('#projects-list').html('<p class="muted">설정 파일(data/config.json)을 불러오지 못했습니다.</p>');
      });

  function renderRepoList(user, repos, headers, page, opts) {
    opts = opts || {};
    const hiddenPrivateCount = opts.privateCount || 0;
    page = page || 1;
    const pageSize = 10;
    // no proxy used here; callers use direct API URLs
    const $wrap = $('<div>').addClass('projects-list');
    if (!repos || !repos.length) {
      $('#projects-list').html('<p class="muted">저장소가 없습니다.</p>');
      return;
    }
    $('#projects-list').empty();
    // show private count if any
    if (hiddenPrivateCount > 0) {
      const $pc = $('<div>').addClass('private-count').text('숨겨진 개인 레포: ' + hiddenPrivateCount);
      $('#projects-list').append($pc);
    }
    $('#projects-list').append($wrap);

    // 바로 상세를 보여주기: 호출 수를 제한하여 상위 N개 레포만 상세 로드
      const total = repos.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      const end = Math.min(start + pageSize, total);
      for (let i = start; i < end; i++) {
      const r = repos[i];
      const ownerLogin = r && r.owner && r.owner.login ? r.owner.login : user;
      const $container = $('<div>').addClass('repo-card repo-loading').attr('data-owner', ownerLogin).attr('data-repo', r.name);

      $container.append($('<h3>').text(r.name));
      $container.append($('<p>').addClass('muted').text('로딩 중...'));
      $wrap.append($container);

      // fetch languages and readme in parallel
      const langsApi = `https://api.github.com/repos/${encodeURIComponent(ownerLogin)}/${encodeURIComponent(r.name)}/languages`;
      const readmeApi = `https://api.github.com/repos/${encodeURIComponent(ownerLogin)}/${encodeURIComponent(r.name)}/readme`;

      $.when(
        $.ajax({ url: langsApi, dataType: 'json', headers: headers }),
        $.ajax({ url: readmeApi, dataType: 'json', headers: headers })
      ).done(function(langsResp, readmeResp) {
          const languages = (langsResp && langsResp[0]) || {};
          const readmeData = (readmeResp && readmeResp[0]) || {};
          const readmeContent = base64ToUtf8(readmeData.content || '');
          const readmeHtml = renderReadmeContent(readmeContent);

          // build compact card (format: name Visibility Description Language Stars Updated)
          const $card = $('<div>').addClass('repo-card repo-compact');
          // top line: name + visibility
          const visibility = r.private ? 'Private' : 'Public';
          const $top = $('<div>').addClass('repo-compact-top');
          const $name = $('<div>').addClass('repo-compact-name').text(r.name);
          // clicking the repo name opens the repo in a new tab; stop propagation so card click doesn't also fire
          try {
            $name.css('cursor','pointer').on('click', function(e) { e.stopPropagation(); window.open(r.html_url, '_blank'); });
          } catch (e) {}
          const $vis = $('<div>').addClass('visibility-badge').text(visibility.toLocaleLowerCase());
          $top.append($name).append($vis);
          $card.append($top);

          // description
          const $desc = $('<div>').addClass('repo-compact-desc').text(r.description || '');
          $card.append($desc);

          // meta row: primary language, stars, updated
          const totalLangBytes = Object.values(languages).reduce((a,b) => a + b, 0);
          let primaryLang = '';
          if (totalLangBytes > 0) {
            const entries = Object.keys(languages).map(function(k) { return {k:k,v:languages[k]}; });
            entries.sort(function(a,b){ return b.v - a.v; });
            primaryLang = entries.length ? entries[0].k : '';
          } else {
            primaryLang = '';
          }
          const $meta = $('<div>').addClass('repo-compact-meta');
          if (primaryLang) $meta.append($('<span>').addClass('meta-item meta-lang').text(primaryLang));
          $meta.append($('<span>').addClass('meta-item meta-stars').html('★ ' + (r.stargazers_count || 0)));
          if (r.updated_at) $meta.append($('<span>').addClass('meta-item meta-updated').text('Updated ' + formatTimeAgo(r.updated_at)));
          $card.append($meta);

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

          // ensure any anchors inside card open in new tab
          try { $card.find('a').attr('target', '_blank').attr('rel', 'noopener noreferrer'); } catch (e) {}

          $container.replaceWith($card);
          // clicking anywhere on the card opens the GitHub repo (except when clicking links inside)
          $card.css('cursor', 'pointer').on('click', function(e) {
            if ($(e.target).closest('a').length) return; // allow clicks on anchors inside the card
            window.open(r.html_url, '_blank');
          });
        })
        .fail(function(xhr) {
          // If detailed fetch fails (languages/readme), don't show an error — show a minimal card without details.
            try {
            const $card = $('<div>').addClass('repo-card repo-compact');
            const visibility = r && r.private ? 'Private' : 'Public';
            const $top = $('<div>').addClass('repo-compact-top');
            const $name = $('<div>').addClass('repo-compact-name').text(r.name);
            try { $name.css('cursor','pointer').on('click', function(e) { e.stopPropagation(); window.open(r.html_url, '_blank'); }); } catch(e) {}
            const $vis = $('<div>').addClass('visibility-badge').text(visibility);
            $top.append($name).append($vis);
            $card.append($top);
            $card.append($('<div>').addClass('repo-compact-desc').text(r.description || ''));
            const $meta = $('<div>').addClass('repo-compact-meta');
            $meta.append($('<span>').addClass('meta-item meta-stars').html('★ ' + (r.stargazers_count || 0)));
            if (r.updated_at) $meta.append($('<span>').addClass('meta-item meta-updated').text('Updated ' + formatTimeAgo(r.updated_at)));
            $card.append($meta);
            try { $card.find('a').attr('target', '_blank').attr('rel', 'noopener noreferrer'); } catch(e) {}
            $container.replaceWith($card);
          } catch (e) {
            // fallback: remove loading text and leave bare name
            $container.find('p.muted').remove();
          }
        });
    }

    // pagination controls
    if (totalPages > 1) {
      const $pager = $('<div>').addClass('repo-pagination');
      // Prev
      const $prev = $('<button>').addClass('page-btn page-prev').attr('data-page', Math.max(1, page-1)).text('Prev');
      if (page === 1) $prev.prop('disabled', true).addClass('disabled');
      $pager.append($prev);
      for (let p = 1; p <= totalPages; p++) {
        const $btn = $('<button>').addClass('page-btn').attr('data-page', p).text(p);
        if (p === page) $btn.addClass('active');
        $pager.append($btn);
      }
      // Next
      const $next = $('<button>').addClass('page-btn page-next').attr('data-page', Math.min(totalPages, page+1)).text('Next');
      if (page === totalPages) $next.prop('disabled', true).addClass('disabled');
      $pager.append($next);

      // page click handler: re-render with same repos+headers for selected page
      $pager.find('.page-btn').on('click', function(e) {
        const p = Math.max(1, parseInt($(this).attr('data-page') || '1', 10) || 1);
        // update URL query parameter without reload
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('page', String(p));
          window.history.replaceState(null, '', u.toString());
        } catch (err) { /* ignore URL API errors */ }
        renderRepoList(user, repos, headers, p, { privateCount: hiddenPrivateCount });
      });
      $('#projects-list').append($pager);
    }
  }

  // README 불러오기 및 렌더링
  $(document).on('click', '.view-readme', function(e) {
    e.preventDefault();
    const repo = $(this).data('repo');
    // config로부터 user 읽기
    
        const user = process.env.githubUser || process.env.user || '';
        if (!user) return;
        loadRepoReadme(user, repo);
      });
  });

  window.loadRepoReadme = function(user, repo) {
    // Show loading
    $('#project-detail').show().html('<p class="muted">프로젝트 정보를 불러오는 중...</p>');

    // 먼저 설정에서 토큰 읽기 (프록시 미사용)
    
      const headers = {};
      const token = process.env && (process.env.githubToken || process.env.gitHubToken || process.env.token);
      if (token) headers['Authorization'] = 'Bearer ' + token;
      headers['X-GitHub-Api-Version'] = '2022-11-28';
      headers['Accept'] = 'application/vnd.github+json';

      // 1) repo 정보
      const repoApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`;
      const langsApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/languages`;
      const readmeApi = `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/readme`;

      $.ajax({ url: repoApi, dataType: 'json', headers: headers }).done(function(repoInfo) {
        // 병렬로 languages와 readme를 가져오기
        $.when(
          $.ajax({ url: langsApi, dataType: 'json', headers: headers }),
          $.ajax({ url: readmeApi, dataType: 'json', headers: headers })
        ).done(function(langsResp, readmeResp) {
          const languages = (langsResp && langsResp[0]) || {};
          const readmeData = (readmeResp && readmeResp[0]) || {};
          const readmeContent = base64ToUtf8(readmeData.content || '');
          const readmeHtml = renderReadmeContent(readmeContent);

          // 렌더링: 상단 카드(레포 이름, 오너 아바타/닉, 별 수), 언어 분포 그래프, README
          const $card = $('<div>').addClass('repo-card');
          const $header = $('<div>').addClass('repo-card-header');
          const $owner = $('<div>').addClass('repo-owner');
          const $avatar = $('<img>').addClass('owner-avatar').attr('src', repoInfo.owner && repoInfo.owner.avatar_url);
          const $ownerInfo = $('<div>').addClass('owner-info');
          const $repoNameDet = $('<div>').addClass('repo-name').text(repoInfo.name);
          if (repoInfo.owner && repoInfo.owner.login && repoInfo.owner.login !== user) {
            $repoNameDet.append($('<span>').addClass('org-badge').text(repoInfo.owner.login));
          }
          // repo name click opens GitHub repo in new tab
          try { $repoNameDet.css('cursor','pointer').on('click', function(e){ e.stopPropagation(); window.open(repoInfo.html_url, '_blank'); }); } catch(e) {}
          $ownerInfo.append($repoNameDet);
          $ownerInfo.append($('<div>').addClass('owner-name').text(repoInfo.owner && repoInfo.owner.login));
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

          // ensure README/other links open in new tab
          try { $card.find('a').attr('target', '_blank').attr('rel', 'noopener noreferrer'); } catch (e) {}
          $('#project-detail').empty().append($card);
          // clicking anywhere on the detail card opens the GitHub repo (except when clicking links inside)
          $card.css('cursor', 'pointer').on('click', function(e) {
            if ($(e.target).closest('a').length) return;
            window.open(repoInfo.html_url, '_blank');
          });
          // 스크롤 이동
          window.scrollTo({ top: $('#project-detail').offset().top - 20, behavior: 'smooth' });

        }).fail(function(xhr) {
          // If we cannot fetch detailed repo info, hide the detail pane (do not show an error message).
          try { $('#project-detail').hide().empty(); } catch (e) {}
        });

      }).fail(function() {
        // hide detail pane if repo info cannot be loaded
        try { $('#project-detail').hide().empty(); } catch (e) {}
      });
  };