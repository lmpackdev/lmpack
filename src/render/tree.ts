interface Dir {
  dirs: Map<string, Dir>;
  files: string[];
}

/**
 * Indented directory tree of the given files. Only directories that contain
 * packed files appear, so empty directories are never shown.
 */
export function renderTree(paths: string[]): string {
  const root: Dir = { dirs: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.dirs.get(part);
      if (!next) node.dirs.set(part, (next = { dirs: new Map(), files: [] }));
      node = next;
    }
    node.files.push(parts[parts.length - 1]!);
  }
  const lines: string[] = [];
  const emit = (node: Dir, indent: string) => {
    for (const name of [...node.dirs.keys()].sort()) {
      lines.push(`${indent}${name}/`);
      emit(node.dirs.get(name)!, indent + '  ');
    }
    for (const name of [...node.files].sort()) lines.push(indent + name);
  };
  emit(root, '');
  return lines.join('\n');
}
