const poseidon = require("./poseidon");

class EphemDB {
  private kv: { [key: string]: string };

  constructor() {
    this.kv = {};
  }

  public get(k: string) {
    return this.kv[k];
  }

  public put(k: string, v: any) {
    this.kv[k] = v;
  }
}

export class SparseMerkleTree {
  private depth: number;
  private numChildren: number;
  private hasher: any;

  private db: EphemDB;

  private root: string;

  constructor(depth: number, numChildren: number = 4) {
    assert(depth > 1, "invalid depth");
    this.depth = depth;
    this.numChildren = numChildren;
    this.root = "0";

    this.db = new EphemDB();

    this.hasher = poseidon.createHash(5, 6, 52);
  }

  public newTree(defaultLeafHash: string) {
    let h = defaultLeafHash;
    for (let i = 0; i < this.depth; i++) {
      const newh = this.hasher(new Array(4).fill(h)).toString(10);
      this.db.put(newh, new Array(4).fill(h));
      h = newh;
    }
    this.root = h;
  }

  public update(address: number, value: string) {
    let v = this.root;
    let path = address;
    let path2 = address;

    const sidenodes: string[] = [];
    for (let i = 0; i < this.depth; i++) {
      const children = this.db.get(v);
      sidenodes.push(children);
      const child_index =
        Math.floor(path / Math.pow(this.numChildren, this.depth - 1)) %
        this.numChildren;
      v = children[child_index];
      path *= this.numChildren;
    }
    v = value;
    for (let i = 0; i < this.depth; i++) {
      const child_index = path2 % this.numChildren;
      const leafs: string[] = [];
      for (let c = 0; c < this.numChildren; c++) {
        if (c !== child_index) {
          leafs.push(sidenodes[this.depth - 1 - i][c]);
        } else {
          leafs.push(v);
        }
      }
      const newv = this.hasher(leafs).toString(10);
      this.db.put(newv, leafs);
      path2 = Math.floor(path2 / this.numChildren);
      v = newv;
    }

    this.root = v;
  }

  public createProof(address: number) {
    let v = this.root;
    let path = address;
    const proof = new Array(this.depth * (this.numChildren - 1));
    for (let i = 0; i < this.depth; i++) {
      const child_index =
        Math.floor(path / Math.pow(this.numChildren, this.depth - 1)) %
        this.numChildren;
      let proofIdx = 0;
      for (let c = 0; c < this.numChildren; c++) {
        if (c !== child_index) {
          proof[
            (this.depth - 1 - i) * (this.numChildren - 1) + proofIdx++
          ] = this.db.get(v)[c];
        }
      }
      v = this.db.get(v)[child_index];
      path *= this.numChildren;
    }
    assert(this.verifyProof(proof, address, v), "invalid proof");
    return proof;
  }

  public verifyProof(proof: string[], address: number, value: string) {
    let path = address;
    let v = value;
    let proofIdx = 0;
    for (let i = 0; i < this.depth; i++) {
      const inputs = [];
      for (let c = 0; c < this.numChildren; c++) {
        if (path % this.numChildren == c) {
          inputs.push(v);
        } else {
          inputs.push(proof[proofIdx]);
          proofIdx += 1;
        }
      }
      const newv = this.hasher(inputs).toString(10);
      path = Math.floor(path / this.numChildren);
      v = newv;
    }
    return this.root === v;
  }

  public getRoot() {
    return this.root;
  }
}
