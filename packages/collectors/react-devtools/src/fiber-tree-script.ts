export interface FiberTreeWalkOptions {
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly stringMaxLen: number;
  readonly includeProps: boolean;
  readonly includeHooks: boolean;
  readonly includeState: boolean;
}

/**
 * Builds a self-contained JS expression that walks the live fiber tree
 * *inside* the Hermes runtime via `__REACT_DEVTOOLS_GLOBAL_HOOK__` (the same
 * global hook `react-devtools-core`'s `initialize()` installs) and returns
 * an already-summarized, already-capped plain object. All depth/size limits
 * and truncation happen on-device so we never ship a raw fiber graph (with
 * its functions, circular refs, and host-object internals) over the wire.
 */
export function buildFiberTreeExpression(options: FiberTreeWalkOptions): string {
  const { maxNodes, maxDepth, stringMaxLen, includeProps, includeHooks, includeState } = options;

  return `
(function() {
  var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return { error: 'React DevTools global hook not found — is this a dev build?' };
  var renderers = Array.from(hook.renderers.keys());
  var rendererId = renderers[0];
  if (rendererId == null) return { error: 'No React renderer registered yet' };
  var roots = Array.from(hook.getFiberRoots(rendererId));
  if (!roots.length) return { error: 'No fiber roots yet — has the app rendered?' };

  var MAX_NODES = ${maxNodes};
  var MAX_DEPTH = ${maxDepth};
  var STR_MAX_LEN = ${stringMaxLen};
  var INCLUDE_PROPS = ${includeProps};
  var INCLUDE_HOOKS = ${includeHooks};
  var INCLUDE_STATE = ${includeState};
  var visited = 0;

  function safeStringify(value, maxLen) {
    try {
      if (value == null) return value;
      var t = typeof value;
      if (t === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
      if (t === 'string') return value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
      if (t === 'number' || t === 'boolean') return value;
      if (t === 'object') {
        if (Array.isArray(value)) return '[Array(' + value.length + ')]';
        var ctorName = value.constructor && value.constructor.name;
        return '[Object ' + (ctorName || '') + ']';
      }
      return String(value);
    } catch (e) {
      return '[unserializable]';
    }
  }

  function summarizeProps(props) {
    if (props == null || typeof props !== 'object') return {};
    var out = {};
    for (var key in props) {
      if (key === 'children') continue;
      out[key] = safeStringify(props[key], STR_MAX_LEN);
    }
    return out;
  }

  function isFunctionComponent(fiber) {
    return typeof fiber.type === 'function' || (fiber.type && typeof fiber.type === 'object' && fiber.type.render);
  }

  function getComponentName(fiber) {
    var type = fiber.type;
    if (typeof type === 'string') return type;
    if (type == null) return fiber.tag === 6 ? '#text' : '(unknown tag=' + fiber.tag + ')';
    if (typeof type === 'object' && type.render) return type.displayName || type.render.name || '(memo/forwardRef)';
    return type.displayName || type.name || '(anonymous)';
  }

  function walkHooks(fiber) {
    if (!isFunctionComponent(fiber)) return undefined;
    var hooks = [];
    var node = fiber.memoizedState;
    var i = 0;
    while (node != null && i < 25) {
      hooks.push({ index: i, value: safeStringify(node.memoizedState, STR_MAX_LEN) });
      node = node.next;
      i++;
    }
    return hooks.length ? hooks : undefined;
  }

  function getClassState(fiber) {
    // ClassComponent fiber.tag === 1
    if (fiber.tag !== 1 || fiber.stateNode == null) return undefined;
    return safeStringify(fiber.stateNode.state, STR_MAX_LEN);
  }

  function walk(fiber, depth) {
    if (fiber == null || visited >= MAX_NODES || depth > MAX_DEPTH) return null;
    visited++;
    var node = {
      name: getComponentName(fiber),
      key: fiber.key,
      props: INCLUDE_PROPS ? summarizeProps(fiber.memoizedProps) : {},
      children: [],
    };
    if (INCLUDE_HOOKS) node.hooks = walkHooks(fiber);
    if (INCLUDE_STATE) node.state = getClassState(fiber);
    node.actualDuration = fiber.actualDuration;
    node.selfBaseDuration = fiber.selfBaseDuration;
    node.treeBaseDuration = fiber.treeBaseDuration;

    var child = fiber.child;
    while (child != null && visited < MAX_NODES) {
      var childNode = walk(child, depth + 1);
      if (childNode) node.children.push(childNode);
      child = child.sibling;
    }
    return node;
  }

  var trees = roots.map(function(root) { return walk(root.current, 0); });
  return {
    rendererId: rendererId,
    nodeCount: visited,
    truncated: visited >= MAX_NODES,
    trees: trees,
  };
})()
`;
}

const COMMIT_PROFILE_TOP_N = 10;

/**
 * Lighter-weight walk than `buildFiberTreeExpression`: only names + timings,
 * no props/hooks serialization, for a cheap "what's slow right now" digest.
 */
export function buildCommitProfileExpression(): string {
  return `
(function() {
  var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return { error: 'React DevTools global hook not found — is this a dev build?' };
  var renderers = Array.from(hook.renderers.keys());
  var rendererId = renderers[0];
  if (rendererId == null) return { error: 'No React renderer registered yet' };
  var roots = Array.from(hook.getFiberRoots(rendererId));
  if (!roots.length) return { error: 'No fiber roots yet — has the app rendered?' };

  var MAX_NODES = 5000;
  var TOP_N = ${COMMIT_PROFILE_TOP_N};

  function getComponentName(fiber) {
    var type = fiber.type;
    if (typeof type === 'string') return type;
    if (type == null) return fiber.tag === 6 ? '#text' : '(unknown tag=' + fiber.tag + ')';
    if (typeof type === 'object' && type.render) return type.displayName || type.render.name || '(memo/forwardRef)';
    return type.displayName || type.name || '(anonymous)';
  }

  var results = roots.map(function(root) {
    var visited = 0;
    var flat = [];
    function walk(fiber) {
      if (fiber == null || visited >= MAX_NODES) return;
      visited++;
      flat.push({ name: getComponentName(fiber), actualDuration: fiber.actualDuration || 0 });
      var child = fiber.child;
      while (child != null && visited < MAX_NODES) {
        walk(child);
        child = child.sibling;
      }
    }
    walk(root.current);
    flat.sort(function(a, b) { return b.actualDuration - a.actualDuration; });
    return {
      rootActualDuration: root.current.actualDuration || 0,
      nodeCount: visited,
      slowestComponents: flat.slice(0, TOP_N),
    };
  });

  return { rendererId: rendererId, roots: results };
})()
`;
}
