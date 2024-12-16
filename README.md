<h1 align="center">
  Typescript package template
</h1>

Simple template where most things should be set up to deploy a typescript package. Not tested on all platforms or node versions yet!

## Usage

1. Close this repo.
2. Set the package name in `package.json` and the repo url.
3. Put your code in `src` and link it into `index.ts`.
4. Update the `LICENSE` from Apache-2.0 to whatever you like.
5. Remove the `.git` folder and do a new `git init` and commit.
6. (Optional) adjust the tsconfig or tsup files, as well as the npmignore.
7. Run `bun run build` to build the package.
8. Run `npx publint` to check for errors as a package.
9. Run `npm publish` to publish to npm.
