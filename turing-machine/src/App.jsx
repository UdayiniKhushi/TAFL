import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Pause, SkipForward, RotateCcw, Plus, Trash2,
  ChevronDown, Zap, Layers, BookOpen, Info, Activity, Cpu
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// ███  TURING ENGINE  ███
// Pure logic — zero UI dependencies
// ═══════════════════════════════════════════════════════════════════════

const BLANK = "_";

/** Build an infinite tape from an input string */
function makeTape(input = "") {
  const cells = {};
  [...input].forEach((ch, i) => { cells[i] = ch; });
  return cells; // sparse map: index → symbol; missing = BLANK
}

function readCell(tape, pos) {
  return tape[pos] ?? BLANK;
}

function writeCell(tape, pos, sym) {
  const t = { ...tape };
  if (sym === BLANK) { delete t[pos]; } else { t[pos] = sym; }
  return t;
}

function moveHead(pos, dir) {
  if (dir === "R") return pos + 1;
  if (dir === "L") return pos - 1 ;//Math.max(0, pos - 1)
  return pos; // S = Stay
}

/**
 * Find the matching transition rule.
 * Rule shape: { from, reads: [sym,...], to, writes: [sym,...], moves: [dir,...] }
 */
function findRule(rules, state, reads) {
  return rules.find(r =>
    r.from === state &&
    r.reads.length === reads.length &&
    r.reads.every((s, i) => s === reads[i])
  ) ?? null;
}

/**
 * Execute one step on a k-tape machine.
 * Returns { newTapes, newHeads, newState, rule, halted, accepted }
 */
function engineStep(config) {
  const { tapes, heads, state, rules, acceptStates, rejectStates } = config;
  if (acceptStates.includes(state) || rejectStates.includes(state)) {
    return { ...config, halted: true, accepted: acceptStates.includes(state) };
  }
  const reads = heads.map((h, i) => readCell(tapes[i], h));
  const rule = findRule(rules, state, reads);

  if (!rule) {
    return { ...config, halted: true, accepted: false, activeRule: null };
  }

  const newTapes = tapes.map((tape, i) => writeCell(tape, heads[i], rule.writes[i]));
  const newHeads = heads.map((h, i) => moveHead(h, rule.moves[i]));

  const newState = rule.to;
  const halted = acceptStates.includes(newState) || rejectStates.includes(newState);
  const accepted = acceptStates.includes(newState);

  return {
    ...config,
    tapes: newTapes,
    heads: newHeads,
    state: newState,
    halted,
    accepted,
    activeRule: rule,
  };
}

function initConfig(numTapes, inputStr, rules, acceptStates, rejectStates, initialState = "q0") {
  const tapes = Array.from({ length: numTapes }, (_, i) =>
    i === 0 ? makeTape(inputStr) : makeTape("")
  );
  return {
    tapes,
    heads: Array(numTapes).fill(0),
    state: initialState,
    rules,
    acceptStates,
    rejectStates,
    halted: false,
    accepted: false,
    activeRule: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ███  PRESETS  ███
// ═══════════════════════════════════════════════════════════════════════

const PRESETS = {
  
  copier: {
    label: "Binary Copier (adaptive 1/2-tape)",
    description: "Copies input from Tape 1 → Tape 2 in O(n). A single-tape copier would take O(n²).",
    numTapes: 2,
    input: "10110",
    acceptStates: ["qAccept"],
    rejectStates: ["qReject"],
    initialState: "q0",
    rules: [],
  },
  // palindrome: {
  //   label: "Palindrome Checker (2-tape, O(n))",
  //   description: "2-tape palindrome check in O(n). Single-tape requires O(n²) back-and-forth scanning.",
  //   numTapes: 2,
  //   input: "abba",
  //   acceptStates: ["qAccept"],
  //   rejectStates: ["qReject"],
  //   initialState: "q0",
  //   rules: [
  //     // Phase 1: copy to tape 2
  //     { from: "q0", reads: ["a", "_"], to: "q0", writes: ["a", "a"], moves: ["R", "R"] },
  //     { from: "q0", reads: ["b", "_"], to: "q0", writes: ["b", "b"], moves: ["R", "R"] },
  //     { from: "q0", reads: ["_", "_"], to: "q1", writes: ["_", "_"], moves: ["L", "L"] },
  //     // Phase 2: rewind both left
  //     { from: "q1", reads: ["a", "a"], to: "q1", writes: ["a", "a"], moves: ["L", "L"] },
  //     { from: "q1", reads: ["b", "b"], to: "q1", writes: ["b", "b"], moves: ["L", "L"] },
  //     { from: "q1", reads: ["_", "_"], to: "q2", writes: ["_", "_"], moves: ["R", "R"] },
  //     // Phase 3: tape1 forward, tape2 backward — compare
  //     { from: "q2", reads: ["a", "a"], to: "q2", writes: ["a", "a"], moves: ["R", "L"] },
  //     { from: "q2", reads: ["b", "b"], to: "q2", writes: ["b", "b"], moves: ["R", "L"] },
  //     { from: "q2", reads: ["_", "_"], to: "qAccept", writes: ["_", "_"], moves: ["S", "S"] },
  //     { from: "q2", reads: ["a", "b"], to: "qReject", writes: ["a", "b"], moves: ["S", "S"] },
  //     { from: "q2", reads: ["b", "a"], to: "qReject", writes: ["b", "a"], moves: ["S", "S"] },
  //   ],
  // },
  addition: {
    label: "Unary Addition (adaptive 1/2/3-tape)",
    description: "Adds two unary numbers (e.g. 111+11 = 5 ones). Rules adapt: 1-tape uses O(n\u00b2) crossing, 2-tape and 3-tape use O(n) parallel strategies.",
    numTapes: 3,
    input: "111+11",
    acceptStates: ["qAccept"],
    rejectStates: ["qReject"],
    initialState: "q0",
    rules: [],
  },
  singleAnBn: {
    label: "aⁿbⁿ Checker (1-tape)",
    description: "Recognizes strings of form aⁿbⁿ using a single tape. Classic O(n²) crossing algorithm.",
    numTapes: 1,
    input: "aabb",
    acceptStates: ["qAccept"],
    rejectStates: ["qReject"],
    initialState: "q0",
    rules: [
      // Mark first 'a' as X, scan right to first 'b', mark as Y, repeat
      { from: "q0", reads: ["a"], to: "q1", writes: ["X"], moves: ["R"] },
      { from: "q0", reads: ["Y"], to: "q3", writes: ["Y"], moves: ["R"] },
      { from: "q0", reads: ["_"], to: "qReject", writes: ["_"], moves: ["S"] },
      { from: "q1", reads: ["a"], to: "q1", writes: ["a"], moves: ["R"] },
      { from: "q1", reads: ["Y"], to: "q1", writes: ["Y"], moves: ["R"] },
      { from: "q1", reads: ["b"], to: "q2", writes: ["Y"], moves: ["L"] },
      { from: "q1", reads: ["_"], to: "qReject", writes: ["_"], moves: ["S"] },
      { from: "q2", reads: ["a"], to: "q2", writes: ["a"], moves: ["L"] },
      { from: "q2", reads: ["Y"], to: "q2", writes: ["Y"], moves: ["L"] },
      { from: "q2", reads: ["X"], to: "q0", writes: ["X"], moves: ["R"] },
      { from: "q3", reads: ["Y"], to: "q3", writes: ["Y"], moves: ["R"] },
      { from: "q3", reads: ["_"], to: "qAccept", writes: ["_"], moves: ["S"] },
      { from: "q3", reads: ["b"], to: "qReject", writes: ["b"], moves: ["S"] },
    ],
  },
};
// ═══════════════════════════════════════════════════════════════════════
// ███  ADAPTIVE BINARY COPIER RULES  ███
// ═══════════════════════════════════════════════════════════════════════

function getCopierRules(numTapes) {
  if (numTapes === 1) {
    // ── 1-TAPE: O(n²) "w -> w#w" ──────────────────────────────────────
    // Strategy: Mark bit with X/Y, shuttle to end, write bit, return.
    return {
      numTapes: 1,
      description: "1-tape O(n²): Copies input to produce 'input#copy'.",
      rules: [
        // q0: Find the next bit to copy (0 or 1)
        { from: "q0", reads: ["0"], to: "qMoveRight0", writes: ["X"], moves: ["R"] },
        { from: "q0", reads: ["1"], to: "qMoveRight1", writes: ["Y"], moves: ["R"] },
        { from: "q0", reads: ["#"], to: "qCleanup",    writes: ["#"], moves: ["L"] },
        { from: "q0", reads: ["_"], to: "qCleanup",    writes: ["_"], moves: ["L"] },

        // --- Carrying a '0' ---
        // Move right past the rest of the original input
        { from: "qMoveRight0", reads: ["0"], to: "qMoveRight0", writes: ["0"], moves: ["R"] },
        { from: "qMoveRight0", reads: ["1"], to: "qMoveRight0", writes: ["1"], moves: ["R"] },
        // If we hit a Blank, this is the first bit. Write the '#' separator.
        { from: "qMoveRight0", reads: ["_"], to: "qWriteBit0",  writes: ["#"], moves: ["R"] },
        // If we hit a '#', we already have a separator. Skip to the end of the copy.
        { from: "qMoveRight0", reads: ["#"], to: "qSkipCopy0",  writes: ["#"], moves: ["R"] },

        { from: "qSkipCopy0", reads: ["0"], to: "qSkipCopy0", writes: ["0"], moves: ["R"] },
        { from: "qSkipCopy0", reads: ["1"], to: "qSkipCopy0", writes: ["1"], moves: ["R"] },
        { from: "qSkipCopy0", reads: ["_"], to: "qWriteBit0",  writes: ["_"], moves: ["S"] },

        { from: "qWriteBit0", reads: ["_"], to: "qReturn",     writes: ["0"], moves: ["L"] },

        // --- Carrying a '1' ---
        { from: "qMoveRight1", reads: ["0"], to: "qMoveRight1", writes: ["0"], moves: ["R"] },
        { from: "qMoveRight1", reads: ["1"], to: "qMoveRight1", writes: ["1"], moves: ["R"] },
        { from: "qMoveRight1", reads: ["_"], to: "qWriteBit1",  writes: ["#"], moves: ["R"] },
        { from: "qMoveRight1", reads: ["#"], to: "qSkipCopy1",  writes: ["#"], moves: ["R"] },

        { from: "qSkipCopy1", reads: ["0"], to: "qSkipCopy1", writes: ["0"], moves: ["R"] },
        { from: "qSkipCopy1", reads: ["1"], to: "qSkipCopy1", writes: ["1"], moves: ["R"] },
        { from: "qSkipCopy1", reads: ["_"], to: "qWriteBit1",  writes: ["_"], moves: ["S"] },

        { from: "qWriteBit1", reads: ["_"], to: "qReturn",     writes: ["1"], moves: ["L"] },

        // --- Return to Marker ---
        { from: "qReturn", reads: ["0"], to: "qReturn", writes: ["0"], moves: ["L"] },
        { from: "qReturn", reads: ["1"], to: "qReturn", writes: ["1"], moves: ["L"] },
        { from: "qReturn", reads: ["#"], to: "qReturn", writes: ["#"], moves: ["L"] },
        { from: "qReturn", reads: ["X"], to: "q0",       writes: ["X"], moves: ["R"] },
        { from: "qReturn", reads: ["Y"], to: "q0",       writes: ["Y"], moves: ["R"] },

        // --- Cleanup markers (X->0, Y->1) ---
        { from: "qCleanup", reads: ["X"], to: "qCleanup", writes: ["0"], moves: ["L"] },
        { from: "qCleanup", reads: ["Y"], to: "qCleanup", writes: ["1"], moves: ["L"] },
        { from: "qCleanup", reads: ["0"], to: "qCleanup", writes: ["0"], moves: ["L"] },
        { from: "qCleanup", reads: ["1"], to: "qCleanup", writes: ["1"], moves: ["L"] },
        { from: "qCleanup", reads: ["#"], to: "qCleanup", writes: ["#"], moves: ["L"] },
        { from: "qCleanup", reads: ["_"], to: "qAccept",  writes: ["_"], moves: ["R"] },
      ],
    };
  }

  // ── 2-TAPE: O(n) Parallel Copy ────────────────────────────────────
  return {
    numTapes: 2,
    description: "2-tape O(n): Tape 1 is read while Tape 2 is written. Much faster than 1-tape.",
    rules: [
      { from: "q0", reads: ["0", "_"], to: "q0", writes: ["0", "0"], moves: ["R", "R"] },
      { from: "q0", reads: ["1", "_"], to: "q0", writes: ["1", "1"], moves: ["R", "R"] },
      { from: "q0", reads: ["_", "_"], to: "qAccept", writes: ["_", "_"], moves: ["S", "S"] },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ███  ADAPTIVE UNARY ADDITION RULES  ███
// Returns the correct rules + numTapes for 1, 2, or 3 tape modes.
// ═══════════════════════════════════════════════════════════════════════

function getAdditionRules(numTapes) {
  if (numTapes === 1) {
    // ── 1-TAPE: O(n²) crossing algorithm ──────────────────────────────
    // Tape layout: 111+11  (e.g. 3+2)
    // Strategy: repeatedly mark one '1' before '+' as 'X', then find
    // one '1' after '+' and mark it 'X', repeat until one side runs out.
    // Accept if both sides exhausted simultaneously, else reject.
    return {
      numTapes: 1,
      description: "1-tape O(n²): scans back and forth marking pairs of 1s.",
      rules: [
        { from: "q0", reads: ["1"], to: "q0", writes: ["1"], moves: ["R"] },
        { from: "q0", reads: ["+"], to: "q1", writes: ["1"], moves: ["R"] },
        { from: "q1", reads: ["1"], to: "q1", writes: ["1"], moves: ["R"] },
        { from: "q1", reads: ["_"], to: "q2", writes: ["_"], moves: ["L"] },
        { from: "q2", reads: ["1"], to: "qAccept", writes: ["_"], moves: ["S"] },
      ],
    };
  }

  if (numTapes === 2) {
    // ── 2-TAPE: O(n) strategy ─────────────────────────────────────────
    // Tape 1: holds original input 111+11 (read-only scan)
    // Tape 2: accumulates the result (sum of all 1s on both sides)
    // Pass 1 (q0): copy all '1' before '+' onto Tape 2
    // Pass 2 (q1): after '+', copy all '1' after '+' onto Tape 2
    // q2: rewind Tape 2 to start and accept
    return {
      numTapes: 2,
      description: "2-tape O(n): one pass copies all 1s onto Tape 2 as the sum.",
      rules: [
        // Phase 1: copy 1s before '+' to tape 2
        { from: "q0", reads: ["1", "_"], to: "q0", writes: ["1", "1"], moves: ["R", "R"] },
        { from: "q0", reads: ["+", "_"], to: "q1", writes: ["+", "_"], moves: ["R", "S"] },
        // Phase 2: copy 1s after '+' to tape 2
        { from: "q1", reads: ["1", "_"], to: "q1", writes: ["1", "1"], moves: ["R", "R"] },
        // Done — tape 2 holds the sum
        { from: "q1", reads: ["_", "_"], to: "qAccept", writes: ["_", "_"], moves: ["S", "S"] },
      ],
    };
  }

  // ── 3-TAPE: O(n) strategy ───────────────────────────────────────────
  // Tape 1: original input (read)
  // Tape 2: accumulates 1s from before '+' (first operand)
  // Tape 3: accumulates 1s from after '+' (second operand)
  // Result is on Tape 2 (= first operand + second operand 1s concatenated)
  return {
    numTapes: 3,
    description: "3-tape: T1 ends with 1st num, T2 ends with 2nd num, T3 is the Sum.",
    rules: [
      // Phase 1: Read 1st number from T1. 
      // Keep it on T1, write it to T3 (Output).
      { 
        from: "q0", reads: ["1", "_", "_"], 
        to: "q0",   writes: ["1", "_", "1"], 
        moves: ["R", "S", "R"] 
      },

      // Phase 2: Found '+'. 
      // Erase '+' from T1 so T1 only contains the first number.
      { 
        from: "q0", reads: ["+", "_", "_"], 
        to: "q1",   writes: ["_", "_", "_"], 
        moves: ["R", "S", "S"] 
      },

      // Phase 3: Read 2nd number from T1. 
      // Erase from T1, write to T2 (Storage) AND T3 (Output).
      { 
        from: "q1", reads: ["1", "_", "_"], 
        to: "q1",   writes: ["_", "1", "1"], 
        moves: ["R", "R", "R"] 
      },

      // Phase 4: End of input.
      { 
        from: "q1", reads: ["_", "_", "_"], 
        to: "qAccept", writes: ["_", "_", "_"], 
        moves: ["S", "S", "S"] 
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ███  TAPE VIEW COMPONENT  ███
// ═══════════════════════════════════════════════════════════════════════

const TAPE_COLORS = ["#3b82f6", "#f59e0b", "#10b981"];
const CELL_W = 44;
const VISIBLE_CELLS = 23;

function TapeView({ tape, head, tapeIndex, label, isActive, halted, accepted }) {
  const scrollRef = useRef(null);
  const color = TAPE_COLORS[tapeIndex % TAPE_COLORS.length];

  // Compute visible window around head
  const minKey = Math.min(0, ...Object.keys(tape).map(Number));
  const maxKey = Math.max(VISIBLE_CELLS, head + 5, ...Object.keys(tape).map(Number));
  const start = Math.max(minKey, head - Math.floor(VISIBLE_CELLS / 2));
  const end = start + VISIBLE_CELLS;

  const cells = Array.from({ length: end - start }, (_, i) => {
    const pos = start + i;
    return { pos, sym: readCell(tape, pos) };
  });

  useEffect(() => {
    if (scrollRef.current) {
      const headOffset = (head - start) * CELL_W - (VISIBLE_CELLS / 2) * CELL_W;
      scrollRef.current.scrollLeft = Math.max(0, headOffset);
    }
  }, [head, start]);

  const headColor = halted ? (accepted ? "#22c55e" : "#ef4444") : color;

  return (
    <div style={{
      background: "#0a0f1e",
      border: `1px solid ${isActive ? color + "60" : "#1e293b"}`,
      borderRadius: 10,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderBottom: "1px solid #1e293b",
        background: "#060c18",
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: color,
          boxShadow: isActive ? `0 0 8px ${color}` : "none",
          transition: "box-shadow 0.3s",
        }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          fontWeight: 600,
          color: "#64748b",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}>
          {label}
        </span>
        <span style={{
          marginLeft: "auto",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "#334155",
        }}>
          HEAD@<span style={{ color }}>{head}</span>
        </span>
      </div>

      {/* Cells */}
      <div style={{ padding: "10px 12px 18px", position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            display: "flex",
            overflowX: "hidden",
            gap: 0,
          }}
        >
          {cells.map(({ pos, sym }) => {
            const isHead = pos === head;
            return (
              <div
                key={pos}
                style={{
                  minWidth: CELL_W,
                  width: CELL_W,
                  height: 48,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight: "1px solid #1e293b",
                  borderTop: isHead ? `2px solid ${headColor}` : "2px solid transparent",
                  borderBottom: isHead ? `2px solid ${headColor}` : "2px solid transparent",
                  borderLeft: isHead ? `1px solid ${headColor}` : "1px solid #1e293b",
                  background: isHead
                    ? `${headColor}22`
                    : pos % 2 === 0 ? "#080d18" : "#060a14",
                  transition: "all 0.15s ease",
                  position: "relative",
                  boxShadow: isHead ? `0 0 16px ${headColor}44, inset 0 0 10px ${headColor}18` : "none",
                }}
              >
                {/* Index */}
                <span style={{
                  position: "absolute",
                  top: 3,
                  right: 4,
                  fontSize: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: isHead ? headColor + "aa" : "#1e293b",
                }}>
                  {pos}
                </span>
                {/* Symbol */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  fontWeight: isHead ? 700 : 400,
                  color: isHead ? headColor : sym === BLANK ? "#1e3a5f" : "#7dd3fc",
                  letterSpacing: "0.05em",
                }}>
                  {sym === BLANK ? "□" : sym}
                </span>
                {/* Head arrow */}
                {isHead && (
                  <div style={{
                    position: "absolute",
                    bottom: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0, height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: `6px solid ${headColor}`,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ███  STATE DIAGRAM (D3-style SVG, no library needed)  ███
// ═══════════════════════════════════════════════════════════════════════

function useForceLayout(nodes, edges) {
  const [positions, setPositions] = useState({});

  useEffect(() => {
    if (!nodes.length) return;

    // Simple circular + force-based layout
    const n = nodes.length;
    const cx = 300, cy = 200, r = Math.min(150, n * 20 + 60);
    const pos = {};

    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      pos[node.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });

    // Special: start state q0 on the left
    if (pos["q0"]) { pos["q0"] = { x: 80, y: cy }; }

    // Accept/reject at right
    nodes.forEach(nd => {
      if (nd.isAccept && pos[nd.id]) pos[nd.id].x = 520;
      if (nd.isReject && pos[nd.id]) pos[nd.id] = { x: 520, y: cy + 80 };
    });

    setPositions(pos);
  }, [JSON.stringify(nodes.map(n => n.id))]);

  return positions;
}

function StateDiagram({ rules, acceptStates, rejectStates, activeState, activeRule }) {
  const svgRef = useRef(null);

  // Build nodes
  const allStates = useMemo(() => {
    const s = new Set(["q0"]);
    rules.forEach(r => { s.add(r.from); s.add(r.to); });
    acceptStates.forEach(a => s.add(a));
    rejectStates.forEach(r => s.add(r));
    return [...s];
  }, [rules, acceptStates, rejectStates]);

  const nodes = useMemo(() => allStates.map(id => ({
    id,
    isAccept: acceptStates.includes(id),
    isReject: rejectStates.includes(id),
    isActive: id === activeState,
  })), [allStates, acceptStates, rejectStates, activeState]);

  // Build edges (group multi-rules between same pair)
  const edgeMap = useMemo(() => {
    const map = {};
    rules.forEach(r => {
      const key = `${r.from}→${r.to}`;
      if (!map[key]) map[key] = { from: r.from, to: r.to, labels: [], rules: [] };
      const label = `${r.reads.join(",")}/${r.writes.join(",")}`;
      map[key].labels.push(label);
      map[key].rules.push(r);
    });
    return Object.values(map);
  }, [rules]);

  const positions = useForceLayout(nodes, edgeMap);

  const NODE_R = 28;
  const W = 600, H = 380;

  if (!Object.keys(positions).length) return (
    <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#334155", fontSize: 12, fontFamily: "monospace" }}>No states to display</span>
    </div>
  );

  // Helper: get edge midpoint / curve control
  function edgePath(from, to) {
    const s = positions[from], e = positions[to];
    if (!s || !e) return "";
    if (from === to) {
      // Self-loop
      return `M ${s.x} ${s.y - NODE_R} C ${s.x + 60} ${s.y - 90}, ${s.x + 60} ${s.y - 30}, ${s.x + NODE_R} ${s.y - 10}`;
    }
    const dx = e.x - s.x, dy = e.y - s.y;
    const mx = s.x + dx * 0.5 - dy * 0.15;
    const my = s.y + dy * 0.5 + dx * 0.15;
    return `M ${s.x} ${s.y} Q ${mx} ${my} ${e.x} ${e.y}`;
  }

  function labelPos(from, to) {
    const s = positions[from], e = positions[to];
    if (!s || !e) return { x: 0, y: 0 };
    if (from === to) return { x: s.x + 55, y: s.y - 70 };
    return { x: (s.x + e.x) / 2 - (e.y - s.y) * 0.15, y: (s.y + e.y) / 2 + (e.x - s.x) * 0.15 };
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, background: "transparent" }}
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
        </marker>
        <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
        </marker>
        <filter id="glow-blue">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {edgeMap.map((edge, ei) => {
        const isActiveEdge = activeRule &&
          activeRule.from === edge.from && activeRule.to === edge.to;
        const path = edgePath(edge.from, edge.to);
        const lp = labelPos(edge.from, edge.to);
        const label = edge.labels.slice(0, 2).join(" | ") + (edge.labels.length > 2 ? "…" : "");

        return (
          <g key={ei}>
            <path
              d={path}
              fill="none"
              stroke={isActiveEdge ? "#3b82f6" : "#1e3a5f"}
              strokeWidth={isActiveEdge ? 2.5 : 1.5}
              markerEnd={isActiveEdge ? "url(#arrow-active)" : "url(#arrow)"}
              strokeDasharray={isActiveEdge ? "none" : "none"}
              filter={isActiveEdge ? "url(#glow-blue)" : "none"}
              style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
            />
            <rect
              x={lp.x - 26}
              y={lp.y - 9}
              width={52}
              height={16}
              rx={4}
              fill={isActiveEdge ? "#0f2240" : "#080d18"}
              stroke={isActiveEdge ? "#3b82f644" : "#1e293b"}
            />
            <text
              x={lp.x}
              y={lp.y + 4}
              textAnchor="middle"
              fontSize={8}
              fontFamily="JetBrains Mono, monospace"
              fill={isActiveEdge ? "#60a5fa" : "#334155"}
              style={{ transition: "fill 0.2s" }}
            >
              {label.length > 12 ? label.slice(0, 12) + "…" : label}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions[node.id];
        if (!pos) return null;
        const isActive = node.isActive;
        const color = node.isAccept ? "#22c55e" : node.isReject ? "#ef4444" : isActive ? "#3b82f6" : "#1e3a5f";
        const bgColor = node.isAccept ? "#052e16" : node.isReject ? "#2d0a0a" : isActive ? "#0f2240" : "#080d18";

        return (
          <g key={node.id} transform={`translate(${pos.x},${pos.y})`}>
            {/* Outer ring for accept state */}
            {node.isAccept && (
              <circle r={NODE_R + 5} fill="none" stroke="#22c55e44" strokeWidth={1.5} />
            )}
            {/* Glow for active */}
            {isActive && (
              <circle r={NODE_R + 2} fill="none" stroke="#3b82f666" strokeWidth={3}
                filter="url(#glow-blue)" />
            )}
            <circle
              r={NODE_R}
              fill={bgColor}
              stroke={color}
              strokeWidth={isActive ? 2.5 : 1.5}
              style={{ transition: "all 0.25s ease", filter: isActive ? "url(#glow-blue)" : "none" }}
            />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={node.id.length > 6 ? 8 : 10}
              fontFamily="JetBrains Mono, monospace"
              fontWeight={isActive ? "700" : "400"}
              fill={isActive ? "#e0f2fe" : color}
              style={{ transition: "fill 0.2s" }}
            >
              {node.id}
            </text>
          </g>
        );
      })}

      {/* Entry arrow for q0 */}
      {positions["q0"] && (
        <g>
          <path d={`M ${positions["q0"].x - 50} ${positions["q0"].y} L ${positions["q0"].x - NODE_R - 2} ${positions["q0"].y}`}
            stroke="#334155" strokeWidth={1.5} markerEnd="url(#arrow)" fill="none" />
          <text x={positions["q0"].x - 52} y={positions["q0"].y - 6}
            fontSize={8} fontFamily="JetBrains Mono, monospace" fill="#334155" textAnchor="middle">start</text>
        </g>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ███  TRANSITION TABLE EDITOR  ███
// ═══════════════════════════════════════════════════════════════════════

function TransitionTableEditor({ rules, setRules, numTapes }) {
  function updateRule(idx, field, value) {
    const next = rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setRules(next);
  }
  function updateTapeField(idx, field, tapeIdx, value) {
    const next = rules.map((r, i) => {
      if (i !== idx) return r;
      const arr = [...r[field]];
      arr[tapeIdx] = value;
      return { ...r, [field]: arr };
    });
    setRules(next);
  }
  function addRule() {
    setRules([...rules, {
      from: "q0",
      reads: Array(numTapes).fill("_"),
      to: "qAccept",
      writes: Array(numTapes).fill("_"),
      moves: Array(numTapes).fill("R"),
    }]);
  }
  function removeRule(idx) {
    setRules(rules.filter((_, i) => i !== idx));
  }

  const cellSt = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    background: "#060c18",
    border: "1px solid #1e293b",
    borderRadius: 4,
    color: "#7dd3fc",
    padding: "3px 6px",
    outline: "none",
    width: "100%",
  };
  const hdrSt = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    color: "#334155",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "4px 6px",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", minWidth: 600 }}>
        <thead>
          <tr>
            <th style={hdrSt}>From</th>
            {Array.from({ length: numTapes }, (_, i) => (
              <th key={i} style={{ ...hdrSt, color: TAPE_COLORS[i] + "aa" }}>Read T{i + 1}</th>
            ))}
            <th style={hdrSt}>To</th>
            {Array.from({ length: numTapes }, (_, i) => (
              <th key={i} style={{ ...hdrSt, color: TAPE_COLORS[i] + "aa" }}>Write T{i + 1}</th>
            ))}
            {Array.from({ length: numTapes }, (_, i) => (
              <th key={i} style={{ ...hdrSt, color: TAPE_COLORS[i] + "aa" }}>Move T{i + 1}</th>
            ))}
            <th style={hdrSt}></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, ri) => (
            <tr key={ri} style={{ background: "#080d18" }}>
              <td style={{ padding: "3px 4px" }}>
                <input style={cellSt} value={rule.from}
                  onChange={e => updateRule(ri, "from", e.target.value)} />
              </td>
              {Array.from({ length: numTapes }, (_, ti) => (
                <td key={ti} style={{ padding: "3px 4px" }}>
                  <input style={{ ...cellSt, borderColor: TAPE_COLORS[ti] + "33" }}
                    value={rule.reads[ti] ?? "_"}
                    onChange={e => updateTapeField(ri, "reads", ti, e.target.value)} />
                </td>
              ))}
              <td style={{ padding: "3px 4px" }}>
                <input style={cellSt} value={rule.to}
                  onChange={e => updateRule(ri, "to", e.target.value)} />
              </td>
              {Array.from({ length: numTapes }, (_, ti) => (
                <td key={ti} style={{ padding: "3px 4px" }}>
                  <input style={{ ...cellSt, borderColor: TAPE_COLORS[ti] + "33" }}
                    value={rule.writes[ti] ?? "_"}
                    onChange={e => updateTapeField(ri, "writes", ti, e.target.value)} />
                </td>
              ))}
              {Array.from({ length: numTapes }, (_, ti) => (
                <td key={ti} style={{ padding: "3px 4px", minWidth: 72 }}>
                  <select
                    style={{ ...cellSt, borderColor: TAPE_COLORS[ti] + "33", cursor: "pointer" }}
                    value={rule.moves[ti] ?? "R"}
                    onChange={e => updateTapeField(ri, "moves", ti, e.target.value)}
                  >
                    <option value="R">R →</option>
                    <option value="L">L ←</option>
                    <option value="S">S ■</option>
                  </select>
                </td>
              ))}
              <td style={{ padding: "3px 4px" }}>
                <button onClick={() => removeRule(ri)} style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "#ef444466", padding: "4px", borderRadius: 4,
                  display: "flex", alignItems: "center",
                }}
                  onMouseOver={e => e.currentTarget.style.color = "#ef4444"}
                  onMouseOut={e => e.currentTarget.style.color = "#ef444466"}
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRule}
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "#0f2240",
          border: "1px dashed #1e3a5f",
          borderRadius: 6,
          color: "#3b82f6",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          padding: "6px 12px",
          cursor: "pointer",
          transition: "all 0.15s",
          width: "100%",
          justifyContent: "center",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "#1a3a6f"; e.currentTarget.style.borderColor = "#3b82f6"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#0f2240"; e.currentTarget.style.borderColor = "#1e3a5f"; }}
      >
        <Plus size={13} /> Add Transition Rule
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ███  EFFICIENCY PANEL  ███
// ═══════════════════════════════════════════════════════════════════════

function EfficiencyPanel({ steps, numTapes, inputLen, halted, accepted }) {
  const n = Math.max(inputLen, 1);
  const singleTapeTheo = n * n;
  const multiTapeTheo = n * numTapes;
  const maxVal = singleTapeTheo;
  const speedup = numTapes > 1 ? (singleTapeTheo / Math.max(multiTapeTheo, 1)).toFixed(1) : "1.0";

  function Bar({ label, val, max, color, sublabel }) {
    const pct = Math.min(100, (val / Math.max(max, 1)) * 100);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{label}</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color }}>{val.toLocaleString()}</span>
        </div>
        <div style={{ height: 6, background: "#0a0f1e", borderRadius: 3, border: "1px solid #1e293b", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, background: color,
            borderRadius: 3, transition: "width 0.4s ease",
          }} />
        </div>
        {sublabel && <div style={{ fontSize: 9, color: "#334155", marginTop: 2, fontFamily: "monospace" }}>{sublabel}</div>}
      </div>
    );
  }

  return (
    <div style={{
      background: "#080d18",
      border: "1px solid #1e293b",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Activity size={14} color="#3b82f6" />
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Efficiency Dashboard
        </span>
      </div>

      <Bar label={`Single-tape O(n²) ≈`} val={singleTapeTheo} max={maxVal} color="#ef4444"
        sublabel={`n=${n} → ${n}² = ${singleTapeTheo} theoretical ops`} />
      <Bar label={`${numTapes}-tape O(n·k) ≈`} val={multiTapeTheo} max={maxVal} color="#22c55e"
        sublabel={`n=${n} × k=${numTapes} = ${multiTapeTheo} theoretical ops`} />
      <Bar label="Actual steps taken" val={steps} max={maxVal} color="#3b82f6" />

      {numTapes > 1 && (
        <div style={{
          marginTop: 12, padding: "10px 12px",
          background: "#051d0f", border: "1px solid #14532d",
          borderRadius: 8,
          fontFamily: "monospace", fontSize: 11, color: "#4ade80", lineHeight: 1.7,
        }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>Theoretical speedup: {speedup}×</span><br />
          <span style={{ color: "#166534", fontSize: 10 }}>
            Multi-tape machines exploit parallelism — each tape's head moves simultaneously in one step, reducing passes from O(n²) to O(n·k).
          </span>
        </div>
      )}

      {numTapes === 1 && (
        <div style={{
          marginTop: 12, padding: "10px 12px",
          background: "#0f0a00", border: "1px solid #451a03",
          borderRadius: 8,
          fontFamily: "monospace", fontSize: 10, color: "#78350f", lineHeight: 1.7,
        }}>
          Single-tape machines must shuttle the head back and forth — for n symbols, this typically takes O(n²) steps. Switch to multi-tape mode to see the speedup.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
        {[
          { label: "Steps", val: steps, color: "#3b82f6" },
          { label: "Tapes", val: numTapes, color: "#f59e0b" },
          { label: "Input n", val: inputLen, color: "#10b981" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 7, padding: "10px 8px", textAlign: "center"
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.val}</div>
            <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.1em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ███  MAIN APP  ███
// ═══════════════════════════════════════════════════════════════════════

export default function App() {
  // ── Machine config state
  const [numTapes, setNumTapes] = useState(2);
  const [inputStr, setInputStr] = useState("10110");
  const [rules, setRules] = useState(PRESETS.copier.rules);
  const [acceptStates, setAcceptStates] = useState(["qAccept"]);
  const [rejectStates, setRejectStates] = useState(["qReject"]);
  const [initialState] = useState("q0");

  // ── Sim state
  const [config, setConfig] = useState(null);
  const [steps, setSteps] = useState(0);
  const [history, setHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [activeTab, setActiveTab] = useState("tapes"); // tapes | diagram | editor | efficiency
  const [selectedPreset, setSelectedPreset] = useState("copier");
  const [showPresetInfo, setShowPresetInfo] = useState(false);
  const timerRef = useRef(null);

  const [bulkText, setBulkText] = useState("");
  const applyBulkRules = () => {
    try {
      const lines = bulkText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//"));
      const newRules = [];
      let detectedTapes = 0;

      lines.forEach(line => {
        const parts = line.split(",").map(p => p.trim());
        const k = (parts.length - 2) / 3;
        if (!Number.isInteger(k)) throw new Error("Invalid format on line: " + line);
        
        detectedTapes = k;
        const from = parts[0];
        const reads = parts.slice(1, 1 + k);
        const to = parts[1 + k];
        const writes = parts.slice(2 + k, 2 + 2 * k);
        const moves = parts.slice(2 + 2 * k);

        newRules.push({ from, reads, to, writes, moves });
      });

      setNumTapes(detectedTapes);
      setRules(newRules);
      const allStates = new Set(newRules.map(r => r.to));
      if (allStates.has("qAccept")) setAcceptStates(["qAccept"]);
      if (allStates.has("qReject")) setRejectStates(["qReject"]);
      
      alert(`Success: Imported ${newRules.length} rules!`);
    } catch (e) {
      alert("Error parsing rules: " + e.message);
    }
  };

  // ── Load preset
  function loadPreset(key, overrideNumTapes) {
    const p = PRESETS[key];
    setSelectedPreset(key);

    let tapeCount, loadedRules, loadedAccept, loadedReject;

    if (key === "addition" || key === "copier") {
      // If it's a copier, we use the CURRENT selected numTapes. 
      // Otherwise, use the preset's default.
      const k = overrideNumTapes ?? (key === "copier" ? numTapes : p.numTapes);
      const cfg = key === "addition" ? getAdditionRules(k) : getCopierRules(k);
      
      tapeCount    = cfg.numTapes;
      loadedRules  = cfg.rules;
      loadedAccept = p.acceptStates;
      loadedReject = p.rejectStates || [];
    } else {
      tapeCount    = p.numTapes;
      loadedRules  = p.rules;
      loadedAccept = p.acceptStates;
      loadedReject = p.rejectStates || [];
    }

    setNumTapes(tapeCount);
    setInputStr(p.input);
    setRules(loadedRules);
    setAcceptStates(loadedAccept);
    setRejectStates(loadedReject);
    setConfig(null);
    setSteps(0);
    setHistory([]);
    setIsPlaying(false);
    setShowPresetInfo(true);
  }

  // ── Initialize machine
  function initialize(inp) {
    const c = initConfig(numTapes, inp ?? inputStr, rules, acceptStates, rejectStates, initialState);
    setConfig(c);
    setSteps(0);
    setHistory([]);
    setIsPlaying(false);
  }

  // ── Step forward
  const stepForward = useCallback(() => {
    setConfig(prev => {
      if (!prev || prev.halted) return prev;
      setHistory(h => [...h, prev]);
      const next = engineStep(prev);
      setSteps(s => s + 1);
      return next;
    });
  }, []);

  // ── Play loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setConfig(prev => {
          if (!prev || prev.halted) {
            setIsPlaying(false);
            return prev;
          }
          setHistory(h => [...h, prev]);
          const next = engineStep(prev);
          setSteps(s => s + 1);
          if (next.halted) setIsPlaying(false);
          return next;
        });
      }, speed);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, speed]);

  // ── Reset
  function reset() {
    setIsPlaying(false);
    initialize();
  }

  // ── Step back
  function stepBack() {
    if (!history.length) return;
    setConfig(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setSteps(s => Math.max(0, s - 1));
  }

  // ── Initialize on mount
  useEffect(() => { initialize(); }, []);

  // Sync numTapes with rules when preset changes
  useEffect(() => {
    setRules(r => r.map(rule => ({
      ...rule,
      reads: Array.from({ length: numTapes }, (_, i) => rule.reads[i] ?? "_"),
      writes: Array.from({ length: numTapes }, (_, i) => rule.writes[i] ?? "_"),
      moves: Array.from({ length: numTapes }, (_, i) => rule.moves[i] ?? "R"),
    })));
  }, [numTapes]);

  const statusColor = config?.halted
    ? config?.accepted ? "#22c55e" : "#ef4444"
    : isPlaying ? "#f59e0b" : "#3b82f6";
  const statusText = config?.halted
    ? config?.accepted ? "ACCEPTED" : "REJECTED"
    : !config ? "IDLE" : isPlaying ? "RUNNING" : "PAUSED";

  const BtnStyle = (variant = "ghost") => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 14px",
    borderRadius: 7,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.15s",
    ...(variant === "primary" ? {
      background: "#1d4ed8", borderColor: "#3b82f6", color: "#fff",
      boxShadow: "0 0 14px #3b82f644",
    } : variant === "danger" ? {
      background: "#2d0a0a", borderColor: "#7f1d1d", color: "#f87171",
    } : {
      background: "#0a0f1e", borderColor: "#1e3a5f", color: "#64748b",
    }),
  });

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 14px",
        borderRadius: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        border: "1px solid",
        transition: "all 0.15s",
        ...(activeTab === id ? {
          background: "#0f2240", borderColor: "#3b82f666", color: "#60a5fa",
        } : {
          background: "transparent", borderColor: "transparent", color: "#334155",
        }),
      }}
    >
      {Icon && <Icon size={11} />} {label}
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050810",
      color: "#e2e8f0",
      fontFamily: "'Syne', 'Segoe UI', sans-serif",
      backgroundImage: "radial-gradient(ellipse at 20% 50%, #0f172a 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0c1a2e 0%, transparent 50%)",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(90deg, #060c18 0%, #080d18 50%, #060c18 100%)",
        borderBottom: "1px solid #1e293b",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #1d4ed8, #0891b2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px #3b82f644",
          }}>
            <Cpu size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.05em", color: "#f1f5f9" }}>
              Universal Turing Machine
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Tape mode toggle */}
          <div style={{
            display: "flex", background: "#0a0f1e",
            border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden",
          }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => {
                  setIsPlaying(false);
                  setConfig(null);
                  setSteps(0);
                  setHistory([]);
                  if (selectedPreset === "addition" || selectedPreset === "copier") {
                    // Re-derive rules for the new tape count using the adaptive functions
                    const cfg = selectedPreset === "addition" 
                      ? getAdditionRules(n) 
                      : getCopierRules(n);
          
                    setNumTapes(cfg.numTapes);
                    setRules(cfg.rules);
                    setAcceptStates(PRESETS[selectedPreset].acceptStates);
                    setRejectStates(PRESETS[selectedPreset].rejectStates || []);
                    
                  } else {
                    setNumTapes(n);
                  }
                }}
                style={{
                  padding: "6px 12px",
                  fontFamily: "monospace", fontSize: 11, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  background: numTapes === n ? "#1d4ed8" : "transparent",
                  color: numTapes === n ? "#fff" : "#334155",
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Layers size={11} /> {n} {n === 1 ? "Tape" : "Tapes"}
              </button>
            ))}
          </div>

          {/* Status */}
          <div style={{
            padding: "5px 12px", borderRadius: 6,
            background: statusColor + "15",
            border: `1px solid ${statusColor}44`,
            fontFamily: "monospace", fontSize: 11, fontWeight: 700,
            color: statusColor, letterSpacing: "0.08em",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: isPlaying ? "pulse 1s infinite" : "none",
            }} />
            {statusText}
          </div>

          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>
            STATE: <span style={{ color: "#f59e0b" }}>{config?.state ?? "—"}</span>
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>
            STEP: <span style={{ color: "#3b82f6" }}>{steps}</span>
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 65px)" }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{
          width: 280, minWidth: 240, flexShrink: 0,
          background: "#060c18",
          borderRight: "1px solid #1e293b",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Preset selector */}
            <div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 6, textTransform: "uppercase" }}>
                Load Example
              </div>
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => loadPreset(key)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "8px 10px", marginBottom: 4, borderRadius: 6,
                    background: selectedPreset === key ? "#0f2240" : "#0a0f1e",
                    border: `1px solid ${selectedPreset === key ? "#3b82f666" : "#1e293b"}`,
                    color: selectedPreset === key ? "#60a5fa" : "#334155",
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "monospace", fontSize: 11,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {key === "addition" && selectedPreset === "addition"
                      ? `Unary Addition (${numTapes}-tape, ${numTapes === 1 ? "O(n²)" : "O(n)"})`
                      : p.label}
                  </div>
                </button>
              ))}
              {showPresetInfo && selectedPreset && (
                <div style={{
                  padding: "8px 10px", borderRadius: 6,
                  background: "#0a1628", border: "1px solid #1e3a5f",
                  fontFamily: "monospace", fontSize: 10, color: "#4b6fa8",
                  lineHeight: 1.6, marginTop: 4,
                }}>
                  <Info size={10} style={{ display: "inline", marginRight: 4 }} />
                  {selectedPreset === "addition"
                    ? getAdditionRules(numTapes).description
                    : PRESETS[selectedPreset].description}
                </div>
              )}
            </div>

            {/* Input */}
            <div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 6, textTransform: "uppercase" }}>
                Tape 1 Input
              </div>
              <input
                value={inputStr}
                onChange={e => setInputStr(e.target.value)}
                style={{
                  width: "100%", fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15, background: "#080d18",
                  border: "1px solid #1e3a5f", borderRadius: 6,
                  color: "#7dd3fc", padding: "8px 10px", outline: "none",
                  letterSpacing: "0.15em", boxSizing: "border-box",
                }}
                placeholder="e.g. abba or 10110"
              />
              <div style={{ fontSize: 9, color: "#1e3a5f", fontFamily: "monospace", marginTop: 4 }}>
                Input length n = {inputStr.length}
              </div>
            </div>

            {/* Accept / Reject states */}
            <div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 6, textTransform: "uppercase" }}>
                Accept States
              </div>
              <input
                value={acceptStates.join(",")}
                onChange={e => setAcceptStates(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                style={{
                  width: "100%", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  background: "#051d0f", border: "1px solid #14532d", borderRadius: 6,
                  color: "#4ade80", padding: "6px 10px", outline: "none", boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 4, marginTop: 8, textTransform: "uppercase" }}>
                Reject States
              </div>
              <input
                value={rejectStates.join(",")}
                onChange={e => setRejectStates(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                style={{
                  width: "100%", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  background: "#2d0a0a", border: "1px solid #7f1d1d", borderRadius: 6,
                  color: "#f87171", padding: "6px 10px", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Controls */}
            <div>
              <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 8, textTransform: "uppercase" }}>Controls</div>
              <button
                onClick={() => initialize()}
                style={{ ...BtnStyle("primary"), width: "100%", justifyContent: "center", marginBottom: 6 }}
              >
                <Zap size={13} /> Load & Initialize
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                <button
                  onClick={stepBack}
                  disabled={!history.length}
                  style={{ ...BtnStyle(), justifyContent: "center", opacity: history.length ? 1 : 0.35 }}
                >
                  <SkipForward size={12} style={{ transform: "scaleX(-1)" }} /> Back
                </button>
                <button
                  onClick={stepForward}
                  disabled={!config || config.halted}
                  style={{ ...BtnStyle(), justifyContent: "center", opacity: (!config || config.halted) ? 0.35 : 1 }}
                >
                  Step <SkipForward size={12} />
                </button>
              </div>
              <button
                onClick={() => {
                  if (!config) initialize();
                  setIsPlaying(p => !p);
                }}
                disabled={config?.halted}
                style={{
                  ...BtnStyle(isPlaying ? "ghost" : "primary"),
                  width: "100%", justifyContent: "center", marginBottom: 6,
                  opacity: config?.halted ? 0.35 : 1,
                }}
              >
                {isPlaying ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Play</>}
              </button>
              <button
                onClick={reset}
                style={{ ...BtnStyle("danger"), width: "100%", justifyContent: "center" }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>

            {/* Speed */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>Speed</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b" }}>{speed}ms/step</span>
              </div>
              <input
                type="range" min={50} max={1500} step={50} value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#3b82f6" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1e3a5f", fontFamily: "monospace" }}>
                <span>50ms fast</span><span>1500ms slow</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── MAIN PANEL ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

          {/* Tab Bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "8px 16px",
            background: "#060c18",
            borderBottom: "1px solid #1e293b",
          }}>
            <TabBtn id="tapes" label="Tape Stack" icon={Layers} />
            <TabBtn id="diagram" label="State Diagram" icon={Activity} />
            <TabBtn id="editor" label="Transition Table" icon={BookOpen} />
            <TabBtn id="efficiency" label="Efficiency" icon={Zap} />

            <TabBtn id="bulk" label="Bulk Import" icon={Plus} />
            {/* Active rule display */}
            {config?.activeRule && (
              <div style={{
                marginLeft: "auto",
                fontFamily: "monospace", fontSize: 11,
                background: "#0f2240", border: "1px solid #1e3a5f",
                borderRadius: 6, padding: "4px 12px",
                color: "#64748b",
                whiteSpace: "nowrap", overflow: "hidden", maxWidth: 360,
              }}>
                <span style={{ color: "#f59e0b" }}>{config.activeRule.from}</span>
                <span style={{ color: "#334155" }}>, [</span>
                <span style={{ color: "#f87171" }}>{config.activeRule.reads.join(",")}</span>
                <span style={{ color: "#334155" }}>] → </span>
                <span style={{ color: "#4ade80" }}>{config.activeRule.to}</span>
                <span style={{ color: "#334155" }}>, [</span>
                <span style={{ color: "#60a5fa" }}>{config.activeRule.writes.join(",")}</span>
                <span style={{ color: "#334155" }}>], [</span>
                <span style={{ color: "#a78bfa" }}>{config.activeRule.moves.join(",")}</span>
                <span style={{ color: "#334155" }}>]</span>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* ── SIMULATOR TAB (Combined Tapes & Diagram) ── */}
{activeTab === "tapes" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    
    {/* TAPE STACK SECTION */}
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
        <Layers size={14} color="#3b82f6" /> Tape Stack
      </div>
      {config ? (
        config.tapes.map((tape, ti) => (
          <TapeView
            key={ti}
            tape={tape}
            head={config.heads[ti]}
            tapeIndex={ti}
            label={ti === 0 ? "INPUT / WORK" : ti === config.tapes.length - 1 ? "OUTPUT / WORK" : `WORK TAPE ${ti + 1}`}
            isActive={!config.halted}
            halted={config.halted}
            accepted={config.accepted}
          />
        ))
      ) : (
        <div style={{ textAlign: "center", color: "#1e3a5f", fontFamily: "monospace", fontSize: 13, padding: 40, background: "#080d18", borderRadius: 10, border: "1px dashed #1e293b" }}>
          Press "Load & Initialize" to begin
        </div>
      )}

      {config?.halted && (
        <div style={{
          padding: "14px 18px", borderRadius: 10,
          background: config.accepted ? "#052e16" : "#2d0a0a",
          border: `1px solid ${config.accepted ? "#16a34a" : "#991b1b"}`,
          fontFamily: "monospace", fontSize: 13,
          color: config.accepted ? "#4ade80" : "#f87171",
          fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
        }}>
          {config.accepted ? "✓ ACCEPTED" : "✗ REJECTED"} — machine halted after {steps} steps
        </div>
      )}
    </div>

    {/* STATE DIAGRAM SECTION */}
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={14} color="#3b82f6" /> State Transition Diagram
      </div>
      <div style={{
        background: "#080d18", border: "1px solid #1e293b",
        borderRadius: 10, overflow: "hidden", position: "relative"
      }}>
        <div style={{
          position: "absolute", top: 10, right: 10, zIndex: 10,
          display: "flex", gap: 12, pointerEvents: "none"
        }}>
           <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, color: "#334155", fontFamily: "monospace" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} /> ACTIVE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, color: "#334155", fontFamily: "monospace" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} /> ACCEPT
          </div>
        </div>

        <StateDiagram
          rules={rules}
          acceptStates={acceptStates}
          rejectStates={rejectStates}
          activeState={config?.state ?? "q0"}
          activeRule={config?.activeRule}
        />
      </div>
    </div>
  </div>
)}

            {/* ── DIAGRAM TAB ── */}
            {activeTab === "diagram" && (
              <div>
                <div style={{
                  background: "#080d18", border: "1px solid #1e293b",
                  borderRadius: 10, overflow: "hidden",
                }}>
                  <div style={{
                    padding: "10px 16px", borderBottom: "1px solid #1e293b",
                    fontFamily: "monospace", fontSize: 10, color: "#334155",
                    letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <Activity size={12} color="#3b82f6" />
                    STATE TRANSITION DIAGRAM
                    <span style={{ marginLeft: "auto", color: "#1e3a5f", fontSize: 9 }}>
                      Active state glows · Active edge highlights
                    </span>
                  </div>
                  <StateDiagram
                    rules={rules}
                    acceptStates={acceptStates}
                    rejectStates={rejectStates}
                    activeState={config?.state ?? "q0"}
                    activeRule={config?.activeRule}
                  />
                </div>
                {/* Legend */}
                <div style={{ display: "flex", gap: 16, marginTop: 10, fontFamily: "monospace", fontSize: 10, color: "#334155" }}>
                  {[
                    { color: "#3b82f6", label: "Active state" },
                    { color: "#22c55e", label: "Accept state (double ring)" },
                    { color: "#ef4444", label: "Reject state" },
                    { color: "#1e3a5f", label: "Normal state" },
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── EDITOR TAB ── */}
            {activeTab === "editor" && (
              <div>
                <div style={{
                  background: "#080d18", border: "1px solid #1e293b",
                  borderRadius: 10, overflow: "hidden",
                }}>
                  <div style={{
                    padding: "10px 16px", borderBottom: "1px solid #1e293b",
                    fontFamily: "monospace", fontSize: 10, color: "#334155",
                    letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <BookOpen size={12} color="#f59e0b" />
                    TRANSITION RULES — {numTapes}-TAPE MACHINE
                    <span style={{ marginLeft: "auto", color: "#1e3a5f", fontSize: 9 }}>
                      (state, read…) → (state, write…, move…)
                    </span>
                  </div>
                  <div style={{ padding: 14 }}>
                    <TransitionTableEditor
                      rules={rules}
                      setRules={setRules}
                      numTapes={numTapes}
                    />
                  </div>
                </div>
                <div style={{
                  marginTop: 10, padding: "10px 14px",
                  background: "#0a1020", border: "1px solid #1e293b",
                  borderRadius: 8, fontFamily: "monospace", fontSize: 10,
                  color: "#334155", lineHeight: 1.7,
                }}>
                  <strong style={{ color: "#4b6fa8" }}>Format: </strong>
                  Each row is one transition. "Read T1" is the symbol the head on Tape 1 must see.
                  Movements: R = Right, L = Left, S = Stay. Use <code style={{ color: "#60a5fa" }}>_</code> for the blank symbol.
                  After editing, click <strong style={{ color: "#60a5fa" }}>Load & Initialize</strong> to apply.
                </div>
              </div>
            )}

            {/* ── EFFICIENCY TAB ── */}
            {activeTab === "efficiency" && (
              <EfficiencyPanel
                steps={steps}
                numTapes={numTapes}
                inputLen={inputStr.length}
                halted={config?.halted ?? false}
                accepted={config?.accepted ?? false}
              />
            )}

{activeTab === "bulk" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ background: "#080d18", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
      <textarea
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        spellCheck="false"
        style={{
          width: "100%", height: "250px", background: "#050810", color: "#7dd3fc",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 13, border: "1px solid #1e3a5f",
          borderRadius: 8, padding: 15, outline: "none", resize: "none"
        }}
        placeholder="Paste rules: from, read, to, write, move"
      />
      <button onClick={applyBulkRules} style={{ ...BtnStyle("primary"), marginTop: 15, width: "100%", justifyContent: "center" }}>
        <Zap size={14} /> Apply Bulk Rules
      </button>
    </div>
  </div>
)}

          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #060c18; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #1e3a5f; }
      `}</style>
    </div>
  );
}
