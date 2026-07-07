import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();

const resolveLikeNext = (base) => {
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.js"),
    path.join(base, "index.mjs"),
  ];

  return (
    candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ) || null
  );
};

const resolveAliasPath = (specifier) => {
  const relative = specifier.slice(2);
  return resolveLikeNext(path.join(root, relative));
};

const isRelativeWithoutExtension = (specifier) =>
  (specifier.startsWith("./") || specifier.startsWith("../")) &&
  !path.extname(specifier);

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "server-only") {
    return {
      url: "data:text/javascript,export default undefined;",
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const resolvedPath = resolveAliasPath(specifier);

    if (!resolvedPath) {
      throw new Error(`Could not resolve alias specifier: ${specifier}`);
    }

    return {
      url: pathToFileURL(resolvedPath).href,
      shortCircuit: true,
    };
  }

  if (isRelativeWithoutExtension(specifier) && context.parentURL?.startsWith("file://")) {
    const parentPath = fileURLToPath(context.parentURL);
    const resolvedPath = resolveLikeNext(
      path.resolve(path.dirname(parentPath), specifier)
    );

    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
