  (function(){
    var toggle = document.getElementById('navToggle');
    var gnav = document.getElementById('gnav');

    function resetSubmenus(){
      gnav.querySelectorAll('.sub-open').forEach(function(li){
        li.classList.remove('sub-open');
      });
    }

    function closeMenu(){
      gnav.classList.remove('is-open');
      toggle.classList.remove('is-active');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'メニューを開く');
      resetSubmenus();
    }

    toggle.addEventListener('click', function(){
      var isOpen = gnav.classList.toggle('is-open');
      toggle.classList.toggle('is-active', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
      if (!isOpen) resetSubmenus();
    });

    // Wires up a single <li>'s own toggle behavior. Applied at every nesting
    // depth (top-level items and nested submenu items alike) so a 3rd-level
    // flyout behaves exactly like the top-level ones, independently of its
    // ancestors' open/closed state.
    function setupToggle(li){
      var link = li.querySelector(':scope > a');
      var lastToggleAt = 0;
      link.addEventListener('click', function(e){
        if (window.matchMedia('(max-width: 1179px)').matches){
          e.preventDefault();
          // Guards against duplicate/ghost click events that some
          // touch-emulation environments (e.g. browser devtools device
          // toolbars) can fire for a single tap.
          var now = Date.now();
          if (now - lastToggleAt < 80) return;
          lastToggleAt = now;
          li.classList.toggle('sub-open');
        } else {
          closeMenu();
        }
      });
    }

    // Every <li> in the nav (at any depth) is either a toggle trigger (has
    // its own nested .sub-menu) or a plain leaf link. Leaf links always close
    // the whole mobile menu on click; triggers only open/close their own
    // submenu, independently of any ancestor or sibling trigger.
    gnav.querySelectorAll('li').forEach(function(li){
      if (li.querySelector(':scope > .sub-menu')){
        setupToggle(li);
      } else {
        var link = li.querySelector(':scope > a');
        link.addEventListener('click', closeMenu);
      }
    });
  })();