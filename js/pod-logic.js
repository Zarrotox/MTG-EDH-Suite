/**
 * Pod Shuffling and Grouping Logic for MTG Pod Randomizer
 * Implements Fisher-Yates shuffle and a multi-criteria integer partition optimizer.
 */

/**
 * Perform a Fisher-Yates shuffle on an array of elements.
 * @param {Array} array - The original array
 * @returns {Array} A new, randomized copy of the array
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Cost function for a single pod size based on the target pod size.
 * Evaluates how "bad" a pod size is. Low is good, high is bad.
 * 
 * @param {number} size - The size of the pod
 * @param {number} target - The target pod size (3, 4, or 5)
 * @returns {number} The penalty score
 */
function getPodSizeCost(size, target) {
  if (size < 2) return 10000; // Invalid pod size

  if (target === 4) {
    switch (size) {
      case 4: return 0;     // Perfect
      case 3: return 1;     // Great
      case 5: return 3;     // Playable but slow
      case 2: return 8;     // Poor (heads-up)
      default: return 100;  // Too large
    }
  } else if (target === 3) {
    switch (size) {
      case 3: return 0;     // Perfect
      case 4: return 2;     // Good
      case 2: return 8;     // Poor
      case 5: return 6;     // Heavy
      default: return 100;
    }
  } else { // target === 5
    switch (size) {
      case 5: return 0;     // Perfect
      case 4: return 2;     // Good
      case 3: return 4;     // Medium
      case 2: return 10;    // Poor
      default: return 100;
    }
  }
}

/**
 * Optimizes the layout of pod sizes for N players given a target size.
 * Uses a backtracking search over integer partitions to find the combination
 * of pod sizes in [2, 3, 4, 5] (or up to 6 if target is 5) that minimizes
 * total cost and balances pod size distribution (minimizing size difference range).
 * 
 * @param {number} N - Total number of active players
 * @param {number} target - Target pod size (3, 4, or 5)
 * @returns {Array<number>} An array of optimized pod sizes summing to N
 */
export function getOptimalPodSizes(N, target) {
  if (N <= 0) return [];
  if (N < 2) return [N]; // Impossible to split, return a single pod of size N

  const maxAllowedPodSize = target === 5 ? 6 : 5;
  const minAllowedPodSize = 2;
  
  let bestPartition = null;
  let bestScore = Infinity;

  // Backtracking function to find all partitions that sum to N
  function findPartitions(remaining, currentPartition) {
    if (remaining === 0) {
      // Evaluate the partition
      const score = evaluatePartition(currentPartition, target);
      if (score < bestScore) {
        bestScore = score;
        bestPartition = [...currentPartition];
      }
      return;
    }

    // Force progress by using pod sizes
    const startSize = currentPartition.length > 0 ? currentPartition[currentPartition.length - 1] : minAllowedPodSize;
    
    for (let size = startSize; size <= maxAllowedPodSize; size++) {
      if (remaining - size >= 0) {
        // Skip states that would leave 1 player (unplayable) unless remaining is exactly that size
        if (remaining - size === 1) continue;

        currentPartition.push(size);
        findPartitions(remaining - size, currentPartition);
        currentPartition.pop();
      }
    }
  }

  findPartitions(N, []);

  // If no partition found (e.g. N = 1 or very small/odd constraints), fall back to single pod
  if (!bestPartition) {
    return [N];
  }

  // Sort sizes descending so larger pods are listed first (e.g. [4, 3, 3])
  return bestPartition.sort((a, b) => b - a);
}

/**
 * Scores a candidate partition. Lower scores are better.
 * Balances base pod size penalties with range variance.
 * 
 * @param {Array<number>} partition - Candidate array of pod sizes
 * @param {number} target - Target pod size
 * @returns {number} The evaluated score
 */
function evaluatePartition(partition, target) {
  const baseCost = partition.reduce((sum, size) => sum + getPodSizeCost(size, target), 0);
  
  const maxS = Math.max(...partition);
  const minS = Math.min(...partition);
  const range = maxS - minS;
  
  // Penalize variance inside the session. We want sizes as close as possible
  // E.g., [3, 3, 3] (range 0) is better than [5, 4] (range 1)
  const rangePenalty = range * 0.8;
  
  // Minor penalty for having more pods, to prefer packing if equal cost
  const podCountPenalty = partition.length * 0.05;

  return baseCost + rangePenalty + podCountPenalty;
}

/**
 * Randomly distributes players into balanced pods based on optimized sizes.
 * 
 * @param {Array<Object>} players - List of active player objects
 * @param {number} targetSize - Target pod size (3, 4, or 5)
 * @returns {Array<Array<Object>>} List of pods, each being an array of player objects
 */
export function generatePods(players, targetSize) {
  if (!players || players.length === 0) return [];
  
  // 1. Shuffle players completely to ensure absolute fairness
  const shuffledPlayers = shuffleArray(players);
  
  // 2. Compute the optimal pod sizes for this roster count
  const optimalSizes = getOptimalPodSizes(shuffledPlayers.length, targetSize);
  
  // 3. Segment the shuffled list into pods based on the computed sizes
  const pods = [];
  let currentIndex = 0;
  
  optimalSizes.forEach(size => {
    const podPlayers = shuffledPlayers.slice(currentIndex, currentIndex + size);
    pods.push(podPlayers);
    currentIndex += size;
  });
  
  return pods;
}
