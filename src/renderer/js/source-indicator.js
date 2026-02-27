'use strict';
// Source indicator — shows which tier generated the last response.

var SourceIndicator = (() => {
  const badges = {
    filler: document.getElementById('badge-filler'),
    local:  document.getElementById('badge-local'),
    claude: document.getElementById('badge-claude'),
  };

  function update(source) {
    // Deactivate all
    for (const b of Object.values(badges)) {
      if (b) b.classList.remove('active');
    }
    // Activate the matching one
    const target = badges[source];
    if (target) target.classList.add('active');
  }

  return { update };
})();
