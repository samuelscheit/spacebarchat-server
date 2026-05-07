{
  pkgs,
  lib,
  ...
}:

let
  filteredSrc = lib.fileset.toSource {
    root = ./.;
    fileset = (
      lib.fileset.intersection ./. (
        lib.fileset.unions [
          ./package.json
          ./package-lock.json
          ./apps
          ./packages
          ./patches
        ]
      )
    );
  };
in
pkgs.buildNpmPackage {
  pname = "spacebar-server-ts-node_modules";
  nodejs = pkgs.nodejs_24;
  version = builtins.hashFile "sha256" ./package.json;

  meta = with lib; {
    description = "Node modules for the spacebar-server-ts package.";
    homepage = "https://github.com/spacebarchat/server";
    license = licenses.agpl3Plus;
    platforms = platforms.all;
    maintainers = with maintainers; [ RorySys ];
  };

  src = filteredSrc;
  npmDeps = pkgs.importNpmLock { npmRoot = filteredSrc; };
  npmConfigHook = pkgs.importNpmLock.npmConfigHook;
  npmInstallFlags = [ "--workspaces=false" ];

  dontNpmBuild = true;
  makeCacheWritable = true;

  nativeBuildInputs = with pkgs; [
    (pkgs.python3.withPackages (ps: with ps; [ setuptools ]))
  ];

  installPhase = ''
    runHook preInstall

    # npm represents local workspaces as node_modules symlinks to apps/* and
    # packages/*. This derivation exports node_modules as a standalone Nix
    # output, so those links become dangling after the copy into /nix/store.
    # Remove only lockfile-declared workspace links before copying; Nix's
    # noBrokenSymlinks fixup still catches unrelated broken package symlinks.
    ${pkgs.nodejs_24}/bin/node ${./scripts/nix/remove-workspace-node-module-links.js} --package-lock package-lock.json --node-modules node_modules

    # Copy outputs
    echo "Copying node_modules as $out"
    mkdir -p $out
    cp -r node_modules/. $out/
    echo -n 'Disk usage: '
    du -sh node_modules/

    runHook postInstall
  '';
}
