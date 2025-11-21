$(document).ready(function() {
  // header / footer 로드
  $("#header").load("html/header.html");
  $("#footer").load("html/footer.html");

  // 초기 로드
  loadSection('home');

  // 네비게이션 클릭
  $(document).on("click", ".nav-item", function(e) {
    e.preventDefault();
    const target = $(this).data("target");
    loadSection(target);
  });

  function loadSection(sectionName) {
    $("#content").load(`html/section/${sectionName}.html`);
    $("#section-style").attr("href", `css/sections/${sectionName}.css`);
  }
});
