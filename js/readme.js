// README 렌더링 유틸
(function() {
  // raw: plain text (already base64-decoded if 필요)
  window.renderReadmeContent = function(raw) {
    raw = raw || '';
    // 빈 내용 처리
    if (!raw.trim()) {
      return $('<div>').html('<p class="muted">README가 없습니다.</p>');
    }

    // 안전한 마크다운 -> HTML 변환
    let html = raw;
    if (typeof marked !== 'undefined') {
      try {
        html = marked.parse(raw);
      } catch (e) {
        console.warn('marked parse failed:', e);
        html = '<pre>' + escapeHtml(raw) + '</pre>';
      }
    } else {
      // fallback: 단순 pre 태그
      html = '<pre>' + escapeHtml(raw) + '</pre>';
    }

    // sanitize if DOMPurify available
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      try {
        html = DOMPurify.sanitize(html);
      } catch (e) {
        console.warn('DOMPurify sanitize failed:', e);
      }
    }

    // 5줄 이상의 비어있지 않은 라인이면 details로 접기
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length >= 5) {
      const $details = $('<details>').addClass('readme-details');
      $details.append($('<summary>').text('README 보기'));
      const $content = $('<div>').addClass('readme-markdown').html(html);
      // ensure links open in a new tab
      try { $content.find('a').attr('target', '_blank').attr('rel', 'noopener noreferrer'); } catch (e) {}
      $details.append($content);
      return $details;
    }

    // 짧으면 바로 jQuery element로 반환; ensure links open in new tab
    const $short = $('<div>').addClass('readme-markdown').html(html);
    try { $short.find('a').attr('target', '_blank').attr('rel', 'noopener noreferrer'); } catch (e) {}
    return $short;
  };

  // 보조: escapeHtml (간단)
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
