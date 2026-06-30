// ─── Desktop Lyrics Widget Helper Module ──────────────────────────────────────

let state = null;
let getDoc = null;
let saveState = null;

export function initLyricsWidget(sharedState, sharedGetDoc, sharedSaveState) {
  state = sharedState;
  getDoc = sharedGetDoc;
  saveState = sharedSaveState;
  
  // Bind global toggle events (right-click / long-press / double-tap)
  bindGlobalToggleEvents();
}

let isGlobalToggleEventsBound = false;

function bindGlobalToggleEvents() {
  if (isGlobalToggleEventsBound) return;
  isGlobalToggleEventsBound = true;
  
  // Track long press timers
  let longPressTimer = null;
  let touchStartPos = { x: 0, y: 0 };
  
  // Track last tap time for double-tap
  let lastTapTime = 0;
  
  // Helper to check if coordinate is inside widget
  function isInsideWidget(clientX, clientY) {
    if (!getDoc) return false;
    var doc = getDoc();
    var el = doc.getElementById('fire-desktop-lyrics');
    if (!el || !state || !state.settings.desktopLyricsEnabled) return false;
    var rect = el.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }
  
  function toggleLockState() {
    if (!state) return;
    state.settings.desktopLyricsLocked = !state.settings.desktopLyricsLocked;
    if (saveState) saveState();
    
    // Trigger visual updates
    applyDesktopLyricsSettings();
    
    // Sync settings checkbox if open
    if (getDoc) {
      var lockChk = getDoc().getElementById('fire-setting-lyrics-lock');
      if (lockChk) lockChk.checked = state.settings.desktopLyricsLocked;
    }
    
    // Trigger small vibrate on mobile for haptic feedback
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(50);
    }
  }
  
  var doc = (getDoc ? getDoc() : document) || document;
  
  // 1. Contextmenu (Right-click on PC)
  doc.addEventListener('contextmenu', function(e) {
    if (!state || state.settings.desktopLyricsToggleMethod === 'none') return;
    
    // Check if click was inside widget
    if (isInsideWidget(e.clientX, e.clientY)) {
      e.preventDefault();
      toggleLockState();
    }
  });
  
  // 2. Touch/Mouse events for Mobile Long-press & Double-tap
  doc.addEventListener('touchstart', function(e) {
    if (!state || state.settings.desktopLyricsToggleMethod === 'none') return;
    
    var touch = e.touches[0];
    if (!isInsideWidget(touch.clientX, touch.clientY)) return;
    
    // Handle Double-tap
    if (state.settings.desktopLyricsToggleMethod === 'rightclick_doubletap') {
      var now = Date.now();
      if (now - lastTapTime < 300) {
        e.preventDefault();
        toggleLockState();
        lastTapTime = 0; // reset
        return;
      }
      lastTapTime = now;
    }
    
    // Handle Long-press
    if (state.settings.desktopLyricsToggleMethod === 'rightclick_longpress') {
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      var duration = state.settings.desktopLyricsLongPressTime || 800;
      
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(function() {
        e.preventDefault();
        toggleLockState();
        longPressTimer = null;
      }, duration);
    }
  }, { passive: false });
  
  doc.addEventListener('touchmove', function(e) {
    if (longPressTimer) {
      var touch = e.touches[0];
      var dx = touch.clientX - touchStartPos.x;
      var dy = touch.clientY - touchStartPos.y;
      // If moved significantly, cancel long press
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  });
  
  doc.addEventListener('touchend', function() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
}

export function ensureDesktopLyrics(lyricsList, lastActiveLineIdx) {
  if (!state || !getDoc) return;
  
  var doc = getDoc();
  var el = doc.getElementById('fire-desktop-lyrics');
  
  if (!state.settings.desktopLyricsEnabled) {
    if (el) el.remove();
    return;
  }
  
  if (!el) {
    el = doc.createElement('div');
    el.id = 'fire-desktop-lyrics';
    el.innerHTML = `
      <div class="fire-desktop-lyrics-toolbar">
        <span class="drag-title"><i class="fa-solid fa-arrows-up-down-left-right"></i> 桌面歌词</span>
        <span class="action-btn lock-btn" id="fire-desktop-lyrics-widget-lock" title="锁定"><i class="fa-solid fa-lock-open"></i></span>
      </div>
      <div class="fire-desktop-lyrics-content">
        <div class="fire-desktop-lyric-line current" id="fire-desktop-lyric-line-current">FIRE 音乐</div>
        <div class="fire-desktop-lyric-line translation" id="fire-desktop-lyric-line-translation" style="display: none;"></div>
      </div>
    `;
    doc.body.appendChild(el);
    
    // Bind widget lock button click
    var widgetLockBtn = el.querySelector('#fire-desktop-lyrics-widget-lock');
    if (widgetLockBtn) {
      widgetLockBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        state.settings.desktopLyricsLocked = true;
        if (saveState) saveState();
        applyDesktopLyricsSettings();
        
        // Sync setting checkbox if open
        var lockChk = doc.getElementById('fire-setting-lyrics-lock');
        if (lockChk) lockChk.checked = true;
      });
    }
    
    // Bind drag events (both mouse and touch support)
    bindDesktopLyricsDrag(el);
  }
  
  applyDesktopLyricsSettings();
  updateDesktopLyrics(lastActiveLineIdx, lyricsList);
}

export function applyDesktopLyricsSettings() {
  if (!state || !getDoc) return;
  
  var doc = getDoc();
  var el = doc.getElementById('fire-desktop-lyrics');
  if (!el) return;
  
  // Set locking class
  if (state.settings.desktopLyricsLocked) {
    el.classList.add('locked');
    el.classList.remove('unlocked');
  } else {
    el.classList.add('unlocked');
    el.classList.remove('locked');
  }
  
  // Apply colors & opacity
  el.style.color = state.settings.desktopLyricsTextColor || '#ffffff';
  
  // Apply z-index layer
  var zIndexVal = parseInt(state.settings.desktopLyricsZIndex, 10);
  if (isNaN(zIndexVal)) {
    zIndexVal = 99999; // Default fallback
  }
  el.style.setProperty('z-index', zIndexVal.toString(), 'important');
  
  // Apply font size
  var curLine = el.querySelector('.fire-desktop-lyric-line.current');
  var transLine = el.querySelector('.fire-desktop-lyric-line.translation');
  var baseSize = state.settings.desktopLyricsFontSize || 16;
  if (curLine) curLine.style.fontSize = baseSize + 'px';
  if (transLine) transLine.style.fontSize = Math.max(12, Math.round(baseSize * 0.75)) + 'px';
  
  // Convert hex background color to rgba with opacity
  var bgColor = state.settings.desktopLyricsBgColor || '#080d14';
  var opacity = (state.settings.desktopLyricsBgOpacity !== undefined ? state.settings.desktopLyricsBgOpacity : 60) / 100;
  
  // Basic parsing for hex to rgb
  var r = 8, g = 13, b = 20; // Default '#080d14'
  if (bgColor.startsWith('#')) {
    var hex = bgColor.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  }
  el.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  
  // Position
  var isMobile = (window.parent || window).innerWidth <= 760;
  if (state.settings.desktopLyricsLeft && state.settings.desktopLyricsTop) {
    el.style.left = state.settings.desktopLyricsLeft;
    el.style.top = state.settings.desktopLyricsTop;
    el.style.bottom = 'auto';
    el.style.right = 'auto';
  } else {
    if (isMobile) {
      // Default mobile position: top center, almost full width
      el.style.left = '10px';
      el.style.right = '10px';
      el.style.top = '20px';
      el.style.bottom = 'auto';
    } else {
      // Default desktop position: top center
      el.style.left = 'calc(50% - 150px)';
      el.style.top = '20px';
      el.style.bottom = 'auto';
      el.style.right = 'auto';
    }
  }
}

function bindDesktopLyricsDrag(el) {
  var isDragging = false;
  var startX, startY;
  var startLeft, startTop;
  
  // Mouse event listeners
  el.addEventListener('mousedown', function(e) {
    if (state.settings.desktopLyricsLocked) return;
    if (e.target.closest('.action-btn')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    var rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    e.preventDefault();
  });
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    
    var newLeft = startLeft + dx;
    var newTop = startTop + dy;
    
    var rect = el.getBoundingClientRect();
    
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
    
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
    el.style.bottom = 'auto';
    el.style.right = 'auto';
  }
  
  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    state.settings.desktopLyricsLeft = el.style.left;
    state.settings.desktopLyricsTop = el.style.top;
    if (saveState) saveState();
  }

  // Touch event listeners for mobile dragging
  el.addEventListener('touchstart', function(e) {
    if (state.settings.desktopLyricsLocked) return;
    if (e.target.closest('.action-btn')) return;
    
    var touch = e.touches[0];
    isDragging = true;
    startX = touch.clientX;
    startY = touch.clientY;
    
    var rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  
  function onTouchMove(e) {
    if (!isDragging) return;
    var touch = e.touches[0];
    
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;
    
    var newLeft = startLeft + dx;
    var newTop = startTop + dy;
    
    var rect = el.getBoundingClientRect();
    
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
    
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
    el.style.bottom = 'auto';
    el.style.right = 'auto';
    
    if (e.cancelable) e.preventDefault();
  }
  
  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    
    state.settings.desktopLyricsLeft = el.style.left;
    state.settings.desktopLyricsTop = el.style.top;
    if (saveState) saveState();
  }
}

export function updateDesktopLyrics(activeIdx, lyricsList) {
  if (!state || !getDoc) return;
  
  var doc = getDoc();
  var el = doc.getElementById('fire-desktop-lyrics');
  if (!el && state.settings.desktopLyricsEnabled) {
    ensureDesktopLyrics(lyricsList, activeIdx);
    return;
  }
  var curLine = doc.getElementById('fire-desktop-lyric-line-current');
  var transLine = doc.getElementById('fire-desktop-lyric-line-translation');
  if (!curLine) return;
  
  if (!state.settings.desktopLyricsEnabled) return;
  
  if (lyricsList && lyricsList.length > 0 && activeIdx >= 0 && activeIdx < lyricsList.length) {
    var item = lyricsList[activeIdx];
    curLine.textContent = item.text || '...';
    if (transLine) {
      transLine.textContent = item.translation || '';
      transLine.style.display = item.translation ? 'block' : 'none';
    }
  } else {
    if (state.currentSong) {
      curLine.textContent = state.currentSong.name + ' - ' + (Array.isArray(state.currentSong.artist) ? state.currentSong.artist.join(' / ') : state.currentSong.artist);
    } else {
      curLine.textContent = 'FIRE 音乐';
    }
    if (transLine) {
      transLine.textContent = '';
      transLine.style.display = 'none';
    }
  }
}

export function clampDesktopLyricsPosition() {
  if (!getDoc) return;
  
  var el = getDoc().getElementById('fire-desktop-lyrics');
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var left = parseFloat(el.style.left);
  var top = parseFloat(el.style.top);
  if (isNaN(left) || isNaN(top)) return;
  
  var newLeft = Math.max(0, Math.min(left, window.innerWidth - rect.width));
  var newTop = Math.max(0, Math.min(top, window.innerHeight - rect.height));
  
  el.style.left = newLeft + 'px';
  el.style.top = newTop + 'px';
  state.settings.desktopLyricsLeft = el.style.left;
  state.settings.desktopLyricsTop = el.style.top;
  if (saveState) saveState();
}
