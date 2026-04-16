# Universal Multi-Tape Turing Machine Simulator

A high-fidelity, interactive web-based simulator for Multi-Tape Turing Machines. This tool is designed to visualize the computational process of Turing Machines and demonstrate the efficiency gains (reducing complexity from $O(n^2)$ to $O(n)$ ) when moving from single-tape to multi-tape architectures.

## 🚀 Live Demo
**URL:** [https://tafl-omega.vercel.app](https://tafl-omega.vercel.app)

---

## ✨ Key Features

### 1. Multi-Tape Architecture
- Supports **1, 2, or 3 independent tapes**.
- Each tape features an independent read/write head with distinct movement logic (Left, Right, Stay).

### 2. Adaptive Algorithm Presets
The tool includes built-in presets that automatically adapt their logic based on the number of tapes selected:
- **Binary Copier:** Demonstrates the speed difference between a 1-tape shuttling strategy ( $O(n^2)$ ) and a 2-tape parallel copy ( $O(n)$ ).
- **Unary Addition:** Supports 1, 2, or 3 tapes. The 3-tape mode demonstrates simultaneous operand processing.
- **$a^n b^n$ Checker:** A classic single-tape implementation for context-free language recognition.

### 3. Visual Debugging Suite
- **Dynamic State Diagram:** An auto-generated SVG diagram where the current state glows and active transitions highlight in real-time.
- **Live Tape Stack:** A scrolling visualization of all tapes, showing head positions and symbol changes instantly.
- **Transition Table:** A human-readable table showing the logic of the current ruleset.

### 4. Advanced Execution Controls
- **Step-Back History:** Maintains a complete history of machine configurations, allowing users to "rewind" logic steps to find bugs.
- **Variable Speed:** Simulation speed ranges from 50ms (for fast results) to 1500ms (for deep analysis).
- **Manual Stepping:** Advance the machine one transition at a time.

### 5. Bulk Rule Import
Allows users to define custom machines by pasting transition rules in a CSV-style format:
`from, read, to, write, move`
*Example:* `q0, 0, _, q0, 0, 0, R, R`

---

## 🛠️ Tech Stack
- **Framework:** React.js
- **Build Tool:** Vite
- **Icons:** Lucide-React
- **Styling:** Custom CSS (Cyberpunk/Dark Mode aesthetic)
- **Visualization:** SVG & D3-style Force Layout logic

---

## 📥 Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/UdayiniKhushi/TAFL.git
   ```
2. **Navigate to the project folder:**
   ```bash
   cd TAFL/turing-machine
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Open in Browser:** Navigate to `http://localhost:5173`

---

## 📖 How to Use

1. **Select Tape Mode:** Choose 1, 2, or 3 tapes from the header.
2. **Load a Preset:** Click on a preset like "Binary Copier" to see adaptive rules.
3. **Input Data:** Enter your string (e.g., `10110`) in the "Tape 1 Input" box.
4. **Initialize:** Click "Load & Initialize."
5. **Run:** Use "Step" to see one transition or "Play" to watch the full execution.
6. **Analyze:** Check the **Efficiency Dashboard** to see how many steps your configuration took compared to theoretical limits.

---

## 📝 License
This project was developed for the Theory of Automata and Formal Languages (TAFL) coursework. Feel free to use and modify for educational purposes.

**Author:** Khushi Jindal

