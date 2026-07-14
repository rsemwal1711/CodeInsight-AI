import React, { useState, useMemo } from "react";
import NavBar from "../components/Header";
import Footer from "../components/Footer";
import "./HomePage.css";
import "./AnalyzePage.css";
import "./ExamplesPage.css";

/* ==========================================================================
   Example algorithms. Each one hands its `code` + `language` off to the
   Analyze page via sessionStorage (see the useEffect added to
   AnalyzePage.jsx) when "Load Example" is clicked.
   `time` / `space` here are the known, textbook complexities for display —
   they are NOT run through the analyzer, so they're always accurate,
   unlike the heuristic estimates the Analyze page produces on its own.
   ========================================================================== */

const EXAMPLES = [
  {
    id: "bubble-sort",
    name: "Bubble Sort",
    category: "Sorting",
    description: "Repeatedly swaps adjacent out-of-order elements until the array is sorted.",
    time: "O(n\u00B2)",
    space: "O(1)",
    language: "javascript",
    code: `function bubbleSort(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}`,
  },
  {
    id: "binary-search",
    name: "Binary Search",
    category: "Searching",
    description: "Halves the search space each step to find a target in a sorted array.",
    time: "O(log n)",
    space: "O(1)",
    language: "javascript",
    code: `function binarySearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}`,
  },
  {
    id: "merge-sort",
    name: "Merge Sort",
    category: "Sorting",
    description: "Divides the array in half, sorts each half, then merges them back together.",
    time: "O(n log n)",
    space: "O(n)",
    language: "javascript",
    code: `function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    result.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return [...result, ...left.slice(i), ...right.slice(j)];
}`,
  },
  {
    id: "bfs",
    name: "BFS",
    category: "Graph",
    description: "Explores a graph level by level using a queue, ideal for shortest paths on unweighted graphs.",
    time: "O(V + E)",
    space: "O(V)",
    language: "javascript",
    code: `function bfs(graph, start) {
  const visited = new Set([start]);
  const queue = [start];
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}`,
  },
  {
    id: "dfs",
    name: "DFS",
    category: "Graph",
    description: "Explores a graph by diving as deep as possible before backtracking, using recursion or a stack.",
    time: "O(V + E)",
    space: "O(V)",
    language: "javascript",
    code: `function dfs(graph, node, visited = new Set(), order = []) {
  visited.add(node);
  order.push(node);

  for (const neighbor of graph[node] || []) {
    if (!visited.has(neighbor)) {
      dfs(graph, neighbor, visited, order);
    }
  }
  return order;
}`,
  },
  {
    id: "sliding-window",
    name: "Sliding Window",
    category: "Array",
    description: "Maintains a moving subrange over an array to find the best window in a single pass.",
    time: "O(n)",
    space: "O(1)",
    language: "javascript",
    code: `function maxSubarraySum(arr, k) {
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i];

  let maxSum = windowSum;
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}`,
  },
  {
    id: "two-pointer",
    name: "Two Pointer",
    category: "Array",
    description: "Walks two indices toward each other to find a pair in a sorted array in one pass.",
    time: "O(n)",
    space: "O(1)",
    language: "javascript",
    code: `function twoSumSorted(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left < right) {
    const sum = arr[left] + arr[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return null;
}`,
  },
  {
    id: "dijkstra",
    name: "Dijkstra",
    category: "Graph",
    description: "Finds the shortest path from a source node to every other node in a weighted graph.",
    time: "O((V + E) log V)",
    space: "O(V)",
    language: "javascript",
    code: `function dijkstra(graph, start) {
  const dist = { [start]: 0 };
  const visited = new Set();
  const queue = [[0, start]];

  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, node] = queue.shift();
    if (visited.has(node)) continue;
    visited.add(node);

    for (const [neighbor, weight] of graph[node] || []) {
      const next = d + weight;
      if (next < (dist[neighbor] ?? Infinity)) {
        dist[neighbor] = next;
        queue.push([next, neighbor]);
      }
    }
  }
  return dist;
}`,
  },
  {
    id: "quick-sort",
    name: "Quick Sort",
    category: "Sorting",
    description: "Picks a pivot and partitions the array around it, then recursively sorts each side.",
    time: "O(n log n)",
    space: "O(log n)",
    language: "javascript",
    code: `function quickSort(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const pivotIndex = partition(arr, low, high);
    quickSort(arr, low, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, high);
  }
  return arr;
}

function partition(arr, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] < pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}`,
  },
];

const CATEGORIES = ["All", "Sorting", "Searching", "Graph", "Array"];

/* ---------- Shared chrome ---------- */



/* ---------- Card ---------- */

const badgeTone = (value) => {
  if (value === "O(1)" || value === "O(log n)") return "success";
  if (value === "O(n)" || value === "O(n log n)" || value === "O(V + E)" || value === "O((V + E) log V)") return "warning";
  return "error";
};

/**
 * Loads an example into the Analyze page. Swap the body of this function
 * for `navigate("/analyze", { state: example })` if you're using React
 * Router — the sessionStorage version works with any setup as-is.
 */
function loadExample(example) {
  window.sessionStorage.setItem(
    "ci-pending-example",
    JSON.stringify({ code: example.code, language: example.language })
  );
  window.location.href = "/analyze";
}

const ExampleCard = ({ example, delay }) => (
  <article className="ci-card ci-example-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="ci-example-card__top">
      <span className="ci-example-card__category">{example.category}</span>
      <div className={`ci-complexity-badge ci-complexity-badge--${badgeTone(example.time)} ci-example-card__badge`}>
        {example.time}
      </div>
    </div>

    <h3 className="ci-example-card__name">{example.name}</h3>
    <p className="ci-example-card__desc">{example.description}</p>

    <pre className="ci-example-card__snippet">
      <code>{example.code.split("\n").slice(0, 4).join("\n")}
{example.code.split("\n").length > 4 ? "\n  ..." : ""}</code>
    </pre>

    <div className="ci-example-card__footer">
      <span className="ci-example-card__space">Space {example.space}</span>
      <button type="button" className="ci-btn ci-btn--primary ci-btn--sm" onClick={() => loadExample(example)}>
        Load Example
      </button>
    </div>
  </article>
);

/* ---------- Page ---------- */

export default function ExamplesPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(
    () => (activeCategory === "All" ? EXAMPLES : EXAMPLES.filter((e) => e.category === activeCategory)),
    [activeCategory]
  );

  return (
    <div className="ci-page">
      <NavBar />

      <main>
        <section className="ci-examples-hero">
          <div className="ci-examples-hero__inner">
            <span className="ci-eyebrow">Examples</span>
            <h1 className="ci-examples-hero__title">Try it with algorithms you already know</h1>
            <p className="ci-examples-hero__desc">
              Load a classic algorithm straight into the analyzer and see how
              CodeInsight AI breaks down its complexity.
            </p>
          </div>
        </section>

        <section className="ci-section ci-section--tight">
          <div className="ci-category-bar" role="tablist" aria-label="Filter examples by category">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`ci-category-pill${activeCategory === cat ? " ci-category-pill--active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="ci-grid ci-grid--examples">
            {filtered.map((example, i) => (
              <ExampleCard example={example} key={example.id} delay={i * 40} />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}