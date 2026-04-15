/**
 * app.js — RE Lab UI Logic
 * Wires up all tabs, palette, and engine calls.
 */

/* ═══════════════════════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════════════════════ */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  try { localStorage.setItem('relab-theme', isDark ? 'light' : 'dark'); } catch(e) {}
}

// Restore saved theme on load
(function() {
  try {
    const saved = localStorage.getItem('relab-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch(e) {}
})();


/* ═══════════════════════════════════════════════════════
   TAB NAVIGATION
═══════════════════════════════════════════════════════ */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

/* ═══════════════════════════════════════════════════════
   EXAMPLE LIBRARY — per-tab examples
═══════════════════════════════════════════════════════ */
const EXAMPLES = {
  builder: [
    { re: '(a+b)*abb',            desc: 'Strings ending with abb' },
    { re: '(0+1)*0',              desc: 'Binary strings ending in 0' },
    { re: 'a*b*a*',               desc: 'a\'s then b\'s then a\'s' },
    { re: '(aa+bb)*',             desc: 'Even-length same-char pairs' },
    { re: 'a(b+c)*d',             desc: 'Starts with a, ends with d' },
    { re: '(ab)!c?',              desc: 'One or more ab, optional c' },
    { re: '(a+ε)b*',              desc: 'Optional a followed by b\'s' },
    { re: '(0+1(01*0)*1)*',       desc: 'Binary multiples of 3' },
    { re: '(a+b)*a(a+b)(a+b)',    desc: '3rd-from-last is a' },
  ],
  generator: [
    { re: '(a+b)*abb',            desc: 'Strings ending with abb' },
    { re: 'a*b*',                 desc: 'Zero or more a\'s then b\'s' },
    { re: '(0+1)*',               desc: 'All binary strings' },
    { re: '(ab+ba)*',             desc: 'Alternating a and b pairs' },
    { re: '(a+b){0,4}',          desc: 'All strings up to length 4' },
    { re: 'a!b!c!',              desc: 'Non-empty a\'s, b\'s, c\'s' },
    { re: '(aa)*',                desc: 'Even-length a strings' },
    { re: '(a+b)*a(a+b)*',        desc: 'Contains at least one a' },
  ],
  tester: [
    { re: '(a+b)*abb',   desc: 'Ends with abb — try: abb, aabb, babb, ab', strings: 'abb\naabb\nbabb\nab\nba\nbbb\naababb' },
    { re: 'a*b*',        desc: 'a\'s then b\'s — try: aab, ab, b', strings: 'ab\naab\naabb\nbba\nba\naaa\nbbb' },
    { re: '(0+1)*0',     desc: 'Binary ending in 0 — try: 10, 110, 001', strings: '0\n10\n110\n001\n1\n11\n100' },
    { re: '(aa+bb)*',    desc: 'Even pairs — try: aabb, bbaa', strings: 'aabb\nbbaa\naabbbb\nab\nba\naaaa\nbbbb' },
    { re: '(ab)!',       desc: 'One or more ab — try: ab, abab', strings: 'ab\nabab\nababab\na\nb\nba\naab' },
  ],
  equiv: [
    { re1: '(a+b)*abb',        re2: '(a+b)*a(a+b)(a+b)',  desc: 'Not equivalent — different languages' },
    { re1: '(a*b*)*',          re2: '(a+b)*',              desc: 'Equivalent — both = all strings over {a,b}' },
    { re1: 'a*',               re2: '(aa)*+(aa)*a',        desc: 'Equivalent — all a-strings' },
    { re1: 'a(b+c)',           re2: 'ab+ac',               desc: 'Equivalent — distributivity' },
    { re1: '(ab+a)*',          re2: 'a(b+a)*+ε',           desc: 'Equivalent — Arden\'s lemma' },
    { re1: '(a+b)!',           re2: '(a+b)(a+b)*',         desc: 'Equivalent — plus = concat star' },
    { re1: 'a*b',              re2: 'b+a*ab',              desc: 'Equivalent — star expansion' },
    { re1: '(a+b)*a',          re2: '(a+b)*b',             desc: 'Not equivalent — end symbol differs' },
  ],
};

let _lastLoadedItem = null; // track which item is visually marked as loaded

/* ── Dropdown open/close ── */
function toggleExampleMenu() {
  const menu   = document.getElementById('example-menu');
  const caret  = document.getElementById('example-caret');
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    menu.classList.remove('open');
    caret.classList.remove('open');
  } else {
    refreshExampleMenu();
    menu.classList.add('open');
    caret.classList.add('open');
  }
}

/* Close when clicking outside */
document.addEventListener('click', e => {
  const loader = document.getElementById('example-loader');
  if (loader && !loader.contains(e.target)) {
    document.getElementById('example-menu')?.classList.remove('open');
    document.getElementById('example-caret')?.classList.remove('open');
  }
});

/* ── Build the menu items for the active tab ── */
function refreshExampleMenu() {
  const activeTab = document.querySelector('.tab-section.active')?.id?.replace('tab-', '') || 'builder';
  const examples  = EXAMPLES[activeTab] || [];
  const header    = document.getElementById('example-menu-header');
  const list      = document.getElementById('example-list');

  const tabLabels = { builder: 'Builder', generator: 'Generator', tester: 'Tester', equiv: 'Equivalence', reference: null };
  header.textContent = tabLabels[activeTab] ? `Examples for ${tabLabels[activeTab]}` : 'Examples';

  if (!examples.length) {
    list.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--text3);">No examples for this tab.</div>';
    return;
  }

  list.innerHTML = examples.map((ex, i) => {
    const label = activeTab === 'equiv'
      ? `${ex.re1}  ≡?  ${ex.re2}`
      : ex.re;
    return `<button class="example-item" onclick="loadExample('${activeTab}', ${i})">
      <span class="example-item-re">${escHtml(label)}</span>
      <span class="example-item-desc">${escHtml(ex.desc)}</span>
    </button>`;
  }).join('');
}

/* ── Load an example into the correct inputs ── */
function loadExample(tab, idx) {
  const ex = EXAMPLES[tab]?.[idx];
  if (!ex) return;

  if (tab === 'builder') {
    const inp = document.getElementById('re-main');
    if (inp) { inp.value = ex.re; syncAllFromMain(); runBuilderAnalysis(); }
  } else if (tab === 'generator') {
    const inp = document.getElementById('re-gen');
    if (inp) { inp.value = ex.re; }
  } else if (tab === 'tester') {
    const re = document.getElementById('re-test');
    const batch = document.getElementById('batch-input');
    if (re)    re.value = ex.re;
    if (batch && ex.strings) batch.value = ex.strings;
    // clear old results
    const sr = document.getElementById('single-result');
    const br = document.getElementById('batch-result');
    if (sr) sr.innerHTML = '';
    if (br) br.innerHTML = '<div class="output-empty">Batch results will appear here.</div>';
  } else if (tab === 'equiv') {
    const e1 = document.getElementById('re-eq1');
    const e2 = document.getElementById('re-eq2');
    if (e1) e1.value = ex.re1;
    if (e2) e2.value = ex.re2;
    // reset result boxes
    const resBox = document.getElementById('equiv-result');
    const detBox = document.getElementById('equiv-detail');
    if (resBox) { resBox.className = 'equiv-result-box pending'; resBox.innerHTML = '<div class="equiv-placeholder">Click Check Equivalence to run.</div>'; }
    if (detBox) detBox.innerHTML = '';
  }

  // Visual feedback: mark loaded item
  document.querySelectorAll('.example-item').forEach((btn, i) => {
    btn.classList.toggle('example-item-loaded', i === idx);
  });

  // Close menu after short delay so user sees the tick
  setTimeout(() => {
    document.getElementById('example-menu')?.classList.remove('open');
    document.getElementById('example-caret')?.classList.remove('open');
  }, 320);
}

/* Keep menu in sync with active tab on nav click */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // if menu is open, refresh its contents for the new tab
    if (document.getElementById('example-menu')?.classList.contains('open')) {
      setTimeout(refreshExampleMenu, 10);
    }
  });
});


document.querySelectorAll('.sym-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    insertAtCursor('re-main', btn.dataset.sym);
    runBuilderAnalysis();
  });
});

/* Snippet buttons — handle data-for attribute (equiv tab) or default to re-main */
document.querySelectorAll('.snippet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.for || 're-main';
    const inp = document.getElementById(target);
    if (!inp) return;
    inp.value = btn.dataset.snippet;
    inp.focus();
    if (target === 're-main') runBuilderAnalysis();
  });
});

/* ═══════════════════════════════════════════════════════
   INPUT UTILITIES
═══════════════════════════════════════════════════════ */
function insertAtCursor(inputId, text) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const start = inp.selectionStart;
  const end = inp.selectionEnd;
  inp.value = inp.value.slice(0, start) + text + inp.value.slice(end);
  inp.selectionStart = inp.selectionEnd = start + text.length;
  inp.focus();
}

function clearInput(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.value = '';
  inp.focus();
  if (inputId === 're-main') runBuilderAnalysis();
}

function backspaceInput(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const start = inp.selectionStart;
  const end = inp.selectionEnd;
  if (start !== end) {
    inp.value = inp.value.slice(0, start) + inp.value.slice(end);
    inp.selectionStart = inp.selectionEnd = start;
  } else if (start > 0) {
    inp.value = inp.value.slice(0, start - 1) + inp.value.slice(start);
    inp.selectionStart = inp.selectionEnd = start - 1;
  }
  inp.focus();
  if (inputId === 're-main') runBuilderAnalysis();
}

/* ═══════════════════════════════════════════════════════
   SLIDERS
═══════════════════════════════════════════════════════ */
function bindSlider(sliderId, outId) {
  const slider = document.getElementById(sliderId);
  const out = document.getElementById(outId);
  if (!slider || !out) return;
  slider.addEventListener('input', () => { out.textContent = slider.value; });
}
bindSlider('gen-maxlen', 'gen-maxlen-out');
bindSlider('gen-maxres', 'gen-maxres-out');

/* ═══════════════════════════════════════════════════════
   BUILDER — live analysis
═══════════════════════════════════════════════════════ */
const reMainInput = document.getElementById('re-main');
if (reMainInput) {
  reMainInput.addEventListener('keydown', e => {
     if (e.key === 'Enter') runBuilderAnalysis();
  }); // initial run on default value
}

function runBuilderAnalysis() {
  const re = (document.getElementById('re-main')?.value || '').trim();
  const panel = document.getElementById('builder-analysis');
  if (!panel) return;

  if (!re) {
    panel.innerHTML = '<div class="analysis-empty">Enter a regular expression above to see its analysis.</div>';
    return;
  }

  const result = REEngine.analyzeRE(re);

  if (result.error) {
    if (result.message && !result.message.includes("Parse error in regular expression")) {
       panel.innerHTML = `<div class="analysis-error">⚠ Parse error — ${escHtml(result.message)}</div>`;
    } else {
       panel.innerHTML = '<div class="analysis-error">⚠ Parse error — check parentheses and operators.</div>';
    }
    return;
  }

  const alphaStr = result.alphabet.length ? result.alphabet.join(', ') : '—';
  const samples = result.sampleStrings.length
    ? result.sampleStrings.map(s => `<span class="analysis-tag">${escHtml(s)}</span>`).join('')
    : '<span class="analysis-tag">∅ (no strings)</span>';

  panel.innerHTML = `
    <div class="analysis-grid single">
      <div class="stat-card">
        <div class="stat-num">${result.dfaStates}</div>
        <div class="stat-lbl">DFA States</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${result.minDfaStates}</div>
        <div class="stat-lbl">Minimized DFA States</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${result.alphabet.length}</div>
        <div class="stat-lbl">Alphabet Size</div>
      </div>
    </div>
    <div class="analysis-row">
      <span class="analysis-tag">Σ = { ${alphaStr} }</span>
      <span class="analysis-tag ${result.acceptsEps ? 'good' : ''}">
        Accepts ε: ${result.acceptsEps ? 'Yes' : 'No'}
      </span>
    </div>
    <div class="analysis-row" style="margin-top:8px;">
      <span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.15em;margin-right:8px;">Sample strings:</span>
      ${samples}
    </div>
    <div id="build-anim-panel" style="margin-top:1.5rem; border-top:1px solid var(--border2); padding-top:1rem;">
      <div class="output-header" style="margin-bottom: 12px; border-bottom: none; padding-bottom: 0; align-items: center;">
        <div>
          <span class="output-title">DFA Construction Simulation</span><br/>
          <span style="font-size:11px;color:var(--text3);" id="build-anim-status">Adding Initial State...</span>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 1rem;">
         <button class="primary-btn compact" id="build-btn-prev" onclick="buildPrevStep()" style="padding: 8px 16px;" disabled>&larr; Prev</button>
         <button class="primary-btn compact" id="build-btn-next" onclick="buildNextStep()" style="padding: 8px 16px;">Next &rarr;</button>
         <button class="icon-btn" id="build-btn-play" onclick="buildTogglePlay()" style="margin-left:auto; padding: 8px 16px;">Pause</button>
      </div>

      <div id="vis-network-container" style="width: 100%; height: 450px; background: var(--bg); border: 1.5px solid var(--border2); border-radius: 8px;"></div>
    </div>
  `;

  // Draw the minimized DFA
  if (result.minDfa) {
    drawMinimizedDFA('vis-network-container', result.minDfa, true);
  }
}

let _buildAnimContext = null;

function buildPrevStep() {
   if (!_buildAnimContext || _buildAnimContext.currentIndex <= 0) return;
   
   const step = _buildAnimContext.seq[_buildAnimContext.currentIndex];
   if (step.type === 'node') _buildAnimContext.visNodes.remove(step.val.id);
   if (step.type === 'edge') _buildAnimContext.visEdges.remove(step.val.id);
   
   _buildAnimContext.currentIndex--;
   updateBuildAnimUI();
}

function buildNextStep() {
   if (!_buildAnimContext || _buildAnimContext.currentIndex >= _buildAnimContext.seq.length - 1) return;
   _buildAnimContext.currentIndex++;
   
   const step = _buildAnimContext.seq[_buildAnimContext.currentIndex];
   if (step.type === 'node') _buildAnimContext.visNodes.add(step.val);
   if (step.type === 'edge') _buildAnimContext.visEdges.add(step.val);
   
   updateBuildAnimUI();
}

function buildTogglePlay() {
   if (!_buildAnimContext) return;
   const playBtn = document.getElementById('build-btn-play');
   if (_buildAnimContext.interval) {
       clearInterval(_buildAnimContext.interval);
       _buildAnimContext.interval = null;
       playBtn.textContent = 'Auto Play';
   } else {
       if (_buildAnimContext.currentIndex >= _buildAnimContext.seq.length - 1) {
           // Reset: remove all, re-add first
           _buildAnimContext.visNodes.clear();
           _buildAnimContext.visEdges.clear();
           _buildAnimContext.currentIndex = 0;
           const step = _buildAnimContext.seq[0];
           if (step.type === 'node') _buildAnimContext.visNodes.add(step.val);
           if (step.type === 'edge') _buildAnimContext.visEdges.add(step.val);
           updateBuildAnimUI();
       }
       playBtn.textContent = 'Pause';
       _buildAnimContext.interval = setInterval(() => {
           if (_buildAnimContext.currentIndex < _buildAnimContext.seq.length - 1) {
               buildNextStep();
           } else {
                clearInterval(_buildAnimContext.interval);
                _buildAnimContext.interval = null;
                const pb = document.getElementById('build-btn-play');
                if (pb) pb.textContent = 'Replay';
            }
       }, 1200);
   }
}

function updateBuildAnimUI() {
    if (!_buildAnimContext) return;
    const step = _buildAnimContext.seq[_buildAnimContext.currentIndex];
    const stat = document.getElementById('build-anim-status');
    if (stat) {
        if (step.type === 'node') {
            stat.innerHTML = `Placed State <strong>${step.val.id === 0 ? 'Start (q0)' : 'q' + step.val.id}</strong>`;
        } else {
            stat.innerHTML = `Placed Transition on <strong>'${step.val.label.trim()}'</strong>`;
        }
        if (_buildAnimContext.currentIndex === _buildAnimContext.seq.length - 1) {
            stat.innerHTML = `<span style="color:var(--green)">✓ DFA Construction Complete</span>`;
        }
    }
    
    const prevBtn = document.getElementById('build-btn-prev');
    const nextBtn = document.getElementById('build-btn-next');
    if (prevBtn) prevBtn.disabled = (_buildAnimContext.currentIndex === 0);
    if (nextBtn) nextBtn.disabled = (_buildAnimContext.currentIndex === _buildAnimContext.seq.length - 1);
}

let _animContext = null;

function animPrevStep() {
   if (!_animContext || _animContext.currentIndex <= 0) return;
   _animContext.currentIndex--;
   renderAnimStep();
}

function animNextStep() {
   if (!_animContext || _animContext.currentIndex >= _animContext.steps.length - 1) return;
   _animContext.currentIndex++;
   renderAnimStep();
}

function animTogglePlay() {
   if (!_animContext) return;
   const playBtn = document.getElementById('anim-btn-play');
   if (_animContext.interval) {
       clearInterval(_animContext.interval);
       _animContext.interval = null;
       playBtn.textContent = 'Auto Play';
   } else {
       if (_animContext.currentIndex >= _animContext.steps.length - 1) {
           _animContext.currentIndex = 0;
           renderAnimStep();
       }
       playBtn.textContent = 'Pause';
       _animContext.interval = setInterval(() => {
           if (_animContext.currentIndex < _animContext.steps.length - 1) {
               _animContext.currentIndex++;
               renderAnimStep();
           } else {
               animTogglePlay();
           }
       }, 1200);
   }
}

function renderAnimStep() {
   if (!_animContext) return;
   const step = _animContext.steps[_animContext.currentIndex];
   
   document.getElementById('gen-anim-string').innerHTML = step.strHtml;
   document.getElementById('gen-anim-status').innerHTML = step.statusHtml;
   
   // Reset all nodes/edges to default colors
   const nodeUpdates = _animContext.nodesArr.map(n => ({
      id: n.id,
      color: {
        background: (n.isStart && n.isAccept) ? '#00c9a7' : n.isAccept ? '#00ff9d' : (n.isStart ? '#5b48f8' : '#2a2850'),
        border: (n.isStart && n.isAccept) ? '#ffffff' : n.isAccept ? '#ffffff' : (n.isStart ? '#bdb2ff' : '#5450a0'),
        highlight: { background: '#7260f8', border: '#22d4fd' }
      }
   }));
   const edgeUpdates = _animContext.edgesDataArr.map(e => ({
      id: e.id,
      color: { color: '#7c6dff', highlight: '#22d4fd' },
      width: 2
   }));
   
   // Highlight active node
   if (step.node !== null) {
      const idx = nodeUpdates.findIndex(n => n.id === step.node);
      if (idx !== -1) {
         nodeUpdates[idx].color = { background: '#7260f8', border: '#22d4fd' };
      }
   }
   // Highlight active edge
   if (step.edge !== null) {
      const idx = edgeUpdates.findIndex(e => e.id === step.edge);
      if (idx !== -1) {
         edgeUpdates[idx].color = { color: '#22d4fd', highlight: '#22d4fd' };
         edgeUpdates[idx].width = 3.5;
      }
   }
   
   _animContext.visNodes.update(nodeUpdates);
   _animContext.visEdges.update(edgeUpdates);
   
   document.getElementById('anim-btn-prev').disabled = (_animContext.currentIndex === 0);
   document.getElementById('anim-btn-next').disabled = (_animContext.currentIndex === _animContext.steps.length - 1);
}

/* ── 2D Vis.js DFA Drawing ── */
function _makeVisNode(id, isStart, isAccept) {
  let label = 'q' + id;
  if (isStart && isAccept) label = '► q' + id + '\nSTART & FINAL';
  else if (isStart) label = '► q' + id + '\nSTART';
  else if (isAccept) label = 'q' + id + '\nFINAL';

  // Distinct color schemes:
  let bgColor, borderColor, fontColor, bdWidth, shadowColor;
  if (isStart && isAccept) {
    bgColor = '#00c9a7'; borderColor = '#ffffff'; fontColor = '#000000';
    bdWidth = 3; shadowColor = 'rgba(0,201,167,0.45)';
  } else if (isStart) {
    bgColor = '#5b48f8'; borderColor = '#bdb2ff'; fontColor = '#ffffff';
    bdWidth = 3; shadowColor = 'rgba(91,72,248,0.45)';
  } else if (isAccept) {
    bgColor = '#00ff9d'; borderColor = '#000000'; fontColor = '#000000';
    bdWidth = 3; shadowColor = 'rgba(0,255,157,0.45)';
  } else {
    bgColor = '#2a2850'; borderColor = '#7c6dff'; fontColor = '#ffffff';
    bdWidth = 2; shadowColor = 'rgba(84,80,160,0.3)';
  }

  return {
    id: id,
    label: label,
    isStart: isStart,
    isAccept: isAccept,
    shape: 'box',
    margin: { top: 12, bottom: 12, left: 16, right: 16 },
    font: {
      face: 'IBM Plex Mono, monospace',
      size: 16,
      color: fontColor,
      bold: { color: fontColor, size: 18, face: 'IBM Plex Mono, monospace' }
    },
    color: {
      background: bgColor,
      border: borderColor,
      highlight: { background: '#7260f8', border: '#22d4fd' },
      hover: { background: bgColor, border: '#22d4fd' }
    },
    borderWidth: bdWidth,
    borderWidthSelected: bdWidth + 2,
    shapeProperties: {
      borderRadius: 8
    },
    shadow: {
      enabled: true,
      color: shadowColor,
      size: 18, x: 0, y: 5
    },
    chosen: {
      node: function(values) {
        values.shadowSize = 26;
        values.shadowColor = 'rgba(34,212,253,0.5)';
      }
    }
  };
}

function _makeVisEdge(id, from, to, label) {
  const isSelf = (from === to);

  return {
    id: id,
    from: from,
    to: to,
    label: label,
    arrows: {
      to: { enabled: true, scaleFactor: 1.0, type: 'arrow' }
    },
    color: { color: '#7c6dff', highlight: '#fbc944', hover: '#9d8fff', opacity: 1.0 },
    font: {
      face: 'IBM Plex Mono, monospace',
      size: 15,
      color: '#ffffff',
      strokeWidth: 5,
      strokeColor: '#0f0e17',
      align: 'horizontal'
    },
    width: 2,
    hoverWidth: 1.5,
    selectionWidth: 2.5,
    smooth: { 
      enabled: true, 
      type: 'curvedCW', 
      roundness: isSelf ? 0.6 : 0.2 
    },
    selfReference: { size: 35, angle: Math.PI / 4 }
  };
}

function drawMinimizedDFA(containerId, minDfa, progressive = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // Destroy previous network if any
  if (container._network) {
      container._network.destroy();
      container._network = null;
  }
  container.innerHTML = '';
  
  const nodesArr = [];
  const edgesDataArr = [];

  for (let i = 0; i < minDfa.numStates; i++) {
    let isStart = (i === 0);
    let isAccept = minDfa.accepting[i];
    nodesArr.push(_makeVisNode(i, isStart, isAccept));
  }

  // Group edges by (from, to) pair
  const groupedEdges = {};
  for (let i = 0; i < minDfa.numStates; i++) {
    if (!minDfa.transitions[i]) continue;
    const tMap = minDfa.transitions[i];
    for (const sym in tMap) {
      const dest = tMap[sym];
      if (dest !== -1 && dest !== undefined) {
        const key = `${i}->${dest}`;
        if (!groupedEdges[key]) groupedEdges[key] = { from: i, to: dest, labels: [] };
        groupedEdges[key].labels.push(sym);
      }
    }
  }

  for (const key in groupedEdges) {
    const e = groupedEdges[key];
    edgesDataArr.push(_makeVisEdge(key, e.from, e.to, e.labels.join(', ')));
  }
  
  const visNodes = new vis.DataSet();
  const visEdges = new vis.DataSet();

  const numStates = minDfa.numStates;
  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: numStates <= 4 ? -200 : -160,
        centralGravity: 0.008,
        springLength: numStates <= 4 ? 250 : 200,
        springConstant: 0.03,
        damping: 0.5,
        avoidOverlap: 0.8
      },
      stabilization: { iterations: 350, updateInterval: 20 },
      minVelocity: 0.75
    },
    interaction: {
      hover: true,
      tooltipDelay: 80,
      zoomView: true,
      dragView: true,
      dragNodes: true,
      navigationButtons: false,
      multiselect: false
    },
    edges: {
      smooth: { type: 'curvedCW', roundness: 0.25 },
      chosen: {
        edge: function(values) {
          values.width = 3.5;
          values.color = '#22d4fd';
        }
      }
    },
    nodes: {
      chosen: {
        node: function(values) {
          values.shadowSize = 26;
        }
      }
    },
    layout: { improvedLayout: true }
  };

  const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
  container._network = network;

  if (progressive) {
      // BFS ordering for progressive build
      const seq = [];
      const visitedNodes = new Set();
      const visitedEdges = new Set();
      const q = [0];
      visitedNodes.add(0);
      seq.push({ type: 'node', val: nodesArr.find(n => n.id === 0) });
      while(q.length > 0) {
          const curr = q.shift();
          const outgoing = edgesDataArr.filter(e => e.from === curr);
          outgoing.forEach(e => {
              if(!visitedEdges.has(e.id)) {
                  visitedEdges.add(e.id);
                  if(!visitedNodes.has(e.to)) {
                      visitedNodes.add(e.to);
                      seq.push({ type: 'node', val: nodesArr.find(n => n.id === e.to) });
                      q.push(e.to);
                  }
                  seq.push({ type: 'edge', val: e });
              }
          });
      }
      
      _buildAnimContext = {
          seq: seq,
          currentIndex: 0,
          interval: null,
          network: network,
          visNodes: visNodes,
          visEdges: visEdges
      };
      
      if(seq.length > 0) {
          const firstStep = seq[0];
          if (firstStep.type === 'node') visNodes.add(firstStep.val);
          if (firstStep.type === 'edge') visEdges.add(firstStep.val);
          updateBuildAnimUI();
          _buildAnimContext.interval = setInterval(() => {
               if(_buildAnimContext.currentIndex < _buildAnimContext.seq.length - 1) {
                   buildNextStep();
               } else {
                   buildTogglePlay();
               }
          }, 1200);
      }
      return { network, visNodes, visEdges, nodesArr, edgesDataArr };
  } else {
      visNodes.add(nodesArr);
      visEdges.add(edgesDataArr);
      return { network, visNodes, visEdges, nodesArr, edgesDataArr };
  }
}

/* ═══════════════════════════════════════════════════════
   GENERATOR
═══════════════════════════════════════════════════════ */
function runGenerator() {
  const re = (document.getElementById('re-gen')?.value || '').trim();
  const maxLen = parseInt(document.getElementById('gen-maxlen')?.value || '10');
  const maxRes = parseInt(document.getElementById('gen-maxres')?.value || '100');
  const out = document.getElementById('gen-output');
  if (!out) return;

  if (!re) {
    out.innerHTML = '<div class="parse-error">Please enter a regular expression.</div>';
    return;
  }

  const results = REEngine.generateAcceptedStrings(re, maxLen, maxRes);

  if (!results) {
    out.innerHTML = '<div class="parse-error">⚠ Parse error in regular expression.</div>';
    return;
  }

  if (results.length === 0) {
    out.innerHTML = `<div class="output-empty">No strings accepted up to length ${maxLen}. The language may be empty (∅) or require longer strings.</div>`;
    return;
  }

  const pills = results
    .map((s, i) => `<span class="string-pill ${s === 'ε' ? 'empty-str' : ''}" style="animation-delay:${i * 0.025}s; cursor: pointer;" onclick="playAnimationForString('${s === 'ε' ? '' : escHtml(s)}')">${escHtml(s)}</span>`)
    .join('');

  out.innerHTML = `
    <div class="output-header">
      <div>
        <span class="output-title">Accepted strings for <code>${escHtml(re)}</code></span><br/>
        <span style="font-size:11px;color:var(--text3);">Click any string below to simulate it!</span>
      </div>
      <div class="output-count">${results.length}</div>
    </div>
    <div class="strings-grid">${pills}</div>
  `;

  // Start animated generation
  const panel = document.getElementById('gen-anim-panel');
  if (!panel) return;
  
  if (results.length > 0) {
    panel.style.display = 'block';
    
    // Pick an interesting string to animate immediately
    let targetStr = results.find(s => s !== 'ε' && s.length >= 2);
    if (!targetStr) targetStr = results.find(s => s !== 'ε') || '';
    
    playAnimationForString(targetStr);
  } else {
    panel.style.display = 'none';
  }
}

function playAnimationForString(targetStr) {
    const re = (document.getElementById('re-gen')?.value || '').trim();
    if (!re) return;
    
    if (_animContext && _animContext.interval) {
        clearInterval(_animContext.interval);
        document.getElementById('anim-btn-play').textContent = 'Auto Play';
    }
    
    const analysis = REEngine.analyzeRE(re);
    if (!analysis.minDfa) return;
    
    const { visNodes, visEdges, nodesArr, edgesDataArr } = drawMinimizedDFA('gen-vis-network', analysis.minDfa);
    
    const steps = [];
    let cState = 0;
    
    steps.push({
       strHtml: targetStr === '' ? 'ε' : targetStr,
       statusHtml: `Starting at initial state q0 with string <strong style="color:var(--accent2)">'${targetStr === '' ? 'ε' : targetStr}'</strong>`,
       node: cState, edge: null
    });
    
    if (targetStr !== '') {
        for(let i=0; i<targetStr.length; i++) {
           const char = targetStr[i];
           const nextState = analysis.minDfa.transitions[cState][char];
           const edgeId = `${cState}->${nextState}`;
           
           let formatted = targetStr.slice(0, i) + `<span style="color:#22d4fd; text-decoration: underline;">${char}</span>` + targetStr.slice(i + 1);
           
           steps.push({
              strHtml: formatted,
              statusHtml: `Transitioning on <strong>'${char}'</strong>...`,
              node: cState,
              edge: edgeId
           });
           
           cState = nextState;
           
           steps.push({
              strHtml: formatted,
              statusHtml: `Arrived at state q${cState}`,
              node: cState,
              edge: null
           });
        }
    }
    
    const isAccepting = analysis.minDfa.accepting[cState];
    steps.push({
        strHtml: targetStr === '' ? 'ε' : targetStr,
        statusHtml: `<span style="color:var(--${isAccepting?'green':'red'})">${isAccepting?'✓':'✗'} String Simulation Complete</span>. End state q${cState} is ${isAccepting ? 'accepting' : 'rejecting'}.`,
        node: cState, edge: null
    });
    
    _animContext = {
       steps: steps,
       currentIndex: 0,
       interval: null,
       visNodes: visNodes,
       visEdges: visEdges,
       nodesArr: nodesArr,
       edgesDataArr: edgesDataArr
    };
    
    renderAnimStep();
}

/* ═══════════════════════════════════════════════════════
   TESTER
═══════════════════════════════════════════════════════ */
function runSingleTest() {
  const re  = (document.getElementById('re-test')?.value || '').trim();
  const str = document.getElementById('single-test-str')?.value ?? '';
  const out = document.getElementById('single-result');
  if (!out) return;

  if (!re) { out.innerHTML = '<div class="parse-error">Enter a regular expression first.</div>'; return; }

  let nfa;
  try { nfa = REEngine.buildNFA(re); } catch(e) { out.innerHTML = `<div class="parse-error">⚠ Parse error — ${escHtml(e.message)}</div>`; return; }
  if (!nfa) { out.innerHTML = '<div class="parse-error">⚠ Parse error in regular expression.</div>'; return; }

  const accepted = REEngine.nfaAccepts(nfa, str);
  const display  = str === '' || str === 'ε' ? 'ε (empty string)' : `"${escHtml(str)}"`;

  out.innerHTML = accepted
    ? `<div class="test-result-badge accepted">✓ &nbsp; ${display} is <strong>accepted</strong></div>`
    : `<div class="test-result-badge rejected">✗ &nbsp; ${display} is <strong>rejected</strong></div>`;
}

/* Allow Enter key to trigger single test */
document.getElementById('single-test-str')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') runSingleTest();
});

function runBatchTest() {
  const re    = (document.getElementById('re-test')?.value || '').trim();
  const lines = (document.getElementById('batch-input')?.value || '').split('\n');
  const out   = document.getElementById('batch-result');
  if (!out) return;

  if (!re) { out.innerHTML = '<div class="parse-error">Enter a regular expression first.</div>'; return; }

  let nfa;
  try { nfa = REEngine.buildNFA(re); } catch(e) { out.innerHTML = `<div class="parse-error">⚠ Parse error — ${escHtml(e.message)}</div>`; return; }
  if (!nfa) { out.innerHTML = '<div class="parse-error">⚠ Parse error in regular expression.</div>'; return; }

  const strs = lines.map(l => l.trim()).filter(l => l.length > 0);
  if (strs.length === 0) { out.innerHTML = '<div class="output-empty">Enter strings to test above.</div>'; return; }

  let accepted = 0, rejected = 0;
  const rows = strs.map((s, i) => {
    const acc = REEngine.nfaAccepts(nfa, s);
    if (acc) accepted++; else rejected++;
    const display = s === 'ε' ? 'ε' : escHtml(s);
    return `<div class="batch-row ${acc ? 'acc' : 'rej'}" style="animation-delay:${i * 0.04}s">
      <span class="batch-str">${display}</span>
      <span class="batch-verdict ${acc ? 'acc' : 'rej'}">${acc ? '✓ accepted' : '✗ rejected'}</span>
    </div>`;
  }).join('');

  out.innerHTML = `
    <div class="batch-summary">${strs.length} strings tested · ${accepted} accepted · ${rejected} rejected</div>
    ${rows}
  `;
}

/* ═══════════════════════════════════════════════════════
   EQUIVALENCE
═══════════════════════════════════════════════════════ */
function runEquivalence() {
  const re1 = (document.getElementById('re-eq1')?.value || '').trim();
  const re2 = (document.getElementById('re-eq2')?.value || '').trim();
  const resBox = document.getElementById('equiv-result');
  const detBox = document.getElementById('equiv-detail');
  if (!resBox || !detBox) return;

  if (!re1 || !re2) {
    resBox.className = 'equiv-result-box pending';
    resBox.innerHTML = '<div class="equiv-placeholder">Enter both regular expressions.</div>';
    detBox.innerHTML = '';
    return;
  }

  const result = REEngine.checkEquivalence(re1, re2);

  if (result.error) {
    resBox.className = 'equiv-result-box not-equivalent';
    let errorMessage = result.error.replace('Parse Error: ', '');
    resBox.innerHTML = `<div class="equiv-verdict">Parse Error</div><div class="equiv-sub">${escHtml(errorMessage)}</div>`;
    detBox.innerHTML = '';
    return;
  }

  if (result.equivalent) {
    resBox.className = 'equiv-result-box equivalent';
    resBox.innerHTML = `
      <div class="equiv-verdict">✓ Equivalent</div>
      <div class="equiv-sub">Both expressions define the exact same language. No distinguishing string exists (checked up to length 12).</div>
    `;
    detBox.innerHTML = `
      <div class="equiv-check-row">
        <span class="check-icon pass">✓</span>
        <span class="check-text">L(<code>${escHtml(re1)}</code>) = L(<code>${escHtml(re2)}</code>)</span>
      </div>
      <div class="equiv-check-row">
        <span class="check-icon pass">✓</span>
        <span class="check-text">No BFS witness found over product automaton (DFA₁ × DFA₂)</span>
      </div>
      <div class="equiv-check-row">
        <span class="check-icon pass">✓</span>
        <span class="check-text">DFA₁: ${result.dfa1States} states · DFA₂: ${result.dfa2States} states</span>
      </div>
    `;
  } else {
    resBox.className = 'equiv-result-box not-equivalent';
    resBox.innerHTML = `
      <div class="equiv-verdict">✗ Not Equivalent</div>
      <div class="equiv-sub">A distinguishing witness string was found that separates the two languages.</div>
    `;
    detBox.innerHTML = `
      <div class="equiv-check-row">
        <span class="check-icon fail">✗</span>
        <span class="check-text">Witness string: <span class="check-code">${escHtml(result.witness)}</span></span>
      </div>
      <div class="equiv-check-row">
        <span class="check-icon ${result.inRE1 ? 'pass' : 'fail'}">${result.inRE1 ? '✓' : '✗'}</span>
        <span class="check-text">
          RE₁ (<code>${escHtml(re1)}</code>) ${result.inRE1 ? '<strong>accepts</strong>' : '<strong>rejects</strong>'} this string
        </span>
      </div>
      <div class="equiv-check-row">
        <span class="check-icon ${result.inRE2 ? 'pass' : 'fail'}">${result.inRE2 ? '✓' : '✗'}</span>
        <span class="check-text">
          RE₂ (<code>${escHtml(re2)}</code>) ${result.inRE2 ? '<strong>accepts</strong>' : '<strong>rejects</strong>'} this string
        </span>
      </div>
    `;
  }
  
  // Equivalence Animation
  const panel = document.getElementById('equiv-anim-panel');
  if (result.minDfa1 && result.minDfa2) {
      panel.style.display = 'block';
      
      const r1 = drawMinimizedDFA('equiv-vis-1', result.minDfa1);
      const r2 = drawMinimizedDFA('equiv-vis-2', result.minDfa2);
      
      let targetStr = '';
      if (!result.equivalent) {
         targetStr = result.witness === 'ε' ? '' : result.witness;
      } else {
         let accepted = REEngine.generateAcceptedStrings(re1, 10, 5) || [];
         let best = accepted.find(s => s !== 'ε' && s.length >= 2);
         if (!best) best = accepted.find(s => s !== 'ε') || '';
         targetStr = best;
      }
      
      const steps = [];
      let c1 = 0, c2 = 0;
      
      steps.push({
         strHtml: targetStr === '' ? 'ε' : targetStr,
         statusHtml: `Starting simultaneously at q0 for both machines with string <strong style="color:var(--accent2)">'${targetStr === '' ? 'ε' : targetStr}'</strong>`,
         node1: c1, edge1: null, node2: c2, edge2: null
      });
      
      if (targetStr !== '') {
          for(let i=0; i<targetStr.length; i++) {
             const char = targetStr[i];
             const nxt1 = result.minDfa1.transitions[c1] ? result.minDfa1.transitions[c1][char] : -1;
             const nxt2 = result.minDfa2.transitions[c2] ? result.minDfa2.transitions[c2][char] : -1;
             
             const edge1Id = `${c1}->${nxt1}`;
             const edge2Id = `${c2}->${nxt2}`;
             
             let formatted = targetStr.slice(0, i) + `<span style="color:#22d4fd; text-decoration: underline;">${char}</span>` + targetStr.slice(i + 1);
             
             steps.push({
                strHtml: formatted,
                statusHtml: `Both machines transitioning on <strong>'${char}'</strong>...`,
                node1: c1 === -1 ? null : c1, edge1: edge1Id,
                node2: c2 === -1 ? null : c2, edge2: edge2Id
             });
             
             c1 = nxt1 !== undefined && nxt1 !== -1 ? nxt1 : -1; 
             c2 = nxt2 !== undefined && nxt2 !== -1 ? nxt2 : -1;
             
             steps.push({
                strHtml: formatted,
                statusHtml: `Arrived at target states.`,
                node1: c1 === -1 ? null : c1, edge1: null,
                node2: c2 === -1 ? null : c2, edge2: null
             });
          }
      }
      
      const acc1 = c1 !== -1 && result.minDfa1.accepting[c1];
      const acc2 = c2 !== -1 && result.minDfa2.accepting[c2];
      
      steps.push({
          strHtml: targetStr === '' ? 'ε' : targetStr,
          statusHtml: result.equivalent ? 
             `<span style="color:var(--green)">✓ Both machines end in ${acc1 ? 'ACCEPTING' : 'REJECTING'} states! Equivalent.</span>` :
             `<span style="color:var(--amber)">⚠ Divergence! DFA1 is ${acc1?'accepting':'rejecting'}, DFA2 is ${acc2?'accepting':'rejecting'}.</span>`,
          node1: c1 === -1 ? null : c1, edge1: null,
          node2: c2 === -1 ? null : c2, edge2: null
      });
      
      if (_equivAnimContext && _equivAnimContext.interval) clearInterval(_equivAnimContext.interval);
      document.getElementById('equiv-btn-play').textContent = 'Auto Play';
      
      _equivAnimContext = {
          steps: steps, currentIndex: 0, interval: null,
          visNodes1: r1.visNodes, visEdges1: r1.visEdges, nodes1: r1.nodesArr, edges1: r1.edgesDataArr,
          visNodes2: r2.visNodes, visEdges2: r2.visEdges, nodes2: r2.nodesArr, edges2: r2.edgesDataArr
      };
      renderEquivAnimStep();
  } else {
      panel.style.display = 'none';
  }
}

let _equivAnimContext = null;

function equivPrevStep() {
   if (!_equivAnimContext || _equivAnimContext.currentIndex <= 0) return;
   _equivAnimContext.currentIndex--;
   renderEquivAnimStep();
}

function equivNextStep() {
   if (!_equivAnimContext || _equivAnimContext.currentIndex >= _equivAnimContext.steps.length - 1) return;
   _equivAnimContext.currentIndex++;
   renderEquivAnimStep();
}

function equivTogglePlay() {
   if (!_equivAnimContext) return;
   const playBtn = document.getElementById('equiv-btn-play');
   if (_equivAnimContext.interval) {
       clearInterval(_equivAnimContext.interval);
       _equivAnimContext.interval = null;
       playBtn.textContent = 'Auto Play';
   } else {
       if (_equivAnimContext.currentIndex >= _equivAnimContext.steps.length - 1) {
           _equivAnimContext.currentIndex = 0;
           renderEquivAnimStep();
       }
       playBtn.textContent = 'Pause';
       _equivAnimContext.interval = setInterval(() => {
           if (_equivAnimContext.currentIndex < _equivAnimContext.steps.length - 1) {
               _equivAnimContext.currentIndex++;
               renderEquivAnimStep();
           } else {
               equivTogglePlay();
           }
       }, 1200);
   }
}

function renderEquivAnimStep() {
   if (!_equivAnimContext) return;
   const step = _equivAnimContext.steps[_equivAnimContext.currentIndex];
   
   document.getElementById('equiv-anim-string').innerHTML = step.strHtml;
   document.getElementById('equiv-anim-status').innerHTML = step.statusHtml;
   
   // Reset DFA1 nodes/edges
   const n1Updates = _equivAnimContext.nodes1.map(n => ({
      id: n.id,
      color: {
        background: (n.isStart && n.isAccept) ? '#00c9a7' : n.isAccept ? '#00ff9d' : (n.isStart ? '#5b48f8' : '#2a2850'),
        border: (n.isStart && n.isAccept) ? '#ffffff' : n.isAccept ? '#ffffff' : (n.isStart ? '#bdb2ff' : '#5450a0'),
        highlight: { background: '#7260f8', border: '#22d4fd' }
      }
   }));
   const e1Updates = _equivAnimContext.edges1.map(e => ({
      id: e.id,
      color: { color: '#7c6dff', highlight: '#22d4fd' },
      width: 2
   }));
   
   // Reset DFA2 nodes/edges
   const n2Updates = _equivAnimContext.nodes2.map(n => ({
      id: n.id,
      color: {
        background: (n.isStart && n.isAccept) ? '#00c9a7' : n.isAccept ? '#00ff9d' : (n.isStart ? '#5b48f8' : '#2a2850'),
        border: (n.isStart && n.isAccept) ? '#ffffff' : n.isAccept ? '#ffffff' : (n.isStart ? '#bdb2ff' : '#5450a0'),
        highlight: { background: '#7260f8', border: '#22d4fd' }
      }
   }));
   const e2Updates = _equivAnimContext.edges2.map(e => ({
      id: e.id,
      color: { color: '#7c6dff', highlight: '#22d4fd' },
      width: 2
   }));
   
   // Highlight active DFA1 node/edge
   if (step.node1 !== null) {
       const idx = n1Updates.findIndex(n => n.id === step.node1);
       if (idx !== -1) n1Updates[idx].color = { background: '#7260f8', border: '#22d4fd' };
   }
   if (step.edge1 !== null) {
       const idx = e1Updates.findIndex(e => e.id === step.edge1);
       if (idx !== -1) { e1Updates[idx].color = { color: '#22d4fd', highlight: '#22d4fd' }; e1Updates[idx].width = 3.5; }
   }
   
   // Highlight active DFA2 node/edge
   if (step.node2 !== null) {
       const idx = n2Updates.findIndex(n => n.id === step.node2);
       if (idx !== -1) n2Updates[idx].color = { background: '#7260f8', border: '#22d4fd' };
   }
   if (step.edge2 !== null) {
       const idx = e2Updates.findIndex(e => e.id === step.edge2);
       if (idx !== -1) { e2Updates[idx].color = { color: '#22d4fd', highlight: '#22d4fd' }; e2Updates[idx].width = 3.5; }
   }
   
   _equivAnimContext.visNodes1.update(n1Updates);
   _equivAnimContext.visEdges1.update(e1Updates);
   _equivAnimContext.visNodes2.update(n2Updates);
   _equivAnimContext.visEdges2.update(e2Updates);
   
   document.getElementById('equiv-btn-prev').disabled = (_equivAnimContext.currentIndex === 0);
   document.getElementById('equiv-btn-next').disabled = (_equivAnimContext.currentIndex === _equivAnimContext.steps.length - 1);
}

/* ═══════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Keyboard shortcut: Enter on RE inputs triggers relevant action */
document.getElementById('re-gen')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') runGenerator();
});
document.getElementById('re-eq1')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') runEquivalence();
});
document.getElementById('re-eq2')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') runEquivalence();
});

/* Intro Landing Screen */
function closeIntroScreen() {
   const screen = document.getElementById('intro-screen');
   if (screen) {
       screen.style.opacity = '0';
       setTimeout(() => screen.style.display = 'none', 600);
   }
}

function initIntroParticles() {
   const container = document.getElementById('intro-particles');
   if (!container) return;
   const chars = ['*', '+', '!', '?', 'a', 'b', 'ε', '∅', '( )', '[ ]'];
   for(let i=0; i<40; i++) {
       const el = document.createElement('div');
       el.textContent = chars[Math.floor(Math.random() * chars.length)];
       el.style.position = 'absolute';
       el.style.left = Math.random() * 100 + 'vw';
       el.style.top = Math.random() * 100 + 'vh';
       el.style.fontSize = (12 + Math.random() * 40) + 'px';
       el.style.color = `rgba(${100 + Math.random() * 100}, ${100 + Math.random() * 155}, 255, ${0.05 + Math.random() * 0.15})`;
       el.style.fontFamily = 'IBM Plex Mono';
       el.style.transition = 'transform 0.1s linear';
       el.dataset.speedx = (Math.random() - 0.5) * 60;
       el.dataset.speedy = (Math.random() - 0.5) * 60;
       container.appendChild(el);
   }
}
document.addEventListener('DOMContentLoaded', initIntroParticles);

/* Interactive Antigravity Background Glow & Intro Parallax */
document.addEventListener('mousemove', e => {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = (e.clientX - cx) / cx; // -1 to 1
  const dy = (e.clientY - cy) / cy; // -1 to 1
  
  document.querySelectorAll('#intro-particles > div').forEach(el => {
      const sx = parseFloat(el.dataset.speedx);
      const sy = parseFloat(el.dataset.speedy);
      el.style.transform = `translate(${dx * sx}px, ${dy * sy}px)`;
  });

  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  document.documentElement.style.setProperty('--mouse-x', `${x}%`);
  document.documentElement.style.setProperty('--mouse-y', `${y}%`);
});
