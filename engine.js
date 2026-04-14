/**
 * engine.js — RE Lab Automata Engine
 *
 * Implements:
 *   1. Recursive-descent parser for regular expressions
 *   2. Thompson's NFA construction
 *   3. ε-closure and subset DFA construction
 *   4. NFA simulation for string acceptance
 *   5. BFS-based language equivalence checking
 *   6. BFS string enumeration (accepted strings up to length N)
 *
 * Supported syntax:
 *   Literals : a-z A-Z 0-9
 *   ε        : empty string
 *   ∅        : empty set (no accepted strings)
 *   +        : union
 *   concat   : implicit (juxtaposition)
 *   *        : Kleene star
 *   !        : one or more (= r·r*)
 *   ?        : zero or one (= r+ε)
 *   ()       : grouping
 */

/* ═══════════════════════════════════════════════════════
   STATE MANAGEMENT
═══════════════════════════════════════════════════════ */
let _stateCounter = 0;
function _freshState(accepting = false) {
  return {
    id: _stateCounter++,
    accepting,
    trans: {},   // sym -> [State]
    eps: []      // ε-transitions -> [State]
  };
}
function _resetStates() { _stateCounter = 0; }

/* ═══════════════════════════════════════════════════════
   TOKENIZER
═══════════════════════════════════════════════════════ */
function tokenize(re) {
  const tokens = [];
  for (let i = 0; i < re.length; i++) {
    const c = re[i];
    if (c === ' ') continue;
    if (c === 'ε') { tokens.push({ t: 'EPS', pos: i }); continue; }
    if (c === '∅') { tokens.push({ t: 'EMPTY', pos: i }); continue; }
    if ('()+*!?'.includes(c)) { tokens.push({ t: c, pos: i }); continue; }
    if (/[a-zA-Z0-9·]/.test(c)) { tokens.push({ t: 'LIT', v: c, pos: i }); continue; }
    tokens.push({ t: 'LIT', v: c, pos: i });
  }
  return tokens;
}

function validateRE(tokens) {
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].t === '(') depth++;
    if (tokens[i].t === ')') depth--;
    if (depth < 0) throw new Error("Unexpected closing parenthesis ')'");
  }
  if (depth > 0) throw new Error("Missing " + depth + " closing parenthesis ')'");

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = i > 0 ? tokens[i-1] : null;
    const next = i < tokens.length - 1 ? tokens[i+1] : null;
    
    if (t.t === '+') {
      if (!prev || prev.t === '+' || prev.t === '(') throw new Error("Missing left operand for union '+'");
      if (!next || next.t === '+' || next.t === ')') throw new Error("Missing right operand for union '+'");
    }
    if (['*', '!', '?'].includes(t.t)) {
      if (!prev || prev.t === '+' || prev.t === '(') {
         throw new Error("Operator '" + t.t + "' is applied to nothing");
      }
      if (['*', '!', '?'].includes(prev.t)) {
         throw new Error("Redundant/Nested repetition operators like '" + prev.t + t.t + "' are invalid");
      }
    }
    if (t.t === '(' && next && next.t === ')') {
       throw new Error("Empty subexpression '()' is invalid");
    }
  }
}

/* ═══════════════════════════════════════════════════════
   RECURSIVE-DESCENT PARSER + THOMPSON NFA
   Grammar:
     expr   → term ('+' term)*
     term   → factor (factor)*
     factor → atom ('*'|'!'|'?')*
     atom   → '(' expr ')' | EPS | EMPTY | LIT
═══════════════════════════════════════════════════════ */
function _unionNFA(n1, n2) {
  const s = _freshState(), a = _freshState(true);
  n1.end.accepting = false; n2.end.accepting = false;
  s.eps.push(n1.start, n2.start);
  n1.end.eps.push(a); n2.end.eps.push(a);
  return { start: s, end: a };
}

function _concatNFA(n1, n2) {
  n1.end.accepting = false;
  n1.end.eps.push(n2.start);
  return { start: n1.start, end: n2.end };
}

function _starNFA(n) {
  const s = _freshState(), a = _freshState(true);
  n.end.accepting = false;
  s.eps.push(n.start, a);
  n.end.eps.push(n.start, a);
  return { start: s, end: a };
}

function _plusNFA(n) {
  // r+ = r · r*  — duplicate NFA via a fresh parse of same structure is expensive;
  // instead: new start→n.start, n.end loops back to n.start and also goes to new accept
  const a = _freshState(true);
  n.end.accepting = false;
  n.end.eps.push(n.start, a);
  return { start: n.start, end: a };
}

function _questionNFA(n) {
  const s = _freshState(), a = _freshState(true);
  n.end.accepting = false;
  s.eps.push(n.start, a);
  n.end.eps.push(a);
  return { start: s, end: a };
}

function buildNFA(re) {
  _resetStates();
  const tokens = tokenize(re);
  validateRE(tokens); // Can throw an error
  let pos = 0;

  const peek  = () => pos < tokens.length ? tokens[pos] : null;
  const consume = () => tokens[pos++];

  function parseExpr() {
    let nfa = parseTerm();
    while (peek() && peek().t === '+') {
      consume();
      const right = parseTerm();
      nfa = _unionNFA(nfa, right);
    }
    return nfa;
  }

  function parseTerm() {
    let nfa = parseFactor();
    while (peek() && peek().t !== '+' && peek().t !== ')') {
      const right = parseFactor();
      nfa = _concatNFA(nfa, right);
    }
    return nfa;
  }

  function parseFactor() {
    let base = parseAtom();
    while (peek() && ['*', '!', '?'].includes(peek().t)) {
      const op = consume().t;
      if (op === '*') base = _starNFA(base);
      else if (op === '!') base = _plusNFA(base);
      else base = _questionNFA(base);
    }
    return base;
  }

  function parseAtom() {
    const t = peek();
    if (!t) {
      const s = _freshState(), a = _freshState(true);
      s.eps.push(a);
      return { start: s, end: a };
    }
    if (t.t === '(') {
      consume();
      const inner = parseExpr();
      if (peek() && peek().t === ')') consume();
      return inner;
    }
    if (t.t === 'EPS') {
      consume();
      const s = _freshState(), a = _freshState(true);
      s.eps.push(a);
      return { start: s, end: a };
    }
    if (t.t === 'EMPTY') {
      consume();
      const s = _freshState(), a = _freshState(false);
      return { start: s, end: a };
    }
    if (t.t === 'LIT') {
      consume();
      const s = _freshState(), a = _freshState(true);
      if (!s.trans[t.v]) s.trans[t.v] = [];
      s.trans[t.v].push(a);
      return { start: s, end: a };
    }
    consume();
    const s = _freshState(), a = _freshState(true);
    s.eps.push(a);
    return { start: s, end: a };
  }

  const nfa = parseExpr();
  if (pos < tokens.length) {
     throw new Error("Unexpected token '" + (tokens[pos].v || tokens[pos].t) + "' outside of expression");
  }
  return nfa;
}

/* ═══════════════════════════════════════════════════════
   NFA UTILITIES
═══════════════════════════════════════════════════════ */

/** Collect all reachable states from NFA start. Returns { stateList, stateMap } */
function collectStates(nfa) {
  const visited = new Map();
  const queue = [nfa.start];
  while (queue.length) {
    const s = queue.shift();
    if (visited.has(s.id)) continue;
    visited.set(s.id, s);
    for (const t of s.eps) if (!visited.has(t.id)) queue.push(t);
    for (const sym in s.trans) for (const t of s.trans[sym]) if (!visited.has(t.id)) queue.push(t);
  }
  return { stateList: [...visited.values()], stateMap: visited };
}

/** ε-closure of an array of states */
function epsClosure(states, stateMap) {
  const closure = new Map();
  const queue = [...states];
  for (const s of states) closure.set(s.id, s);
  while (queue.length) {
    const s = queue.shift();
    for (const t of (s.eps || [])) {
      if (!closure.has(t.id)) {
        closure.set(t.id, t);
        queue.push(t);
      }
    }
  }
  return closure; // Map id -> state
}

/** ε-closure starting from a set of state IDs using a stateMap */
function epsClosureIds(ids, stateMap) {
  const closure = new Set();
  const queue = [...ids];
  for (const id of ids) closure.add(id);
  while (queue.length) {
    const id = queue.shift();
    const s = stateMap.get(id);
    if (!s) continue;
    for (const t of (s.eps || [])) {
      if (!closure.has(t.id)) { closure.add(t.id); queue.push(t.id); }
    }
  }
  return closure; // Set of ids
}

/** Get alphabet of NFA */
function nfaAlphabet(nfa) {
  const { stateList } = collectStates(nfa);
  const alpha = new Set();
  for (const s of stateList) for (const sym in s.trans) alpha.add(sym);
  return [...alpha].sort();
}

/* ═══════════════════════════════════════════════════════
   NFA SIMULATION (for single string acceptance)
═══════════════════════════════════════════════════════ */
function nfaAccepts(nfa, str) {
  if (!nfa) return false;
  const { stateMap } = collectStates(nfa);

  // Replace ε in str with actual empty string
  const input = str === 'ε' ? '' : str;

  let current = epsClosureIds(new Set([nfa.start.id]), stateMap);
  for (const c of input) {
    const next = new Set();
    for (const id of current) {
      const s = stateMap.get(id);
      if (s && s.trans[c]) for (const t of s.trans[c]) next.add(t.id);
    }
    current = epsClosureIds(next, stateMap);
  }
  return [...current].some(id => stateMap.get(id)?.accepting);
}

/* ═══════════════════════════════════════════════════════
   SUBSET CONSTRUCTION → DFA
═══════════════════════════════════════════════════════ */
function nfaToDFA(nfa) {
  if (!nfa) return null;
  const { stateMap } = collectStates(nfa);
  const alpha = nfaAlphabet(nfa);

  const startIds = epsClosureIds(new Set([nfa.start.id]), stateMap);
  const key = (ids) => [...ids].sort((a, b) => a - b).join(',');

  const dfaStates   = [startIds];
  const dfaAccept   = [];
  const dfaTrans    = [];
  const dfaIndex    = { [key(startIds)]: 0 };

  const isAccepting = (ids) => [...ids].some(id => stateMap.get(id)?.accepting);
  dfaAccept.push(isAccepting(startIds));

  for (let i = 0; i < dfaStates.length; i++) {
    dfaTrans.push({});
    const cur = dfaStates[i];
    for (const sym of alpha) {
      // move
      const moved = new Set();
      for (const id of cur) {
        const s = stateMap.get(id);
        if (s && s.trans[sym]) for (const t of s.trans[sym]) moved.add(t.id);
      }
      if (moved.size === 0) { dfaTrans[i][sym] = -1; continue; }
      const cls = epsClosureIds(moved, stateMap);
      const k = key(cls);
      if (!(k in dfaIndex)) {
        dfaIndex[k] = dfaStates.length;
        dfaStates.push(cls);
        dfaAccept.push(isAccepting(cls));
        dfaTrans.push({});
      }
      dfaTrans[i][sym] = dfaIndex[k];
    }
  }

  return {
    numStates: dfaStates.length,
    transitions: dfaTrans,
    accepting: dfaAccept,
    alphabet: alpha
  };
}

/* ═══════════════════════════════════════════════════════
   DFA MINIMIZATION (Hopcroft's Algorithm)
═══════════════════════════════════════════════════════ */
function minimizeDFA(dfa) {
  if (!dfa || dfa.numStates === 0) return null;
  const { numStates, transitions, accepting, alphabet } = dfa;
  
  let P = [new Set(), new Set()];
  for (let i = 0; i < numStates; i++) {
    if (accepting[i]) P[0].add(i);
    else P[1].add(i);
  }
  P = P.filter(s => s.size > 0);
  
  let W = [...P];
  
  while (W.length > 0) {
    const A = W.shift();
    for (const c of alphabet) {
      const X = new Set();
      for (let i = 0; i < numStates; i++) {
        if (transitions[i] && transitions[i][c] !== undefined && transitions[i][c] !== -1 && A.has(transitions[i][c])) {
          X.add(i);
        }
      }
      
      const nextP = [];
      for (const Y of P) {
        const intersection = new Set([...Y].filter(x => X.has(x)));
        const difference = new Set([...Y].filter(x => !X.has(x)));
        
        if (intersection.size > 0 && difference.size > 0) {
          nextP.push(intersection);
          nextP.push(difference);
          
          const wIdx = W.findIndex(wSet => wSet === Y);
          if (wIdx !== -1) {
            W.splice(wIdx, 1);
            W.push(intersection);
            W.push(difference);
          } else {
            if (intersection.size <= difference.size) {
              W.push(intersection);
            } else {
              W.push(difference);
            }
          }
        } else {
          nextP.push(Y);
        }
      }
      P = nextP;
    }
  }
  
  const blockMap = new Array(numStates);
  let startBlock = 0;
  for (let b = 0; b < P.length; b++) {
    for (const s of P[b]) {
      blockMap[s] = b;
      if (s === 0) startBlock = b;
    }
  }
  
  if (startBlock !== 0) {
    const tempP = P[0];
    P[0] = P[startBlock];
    P[startBlock] = tempP;
    for (let b = 0; b < P.length; b++) {
      for (const s of P[b]) blockMap[s] = b;
    }
  }
  
  const minTransitions = [];
  const minAccepting = [];
  
  for (let b = 0; b < P.length; b++) {
    const representative = [...P[b]][0];
    minAccepting.push(accepting[representative]);
    const trans = {};
    for (const c of alphabet) {
      const dest = transitions[representative]?.[c];
      if (dest !== undefined && dest !== -1) {
        trans[c] = blockMap[dest];
      } else {
        trans[c] = -1;
      }
    }
    minTransitions.push(trans);
  }
  
  return {
    numStates: P.length,
    transitions: minTransitions,
    accepting: minAccepting,
    alphabet: alphabet
  };
}

/* ═══════════════════════════════════════════════════════
   DFA ACCEPTANCE
═══════════════════════════════════════════════════════ */
function dfaAccepts(dfa, str) {
  if (!dfa) return false;
  const input = str === 'ε' ? '' : str;
  let state = 0;
  for (const c of input) {
    const next = dfa.transitions[state]?.[c];
    if (next === undefined || next === -1) return false;
    state = next;
  }
  return dfa.accepting[state] === true;
}

/* ═══════════════════════════════════════════════════════
   STRING ENUMERATION (BFS over NFA)
═══════════════════════════════════════════════════════ */
function generateAcceptedStrings(re, maxLength, maxCount) {
  _resetStates();
  let nfa;
  try {
    nfa = buildNFA(re);
  } catch (e) {
    return null;
  }
  if (!nfa) return null;

  const { stateMap } = collectStates(nfa);
  const alpha = nfaAlphabet(nfa);
  if (alpha.length === 0) {
    // Only ε possible
    if (nfaAccepts(nfa, '')) return ['ε'];
    return [];
  }

  const results = [];
  const seen = new Set();

  // BFS: queue entries are { ids: Set<id>, str: string }
  const startIds = epsClosureIds(new Set([nfa.start.id]), stateMap);
  const queue = [{ ids: startIds, str: '' }];

  while (queue.length > 0 && results.length < maxCount) {
    const { ids, str } = queue.shift();

    // Check acceptance
    const isAcc = [...ids].some(id => stateMap.get(id)?.accepting);
    const display = str === '' ? 'ε' : str;
    if (isAcc && !seen.has(display)) {
      seen.add(display);
      results.push(display);
      if (results.length >= maxCount) break;
    }

    if (str.length >= maxLength) continue;

    // Expand
    for (const sym of alpha) {
      const moved = new Set();
      for (const id of ids) {
        const s = stateMap.get(id);
        if (s && s.trans[sym]) for (const t of s.trans[sym]) moved.add(t.id);
      }
      if (moved.size === 0) continue;
      const next = epsClosureIds(moved, stateMap);
      queue.push({ ids: next, str: str + sym });
    }
  }

  return results;
}

/* ═══════════════════════════════════════════════════════
   EQUIVALENCE CHECKING
   Algorithm: BFS over product (DFA₁ × DFA₂) states.
   A distinguishing string exists iff we reach a pair
   where exactly one of the two states is accepting.
═══════════════════════════════════════════════════════ */
function checkEquivalence(re1, re2) {
  _resetStates();
  let nfa1, nfa2;
  try {
    nfa1 = buildNFA(re1);
    _resetStates();
    nfa2 = buildNFA(re2);
  } catch (e) {
    return { error: 'Parse Error: ' + e.message };
  }

  if (!nfa1 || !nfa2) return { error: 'Parse error in one or both expressions.' };

  const dfa1 = nfaToDFA(nfa1);
  _resetStates();
  const dfa2 = nfaToDFA(nfa2);

  if (!dfa1 || !dfa2) return { error: 'DFA construction failed.' };

  const alpha = [...new Set([...dfa1.alphabet, ...dfa2.alphabet])].sort();

  // BFS over pairs (s1, s2)
  // s1=-1 means dead state in dfa1; s2=-1 dead in dfa2
  const visited = new Set();
  const queue = [{ s1: 0, s2: 0, str: '' }];
  visited.add('0,0');

  const acc1 = (s) => s >= 0 && dfa1.accepting[s] === true;
  const acc2 = (s) => s >= 0 && dfa2.accepting[s] === true;

  // Minimize DFAs for output rendering
  const minDfa1 = minimizeDFA(dfa1);
  const minDfa2 = minimizeDFA(dfa2);

  while (queue.length > 0) {
    const { s1, s2, str } = queue.shift();

    if (acc1(s1) !== acc2(s2)) {
      // Found distinguishing string
      return {
        equivalent: false,
        witness: str === '' ? 'ε' : str,
        inRE1: acc1(s1),
        inRE2: acc2(s2),
        minDfa1, minDfa2
      };
    }

    if (str.length >= 12) continue;

    for (const sym of alpha) {
      const n1 = s1 >= 0 ? (dfa1.transitions[s1]?.[sym] ?? -1) : -1;
      const n2 = s2 >= 0 ? (dfa2.transitions[s2]?.[sym] ?? -1) : -1;
      const k = `${n1},${n2}`;
      if (!visited.has(k)) {
        visited.add(k);
        queue.push({ s1: n1, s2: n2, str: str + sym });
      }
    }
  }

  return {
    equivalent: true,
    nfa1States: collectStates(nfa1).stateList.length,
    nfa2States: collectStates(nfa2).stateList.length,
    dfa1States: dfa1.numStates,
    dfa2States: dfa2.numStates,
    minDfa1, minDfa2
  };
}

/* ═══════════════════════════════════════════════════════
   RE ANALYSIS (for Builder panel)
═══════════════════════════════════════════════════════ */
function analyzeRE(re) {
  _resetStates();
  let nfa;
  try {
     nfa = buildNFA(re);
  } catch (e) {
     return { error: true, message: e.message };
  }
  if (!nfa) return { error: true, message: 'Unknown parsing error' };

  const { stateList } = collectStates(nfa);
  const alpha = nfaAlphabet(nfa);
  const dfa = nfaToDFA(nfa);
  const acceptsEps = nfaAccepts(nfa, '');
  const sampleStrings = generateAcceptedStrings(re, 6, 8);

  const minDfa = minimizeDFA(dfa);

  return {
    error: false,
    nfaStates: stateList.length,
    dfaStates: dfa ? dfa.numStates : '?',
    minDfaStates: minDfa ? minDfa.numStates : '?',
    minDfa: minDfa,
    alphabet: alpha,
    acceptsEps,
    sampleStrings: sampleStrings || []
  };
}

/* export for app.js */
window.REEngine = {
  buildNFA,
  nfaAccepts,
  nfaToDFA,
  minimizeDFA,
  dfaAccepts,
  generateAcceptedStrings,
  checkEquivalence,
  analyzeRE,
  collectStates,
  nfaAlphabet
};
