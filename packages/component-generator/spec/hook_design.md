二、Hook 排序策略
1. 基于优先级的分层排序
typescriptenum HookPriority {
  STATE = 1,        // useState, useReducer
  REF = 2,          // useRef
  CONTEXT = 3,      // useContext
  MEMO = 4,         // useMemo, useCallback
  EFFECT = 5,       // useEffect, useLayoutEffect
  CUSTOM = 6        // 自定义 hooks
}

const HOOK_PRIORITY_MAP = {
  'useState': HookPriority.STATE,
  'useReducer': HookPriority.STATE,
  'useRef': HookPriority.REF,
  'useContext': HookPriority.CONTEXT,
  'useMemo': HookPriority.MEMO,
  'useCallback': HookPriority.MEMO,
  'useEffect': HookPriority.EFFECT,
  'useLayoutEffect': HookPriority.EFFECT,
};
2. 依赖关系拓扑排序
typescriptclass HookSorter {
  sortStatements(stats: Statement[]): Statement[] {
    // 分离 hook 和非 hook 语句
    const hookStats = stats.filter(s => s.hook);
    const normalStats = stats.filter(s => !s.hook);
    
    // 构建依赖图
    const graph = this.buildDependencyGraph(hookStats);
    
    // 拓扑排序 + 优先级排序
    const sortedHooks = this.topologicalSort(graph);
    
    // 合并：hooks 在前，其他语句在后
    return [...sortedHooks, ...normalStats];
  }
  
  private buildDependencyGraph(stats: Statement[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    stats.forEach(stat => {
      if (!graph.has(stat.id)) {
        graph.set(stat.id, new Set());
      }
      
      // 分析依赖：如果 A 使用了 B 的返回值，A 依赖 B
      stat.hook?.dependencies.forEach(depId => {
        const depStat = stats.find(s => s.id === depId);
        if (depStat) {
          graph.get(stat.id)!.add(depId);
        }
      });
    });
    
    return graph;
  }
  
  private topologicalSort(graph: Map<string, Set<string>>): Statement[] {
    // Kahn 算法实现拓扑排序
    const inDegree = new Map<string, number>();
    const result: Statement[] = [];
    
    // 计算入度
    graph.forEach((deps, id) => {
      if (!inDegree.has(id)) inDegree.set(id, 0);
      deps.forEach(dep => {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      });
    });
    
    // 优先队列：按 priority 排序
    const queue = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .sort((a, b) => this.getPriority(a[0]) - this.getPriority(b[0]))
      .map(([id]) => id);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(this.getStatement(current));
      
      graph.get(current)?.forEach(neighbor => {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    return result;
  }
}