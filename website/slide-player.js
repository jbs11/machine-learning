'use strict';
// ── Animated Slide Player with Synced Audio ──────────────────────────────────
// CSP.init(lessonId, el, audioSrc)
// - Slides auto-advance based on audio duration / number of slides
// - One Play button controls both slides and audio together
// - Progress bar tracks audio position across the full lesson
(function(global) {

  var MODULE_COLORS = { 1:'#22d3ee', 2:'#4ade80', 3:'#a78bfa', 4:'#fb923c',
                        5:'#22d3ee', 6:'#4ade80', 7:'#a78bfa', 8:'#fb923c', 9:'#f43f5e' };
  var FALLBACK_DUR  = 7000; // ms per slide when no audio
  var players       = {};

  function getColor(lessonId) {
    var mod = parseInt((lessonId + '').split('.')[0]) || 1;
    return MODULE_COLORS[mod] || '#22d3ee';
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ── Slide renderers ──────────────────────────────────────────────────────

  function renderTitle(s, color) {
    return '<div class="csp-title-slide">'
      + '<div class="csp-mod-badge" style="color:' + color + ';border-color:' + color + '">' + (s.badge||'') + '</div>'
      + '<div class="csp-title-icon">' + (s.icon||'') + '</div>'
      + '<div class="csp-title-main">' + (s.heading||'') + '</div>'
      + (s.sub  ? '<div class="csp-title-sub">'  + s.sub  + '</div>' : '')
      + (s.note ? '<div class="csp-title-note">' + s.note + '</div>' : '')
      + '</div>';
  }

  function renderBullets(s, color) {
    var items = (s.items||[]).map(function(item) {
      return '<li class="csp-item"><span class="csp-bullet" style="color:' + color + '">&#9658;</span>' + item + '</li>';
    }).join('');
    return '<div class="csp-bullets-slide">'
      + '<div class="csp-slide-head"><span class="csp-slide-icon">' + (s.icon||'') + '</span>' + (s.heading||'') + '</div>'
      + '<ul class="csp-item-list">' + items + '</ul>'
      + (s.note ? '<div class="csp-slide-note">' + s.note + '</div>' : '')
      + '</div>';
  }

  function renderCode(s) {
    return '<div class="csp-code-slide">'
      + '<div class="csp-slide-head"><span class="csp-slide-icon">' + (s.icon||'') + '</span>' + (s.heading||'') + '</div>'
      + '<div class="csp-code-wrap"><pre class="csp-pre">' + escHtml(s.code||'') + '</pre></div>'
      + (s.note ? '<div class="csp-slide-note">' + s.note + '</div>' : '')
      + '</div>';
  }

  function renderVisual(s) {
    return '<div class="csp-visual-slide">'
      + '<div class="csp-slide-head"><span class="csp-slide-icon">' + (s.icon||'') + '</span>' + (s.heading||'') + '</div>'
      + '<div class="csp-visual-content">' + (s.html||'') + '</div>'
      + (s.note ? '<div class="csp-slide-note">' + s.note + '</div>' : '')
      + '</div>';
  }

  function renderSummary(s) {
    var items = (s.items||[]).map(function(item) {
      return '<li class="csp-item"><span class="csp-check">&#10003;</span>' + item + '</li>';
    }).join('');
    return '<div class="csp-summary-slide">'
      + '<div class="csp-slide-head"><span class="csp-slide-icon">' + (s.icon||'') + '</span>' + (s.heading||'') + '</div>'
      + '<ul class="csp-item-list csp-summary-list">' + items + '</ul>'
      + '</div>';
  }

  function renderSlide(slide, color) {
    switch (slide.type) {
      case 'title':   return renderTitle(slide, color);
      case 'code':    return renderCode(slide);
      case 'visual':  return renderVisual(slide);
      case 'summary': return renderSummary(slide);
      default:        return renderBullets(slide, color);
    }
  }

  // ── Player HTML ──────────────────────────────────────────────────────────

  function buildHTML(p) {
    var dots = p.slides.map(function(_, i) {
      return '<span class="csp-dot' + (i===0?' csp-dot-active':'') + '" data-i="' + i + '"></span>';
    }).join('');
    var audioTime = p.audioSrc
      ? '<span class="csp-audio-time">0:00</span>'
      : '';
    var audioIcon = p.audioSrc
      ? '<span class="csp-audio-icon" title="Audio synced">&#127911;</span>'
      : '';
    return '<div class="csp-wrap" style="--csp-c:' + p.color + '">'
      + '<div class="csp-stage"></div>'
      + '<div class="csp-ctrl">'
      + '<button class="csp-btn csp-prev" title="Previous" disabled>&#9664;</button>'
      + '<button class="csp-btn csp-play" title="Play / Pause">&#9654;</button>'
      + audioIcon
      + '<div class="csp-dots">' + dots + '</div>'
      + '<div class="csp-timer"><div class="csp-timer-fill"></div></div>'
      + audioTime
      + '<span class="csp-num">1&nbsp;/&nbsp;' + p.slides.length + '</span>'
      + '<button class="csp-btn csp-next" title="Next">&#9654;&#9654;</button>'
      + '</div>'
      + '</div>';
  }

  // ── Audio helpers ────────────────────────────────────────────────────────

  function initAudio(p) {
    if (!p.audioSrc) return;
    var a = new Audio(p.audioSrc);
    a.preload = 'metadata';
    p.audio = a;

    a.addEventListener('ended', function() {
      p.playing = false;
      clearInterval(p.tickId);
      cancelAnimationFrame(p.rafId);
      showSlide(p, p.slides.length - 1);
      updateControls(p);
      // reset progress bar
      var fill = p.el.querySelector('.csp-timer-fill');
      if (fill) { fill.style.transition = 'none'; fill.style.width = '100%'; }
    });

    a.addEventListener('error', function() {
      p.audio = null; // fall back to timer-only
    });
  }

  // ── Progress tracking (RAF loop for audio, interval for timer-only) ───────

  function startProgressRAF(p) {
    cancelAnimationFrame(p.rafId);
    var a = p.audio;
    if (!a) return;

    function tick() {
      if (!p.playing) return;
      var dur = a.duration || 1;
      var pct = Math.min((a.currentTime / dur) * 100, 100);

      var fill = p.el.querySelector('.csp-timer-fill');
      if (fill) { fill.style.transition = 'none'; fill.style.width = pct + '%'; }

      var timeEl = p.el.querySelector('.csp-audio-time');
      if (timeEl) timeEl.textContent = fmtTime(a.currentTime);

      // Drive slide index from audio position
      var targetSlide = Math.min(
        Math.floor((a.currentTime / dur) * p.slides.length),
        p.slides.length - 1
      );
      if (targetSlide !== p.current) {
        showSlide(p, targetSlide);
      }

      p.rafId = requestAnimationFrame(tick);
    }
    p.rafId = requestAnimationFrame(tick);
  }

  function startTimerProgress(p) {
    clearInterval(p.tickId);
    var dur  = FALLBACK_DUR;
    var fill = p.el.querySelector('.csp-timer-fill');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      setTimeout(function() {
        fill.style.transition = 'width ' + dur + 'ms linear';
        fill.style.width = '100%';
      }, 30);
    }
    p.slideStart = Date.now();
    p.tickId = setInterval(function() {
      if (!p.playing) { clearInterval(p.tickId); return; }
      if (Date.now() - p.slideStart >= dur) {
        clearInterval(p.tickId);
        if (p.current < p.slides.length - 1) {
          gotoSlide(p, p.current + 1);
        } else {
          p.playing = false;
          updateControls(p);
        }
      }
    }, 200);
  }

  function startProgress(p) {
    if (p.audio) startProgressRAF(p);
    else          startTimerProgress(p);
  }

  function stopProgress(p) {
    clearInterval(p.tickId);
    cancelAnimationFrame(p.rafId);
  }

  // ── Slide navigation ─────────────────────────────────────────────────────

  function showSlide(p, idx) {
    p.current = Math.max(0, Math.min(idx, p.slides.length - 1));
    var stage = p.el.querySelector('.csp-stage');
    if (!stage) return;
    stage.innerHTML = renderSlide(p.slides[p.current], p.color);
    var items = stage.querySelectorAll('.csp-item');
    items.forEach(function(item, i) {
      item.style.animationDelay = (0.1 + i * 0.22) + 's';
    });
    updateControls(p);
  }

  function gotoSlide(p, idx) {
    // Seek audio to match target slide position
    if (p.audio && p.audio.duration) {
      var frac = idx / p.slides.length;
      p.audio.currentTime = frac * p.audio.duration;
      // showSlide will be driven by RAF tick after seek
      if (!p.playing) showSlide(p, idx);
    } else {
      var wasPlaying = p.playing;
      if (wasPlaying) stopProgress(p);
      showSlide(p, idx);
      if (wasPlaying) startProgress(p);
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────

  function updateControls(p) {
    var num = p.el.querySelector('.csp-num');
    if (num) num.innerHTML = (p.current + 1) + '&nbsp;/&nbsp;' + p.slides.length;

    var dots = p.el.querySelectorAll('.csp-dot');
    dots.forEach(function(d, i) { d.classList.toggle('csp-dot-active', i === p.current); });

    var btn = p.el.querySelector('.csp-play');
    if (btn) btn.innerHTML = p.playing ? '&#9646;&#9646;' : '&#9654;';

    var prev = p.el.querySelector('.csp-prev');
    if (prev) prev.disabled = p.current === 0;
    var next = p.el.querySelector('.csp-next');
    if (next) next.disabled = p.current === p.slides.length - 1;
  }

  function attachEvents(p) {
    var prev = p.el.querySelector('.csp-prev');
    var next = p.el.querySelector('.csp-next');
    var play = p.el.querySelector('.csp-play');
    var dots = p.el.querySelectorAll('.csp-dot');

    if (prev) prev.onclick = function() { gotoSlide(p, p.current - 1); };
    if (next) next.onclick = function() { gotoSlide(p, p.current + 1); };

    if (play) play.onclick = function() {
      p.playing = !p.playing;
      if (p.playing) {
        if (p.audio) p.audio.play().catch(function(){});
        startProgress(p);
      } else {
        if (p.audio) p.audio.pause();
        stopProgress(p);
      }
      updateControls(p);
    };

    dots.forEach(function(dot, i) {
      dot.onclick = function() { gotoSlide(p, i); };
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  global.CSP = {
    init: function(lessonId, el, audioSrc) {
      if (!el) return;
      var data = window.SLIDE_DATA && window.SLIDE_DATA[lessonId];
      if (!data || !data.length) { el.innerHTML = ''; return; }

      // Destroy existing instance
      if (players[lessonId]) {
        var old = players[lessonId];
        if (old.audio) { old.audio.pause(); old.audio.src = ''; }
        clearInterval(old.tickId);
        cancelAnimationFrame(old.rafId);
        delete players[lessonId];
      }

      var p = {
        id:       lessonId,
        slides:   data,
        current:  0,
        playing:  false,
        tickId:   null,
        rafId:    null,
        color:    getColor(lessonId),
        el:       el,
        audioSrc: audioSrc || null,
        audio:    null
      };
      players[lessonId] = p;

      el.innerHTML = buildHTML(p);
      if (p.audioSrc) initAudio(p);
      attachEvents(p);
      showSlide(p, 0);
    },

    destroyAll: function() {
      Object.keys(players).forEach(function(id) {
        var p = players[id];
        if (p.audio) { p.audio.pause(); p.audio.src = ''; }
        clearInterval(p.tickId);
        cancelAnimationFrame(p.rafId);
      });
      players = {};
    }
  };

})(window);
