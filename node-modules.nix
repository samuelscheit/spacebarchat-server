{
  pkgs,
  lib,
  ...
}:

let
  packageLock = builtins.fromJSON (builtins.readFile ./package-lock.json);
  workspaceNodeModuleLinks = map (path: lib.removePrefix "node_modules/" path) (
    builtins.filter (path: (packageLock.packages.${path}.link or false) && lib.hasPrefix "node_modules/" path) (builtins.attrNames packageLock.packages)
  );
  removeWorkspaceNodeModuleLinks = lib.concatMapStringsSep "\n" (path: ''
    if [ -L "$out/${path}" ]; then
      echo "Removing npm workspace symlink: $out/${path}"
      rm -f "$out/${path}"
    fi
  '') workspaceNodeModuleLinks;

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

  dontNpmBuild = true;
  makeCacheWritable = true;

  nativeBuildInputs = with pkgs; [
    (pkgs.python3.withPackages (ps: with ps; [ setuptools ]))
  ];

  installPhase = ''
    runHook preInstall

    # Copy outputs
    echo "Copying node_modules as $out"
    mkdir -p $out
    cp -r node_modules/. $out/

    # npm workspaces are represented as symlinks from node_modules to the
    # workspace source directories. This derivation packages node_modules as a
    # standalone output, so remove only the lockfile-declared workspace links;
    # Nix's noBrokenSymlinks fixup still catches any unrelated broken package
    # symlinks.
    ${removeWorkspaceNodeModuleLinks}

    echo -n 'Disk usage: '
    du -sh node_modules/

    runHook postInstall
  '';
}
