//script.js – sudokubybits (bitmask-based potentials)

'use strict';

/*Bitmask helpers
  We use 9-bit masks for digits 1..9
  bit 0 -> digit 1, bit 8 -> digit 9*/

const digitMask = d => (1 << (d - 1));
const fullMask = () => (1 << 9) - 1; // 511
const maskToDigits = (mask) => {
    const arr = [];
    for (let d = 1; d <= 9; d++) if (mask & digitMask(d)) arr.push(d);
    return arr;
};
const maskCount = m => m.toString(2).replace(/0/g, '').length;

/*Board representation
   board.cells: array of 81 objects:
   { value: 0..9 (0 empty), fixed: bool (prefilled), potentials: 9-bit int }*/
const BOARD_SIZE = 9;
const CELLS = 81;

let state = {
    cells: new Array(CELLS).fill(null),
    selectedIdx: null,
    checkUsesLeft: 5,
    solution: null, // array[81] solution when generated
};

const boardEl = document.getElementById('board');
const messageEl = document.getElementById('message');
const selectedPosEl = document.getElementById('selected-pos');
const checkLeftEl = document.getElementById('check-left');
const digitButtonsRow = document.getElementById('digit-buttons');

function cellIndex(r, c) { return r * 9 + c; }
function rcFromIndex(i) { return [Math.floor(i / 9), i % 9]; }
function boxIndex(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

/*UI creation*/
function initUI() {}

/*Board helpers*/
function makeEmptyBoard() {
    state.cells = new Array(CELLS).fill(null).map(() => ({
        value: 0,
        fixed: false,
        potentials: fullMask(),
    }));
    state.selectedIdx = null;
    state.checkUsesLeft = 5;
    state.solution = null;
    updateUIStatus();
}

function updateUIStatus() {
    checkLeftEl.textContent = String(state.checkUsesLeft);
    selectedPosEl.textContent = state.selectedIdx === null
        ? 'none'
        : rcFromIndex(state.selectedIdx).join(',');
}

/*Recompute potentials for all empty cells*/
function recomputePotentials() {
    for (let i = 0; i < CELLS; i++) {
        const cell = state.cells[i];
        if (cell.value !== 0) {
            cell.potentials = (1 << 9) - 1; // not used
            continue;
        }

        const [r, c] = rcFromIndex(i);

        //exclude digits already present in row/col/box
        let mask = fullMask();

        for (let cc = 0; cc < 9; cc++) {
            const v = state.cells[cellIndex(r, cc)].value;
            if (v) mask &= ~digitMask(v);
        }

        for (let rr = 0; rr < 9; rr++) {
            const v = state.cells[cellIndex(rr, c)].value;
            if (v) mask &= ~digitMask(v);
        }

//box
const br = Math.floor(r/3)*3;
const bc = Math.floor(c/3)*3;
for (let rr = br; rr < br+3; rr++){
    for (let cc = bc; cc < bc+3; cc++){
        const v = state.cells[cellIndex(rr,cc)].value;
        if (v) mask &= ~digitMask(v);
    }
}
state.cells[i].potentials = mask;

/*UI render*/
function render(){
    recomputePotentials();

    for (let i = 0; i < CELLS; i++){
        const el = boardEl.children[i];
        const cell = state.cells[i];
        el.className = 'cell';
        if (cell.fixed) el.classList.add('prefilled');
        if (state.selectedIdx === i) el.classList.add('selected');
        if (cell.value !== 0){
            el.textContent = String(cell.value);
            el.title = cell.fixed ? 'prefilled' : 'user entry';
        }

        //remove any small pot container
        const sp = el.querySelector('.small-pot');
        if (sp) el.removeChild(sp);
        else {
            el.textContent = '';
            el.title = 'empty';
        }

        //show small potentials (tiny digits) to help users visually
        let sp = el.querySelector('.small-pot');
        if (!sp){
            sp = document.createElement('div');
            sp.className = 'small-pot';
            el.appendChild(sp);
        }

        sp.innerHTML = '';
        const pot = cell.potentials;
        for (let d = 1; d <= 9; d++){
            const c = document.createElement('div');
            c.textContent = (pot & digitMask(d)) ? d : '';
            sp.appendChild(c);
        }

        //mark invalid if it's violating rules
        if (cell.value !== 0 && isConflictAt(i)) el.classList.add('invalid');
    }

    updateUIStatus();
}

/*Event handlers*/
function selectCell(idx){
    const cell = state.cells[idx];
    if (cell.fixed) { showMsg('That cell is prefilled and cannot be changed.'); return; }
    state.selectedIdx = idx;
    render();
}

function onDigitClick(digit){
    if (state.selectedIdx === null){
        showMsg('Select a cell first.');
        return;
    }
    const idx = state.selectedIdx;
    const cell = state.cells[idx];
    if (cell.fixed){
        showMsg('Cannot change a prefilled cell.');
        return;
    }

    //check if placing this digit is invalid according to current board state
    if (!canPlaceDigit(idx, digit)){
        showMsg(`Cannot place ${digit} here — violates Sudoku rules.`);
        flashInvalid(idx);
        return;
    }
}

placeDigit(idx, digit, false);
showMsg('');
render();

/*Place or remove digit. If fixedFlag true, mark as prefilled (used when generating puzzles)*/
function placeDigit(idx, digit, fixedFlag=false){
  state.cells[idx].value = digit;
  state.cells[idx].fixed = fixedFlag;
}

/*After placing, recompute potentials for neighbors on render*/

/*Clear a cell value only if not fixed*/
function clearCell(idx){
  const cell = state.cells[idx];
  if (cell.fixed){
    showMsg('Cannot clear a prefilled cell.');
    return;
  }
  
  if (cell.value === 0){
    showMsg('Cell is already empty.');
    return;
  }
  
  state.cells[idx].value = 0;
  showMsg('');
  render();
}

/*Validation helpers*/
function canPlaceDigit(idx, digit){
  const [r, c] = rcFromIndex(idx);
  //row
  for (let cc=0; cc<9; cc++){
    if (state.cells[cellIndex(r,cc)].value === digit) return false;
  }
  //col
  for (let rr=0; rr<9; rr++){
    if (state.cells[cellIndex(rr,c)].value === digit) return false;
  }

//box
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for (let rr=br; rr<br+3; rr++){
    for (let cc=bc; cc<bc+3; cc++){
      if (state.cells[cellIndex(rr,cc)].value === digit) return false;
    }
  }
  return true;
}

/*detect if there's any conflict at idx (used to mark invalid)*/
function isConflictAt(idx){
  const val = state.cells[idx].value;
  if (!val) return false;
  const [r,c] = rcFromIndex(idx);
  //row
  for (let cc=0; cc<9; cc++){
    if (cc===c) continue;
    if (state.cells[cellIndex(r,cc)].value === val) return true;
  }
  //col
  for (let rr=0; rr<9; rr++){
    if (rr===r) continue;
    if (state.cells[cellIndex(rr,c)].value === val) return true;
  }
  //box
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for (let rr=br; rr<br+3; rr++){
    for (let cc=bc; cc<bc+3; cc++){
      const idx2 = cellIndex(rr,cc);
      if (idx2===idx) continue;
      if (state.cells[idx2].value === val) return true;
    }
  }
  return false;
}

/*flash invalid cell*/
function flashInvalid(idx){
  const el = boardEl.children[idx];
  el.classList.add('invalid');
  setTimeout(()=> el.classList.remove('invalid'), 700);
}

/*Solver - backtracking using bitmask potentials*/
      
/*The solver is implemented to:
-compute bitmasks for empty cells
-pick cell with minimum remaining values
-attempt solution via recursion and backtracking
-accepts an optional prefilled board as initial and returns a solved 
array if solvable or null.*/

function copyStateValuesToArray(){
  return state.cells.map(c => c.value);
}

function solveBoardFromArray(valuesArray, maxSolutions=1){
  //valuesArray is length 81 with 0 = empty
  //we'll maintain working arrays of values and potentials (masks)
  const vals = valuesArray.slice();
  const potentials = new Array(CELLS).fill(0);

  //compute initial potentials
  const computeAll = () => {
    for (let i=0; i<CELLS; i++) {
      if (vals[i] !== 0) { potentials[i] = 0; continue; }
      let mask = fullMask();
      const [r, c] = rcFromIndex(i);
      
      for (let cc=0; cc<9; cc++) {
        const v = vals[cellIndex(r,cc)]; if (v &&= ~digitMask(v));
      }
      for (let rr=0; rr<9; rr++) {
        const v = vals[cellIndex(rr,c)]; if (v &&= ~digitMask(v));
      }
      const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
      for (let rr=br; rr<br+3; rr++){
        for (let cc=bc; cc<bc+3; cc++){
          const v = vals[cellIndex(rr,cc)]; if (v &&= ~digitMask(v));
        }
      }
      potentials[i] = mask;
      if (mask === 0) return false; //unsolvable due to earlier contradictions
    }
    return true;
  };

if (!computeAll()) return null;

let solutionsFound = 0;
let firstSolution = null;

//pick empty cell with smallest mask count > 0
function pickCell(){
  let best = -1, bestCount = 10;
  for (let i=0; i<CELLS; i++){
    if (vals[i] === 0){
      const cnt = maskCount(potentials[i]);
      if (cnt < bestCount){
        bestCount = cnt; best = i;
      }
      if (cnt === 1) break;
    }
  }
  return best;
}

function recurse(){
  if (solutionsFound >= maxSolutions) return;
  
  const idx = pickCell();
  
  if (idx === -1){
    //solved
    solutionsFound++;
    firstSolution = vals.slice();
    return;
  }

  const mask = potentials[idx];
  //iterate through digits available
  for (let d=1; d<=9; d++){
    if (!(mask & digitMask(d))) continue;
    //place d
    vals[idx] = d;
    //remember old potentials to revert
    const oldPot = potentials.slice();

//update potentials locally (neighbors only)
const [r,c] = rcFromIndex(idx);
let contradiction=false;
const affect = (i) => {
  if (vals[i] === 0) {
    potentials[i] &= ~digitMask(d);
    if (potentials[i] === 0) contradiction = true;
  }
};

for (let cc=0; cc<9; cc++) affect(cellIndex(r,cc));
for (let rr=0; rr<9; rr++) affect(cellIndex(rr,c));
const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
for (let rr=br; rr<br+3; rr++){
  for (let cc=bc; cc<bc+3; cc++){
    affect(cellIndex(rr,cc));
  }
}

if (!contradiction) recurse();

//revert
vals[idx] = 0;
for (let i=0; i<CELLS; i++) potentials[i] = oldPot[i];

if (solutionsFound >= maxSolutions) break;
}
}

recurse();
return firstSolution;
}

function countSolutions(valuesArray, limit=2){
const sol = solveBoardFromArray(valuesArray, limit);
return sol ? 1 : 0; //quick check: this implementation only returns first solution
}

/*Puzzle generator*/
/*
-start from a fully valid solution, produced by solving a shuffled
seed
-remove numbers one by one while ensuring the board remains solvable (has
at least one solution)
-this guarantees the result is solvable that may have multiple solutions
*/

function generateFullSolution(){
  //create a random filled board by backtracking with random choices
  const vals = new Array(CELLS).fill(0);

  //compute potentials function for this local board
  const localPotentials = i => {
    if (vals[i] !== 0) return 0;
    let mask = fullMask();
    const [r, c] = rcFromIndex(i);
    for (let cc=0; cc<9; cc++) { const v = vals[cellIndex(r,cc)]; if (v) mask &= ~digitMask(v); }
    for (let rr=0; rr<9; rr++) { const v = vals[cellIndex(rr,c)]; if (v) mask &= ~digitMask(v); }
    const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
    for (let rr=br; rr<br+3; rr++){
      for (let cc=bc; cc<bc+3; cc++){
        const v = vals[cellIndex(rr,cc)]; if (v) mask &= ~digitMask(v);
      }
    }
    return mask;
  };

  function pickEmpty(){
    for (let i=0; i<CELLS; i++) if (vals[i] === 0) return i;
    return -1;
  }

function fill(){
  const idx = pickEmpty();
  if (idx === -1) return true;
  const mask = localPotentials(idx);
  const digits = maskToDigits(mask).sort(()=>Math.random()-0.5);
  for (const d of digits){
    vals[idx] = d;
    if (fill()) return true;
    vals[idx] = 0;
  }
  return false;
}

const ok = fill();
return ok ? vals : null;
}

function newPuzzle(){
  makeEmptyBoard();
  showMsg('Generating puzzle - please wait...');
  //generate full solution
  const solution = generateFullSolution();
  if (!solution){
    makeEmptyBoard(); showMsg('Failed to generate solution, try again.');
    return;
  }
  //copy into state as filled board, then remove cells
  state.solution = solution.slice();

  //start with solution in board (mark as fixed), then remove some cells
  for (let i=0; i<CELLS; i++){
    state.cells[i].value = solution[i];
    state.cells[i].fixed = true;
  }
}

//remove cells randomly but keep solvable (at least 1 solution)
const positions = [...Array(CELLS).keys()].sort(()=>Math.random()-0.5);
let removed = 0;
      
//attempt to create medium difficulty by removing ~45 cells
for (const pos of positions){
  const backup = state.cells[pos].value;
  state.cells[pos].value = 0;
  state.cells[pos].fixed = false;
  
  //ensure solvable from this partially-filled state
  const trial = state.cells.map(c => c.value);
  const sol = solveBoardFromArray(trial, 1);
  
  if (!sol){
    //can't remove, revert
    state.cells[pos].value = backup;
    state.cells[pos].fixed = true;
  } else {
    removed++;
  }
  //stop at a target removal
  if (removed >= 45) break;
}

state.checkUsesLeft = 5;
state.selectedIdx = null;
showMsg('');
render();
}

/*check functionality (limited uses)*/
function checkUserEntries(){
  if (state.checkUsesLeft <= 0){
    showMsg('No check uses left.');
    return;
  }
  state.checkUsesLeft--;
  updateUIStatus();
}

//compare non-empty user-entered cells to solution if we have a solution.
function checkSolution(){
  let solutionArr = state.solution;
  if (!solutionArr){
    //try solve from current configuration; if unsolvable, notify
    const trial = state.cells.map(c => c.value);
    const solved = solveBoardFromArray(trial, 1);
    if (!solved){
      showMsg('Current configuration is unsolvable.');
      render();
      return;
    } else {
      solutionArr = solved;
    }
  }

  //check user's entries against solutionArr
  let wrongCount = 0;
  for (let i=0; i<CELLS; i++){
    const val = state.cells[i].value;
    if (val !== 0 && val !== solutionArr[i]) wrongCount++;
  }
  
  if (wrongCount === 0) showMsg('All entered cells appear correct (so far...).');
  else showMsg(`Found ${wrongCount} incorrect cell(s).`);

  render();
}

/*solve (fill board with a solution, starting from current state)*/
function solveAndFill(confirmBefore=false){
  //solve using current board as starting point
  const trial = state.cells.map(c => c.value);
  const solved = solveBoardFromArray(trial, 1);

  if (!solved){
    showMsg('No solution exists for the current board.');
    return;
  }
  
  //fill visible board with solution (but keep prefilled cells as fixed)
  for (let i=0; i<CELLS; i++){
    if (!state.cells[i].fixed){
      state.cells[i].value = solved[i];
    }
  }

  // update solution stored in state
  state.solution = solved.slice();
  showMsg('Board solved.');
  render();
}

//keep solution for future checks
  state.solution = solved.slice();
  showMsg('Solution filled into board.');
  render();
}

function showMsg(txt){
  messageEl.textContent = txt || '';
}

/*start*/
initUI();
newPuzzle();
