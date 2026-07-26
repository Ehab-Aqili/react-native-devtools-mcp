export interface BundleModule {
  readonly path: string;
  readonly size: number;
}

/**
 * Generic bundle composition shape — deliberately decoupled from any
 * specific collector. Metro's collector (Step 5) only captures build
 * *events*, not a per-module size breakdown; that would come from parsing
 * a Metro stats file or source map, which is future work. This analyzer is
 * built and fixture-tested against this shape so that work can feed it
 * directly once it exists.
 */
export interface BundleStats {
  readonly totalSize: number;
  readonly modules: BundleModule[];
}
