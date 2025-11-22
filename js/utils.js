// Utility helpers exposed on window for simple module integration
(function() {
  window.base64ToUtf8 = function(b64) {
    if (!b64) return '';
    const binary = window.atob(b64.replace(/\s/g, ''));
    try {
      return decodeURIComponent(escape(binary));
    } catch (e) {
      return binary;
    }
  };

  window.escapeHtml = function(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  window.languageColor = function(lang) {
    const map = {
      'JavaScript': '#f1e05a', 'TypeScript': '#2b7489', 'HTML': '#e34c26', 'CSS': '#563d7c',
      'Python': '#3572A5', 'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584',
      'C++': '#f34b7d', 'C#': '#178600', 'Kotlin': '#F18E33', 'Swift': '#ffac45',
      'Android': '#3DDC84', 'Shell': '#89e051', 'Ruby': '#701516', 'PHP': '#4F5D95',
      'Dart': '#00B4AB', 'Objective-C': '#438eff', 'Markdown': '#083fa1'
    };
    return map[lang] || '#c0c0c0';
  };

  window.requireDefault = function(path) {
    let res = [];
    try {
      $.ajax({url: path, async: false, dataType: 'json', success: function(data){ res = data; }});
    } catch(e) {}
    return res;
  };
})();
