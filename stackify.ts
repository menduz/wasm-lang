/*
// This code demonstrates a simplified "stackification" algorithm to turn
// instructions in a basic block back into a tree. This is useful when
// generating WebAssembly code from assembly instructions in SSA form.
//
// It's the algorithm used by LLVM's WebAssembly backend, viewable here:
// https://github.com/llvm-mirror/llvm/blob/master/lib/Target/WebAssembly/WebAssemblyRegStackify.cpp

type InsKind =
  'Add' |
  'LocalSet' |
  'LocalGet';

interface Ins {
  kind: InsKind;

  // arg >= 0 means "index of previous instruction"
  // arg < 0 means "~arg is a constant value"
  args: number[];
}

interface Tree {
  kind: InsKind;
  children: (number | string | Tree)[];
}

function stackify(block: Ins[]): void {
  // Count how many times an instruction was used. Instructions can only be
  // stackified as nested instructions if they are used exactly once.
  const uses: number[] = [];
  for (const ins of block) {
    uses.push(0);
    for (const arg of ins.args) {
      if (arg >= 0) {
        uses[arg]++;
      }
    }
  }

  // Stackify the block from the back towards the front. The "index" variable
  // is modified by "recoverTree" so we will automatically skip over any
  // instructions that were included as part of the recovered tree.
  let trees: [number, Tree][] = [];
  {
    function recoverTree(): [Tree, boolean] {
      const ins = block[index];
      const children: (number | string | Tree)[] = [];
      let stopped = false;

      for (let j = ins.args.length - 1; j >= 0; j--) {
        const arg = ins.args[j];

        // Is this a constant? If so, add it directly
        if (arg < 0) {
          children.unshift(~arg);
        }

        // If this argument is a single-use value immediately before this
        // instruction and we haven't hit any problems yet, recover it too.
        else if (uses[arg] === 1 && arg === index - 1 && !stopped) {
          index--;
          const [childTree, childStopped] = recoverTree();
          children.unshift(childTree);
          if (childStopped) stopped = true;
        }

        // Otherwise we've hit a match failure and will have to pop all the way
        // back up the DFS call stack and generate another tree. That tree will
        // be referenced from here.
        else {
          children.unshift(`tree${arg}`);
          stopped = true;
        }
      }

      return [{kind: ins.kind, children}, stopped];
    }

    let index = block.length;
    while (index > 0) {
      index--;
      trees.unshift([index, recoverTree()[0]]);
    }
  }

  // WASM stack code generation
  let wasmCode: string[] = [];
  {
    function visit(): void {
      const ins = block[index];
      let stopped = false;
      let lower = 0;

      switch (ins.kind) {
        case 'Add':
          wasmCode.unshift('i32.add');
          break;

        case 'LocalGet':
          wasmCode.unshift(`get_local ${~ins.args[0]}`);
          lower = 1;
          break;

        case 'LocalSet':
          wasmCode.unshift(`set_local ${~ins.args[0]}`);
          lower = 1;
          break;
      }

      for (let j = ins.args.length - 1; j >= lower; j--) {
        const arg = ins.args[j];

        // Is this a constant? If so, add it directly
        if (arg < 0) {
          wasmCode.unshift(`i32.const ${~arg}`);
        }

        // If this argument is a single-use value immediately before this
        // instruction and we haven't hit any problems yet, recover it too.
        else if (uses[arg] === 1 && arg === index - 1) {
          index--;
          visit();
        }

        // Otherwise we've hit a match failure and will have to pop all the way
        // back up the DFS call stack and generate another tree. That tree will
        // be referenced from here.
        else {
          wasmCode.unshift(`get_local ${makeLocal(arg)}`);
        }
      }
    }

    function makeLocal(index: number): number {
      let local = locals.get(index);
      if (local === undefined) {
        local = nextLocal++;
        locals.set(index, local);
      }
      return local;
    }

    let index = block.length;
    let locals = new Map<number, number>();
    let nextLocal = 100;
    while (index > 0) {
      index--;
      const local = locals.get(index);
      if (local !== undefined) {
        if (wasmCode[0] === `get_local ${local}`) {
          wasmCode[0] = `tee_local ${local}`;
        } else {
          wasmCode.unshift(`set_local ${local}`);
        }
      }
      visit();
    }
  }

  block.forEach((ins, i) => {
    console.log(`var${i} =`, ins.kind, ins.args.map(a => {
      return a >= 0 ? `var${a}` : ~a;
    }).join(', '));
  });
  console.log('\n-- becomes --\n');
  for (const [i, tree] of trees) {
    console.log(`tree${i} =`, treeToString(tree, ''));
  }
  console.log('\n-- becomes --\n');
  for (const ins of wasmCode) {
    console.log(ins);
  }
  console.log('\n-------------------------------------------------------------\n');
}

function treeToString(tree: Tree, indent: string): string {
  if (tree.children.length < 2) {
    return tree.kind + '(' + tree.children.map(c => {
      return typeof c === 'number' || typeof c === 'string' ? c : treeToString(c, indent);
    }).join('') + ')';
  }

  indent += '  ';
  return tree.kind + '(' + tree.children.map(c => {
    return '\n' + indent + (typeof c === 'number' || typeof c === 'string'
      ? c : treeToString(c, indent));
  }).join(',') + ')';
}

stackify([
  {kind: 'LocalGet', args: [~0]},
  {kind: 'Add', args: [0, ~1]},
  {kind: 'Add', args: [~2, ~3]},
  {kind: 'Add', args: [1, 2]},
  {kind: 'LocalSet', args: [~0, 3]},
]);

stackify([
  {kind: 'LocalGet', args: [~0]},
  {kind: 'Add', args: [0, ~1]},
  {kind: 'Add', args: [0, ~2]},
  {kind: 'Add', args: [1, 2]},
  {kind: 'LocalSet', args: [~0, 3]},
]);

stackify([
  {kind: 'LocalGet', args: [~0]},
  {kind: 'Add', args: [0, ~1]},
  {kind: 'Add', args: [~2, ~3]},
  {kind: 'Add', args: [1, 2]},
  {kind: 'LocalSet', args: [~0, 3]},
  {kind: 'Add', args: [3, ~4]},
  {kind: 'LocalSet', args: [~1, 5]},
]);
*/