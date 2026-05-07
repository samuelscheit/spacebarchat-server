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

  dontNpmBuild = true;
  makeCacheWritable = true;

  nativeBuildInputs = with pkgs; [
    (pkgs.python3.withPackages (ps: with ps; [ setuptools ]))
  ];

  installPhase = ''
    runHook preInstall

    # npm workspaces are installed as relative symlinks that point outside
    # node_modules. The Nix package exposes node_modules by itself, so materialize
    # local workspace packages before the broken-link fixup phase runs.
    while IFS= read -r -d "" link; do
      target="$(readlink "$link")"
      case "$target" in
        ../../apps/*|../../packages/*)
          resolved="$(realpath -m "$(dirname "$link")/$target")"
          if [ ! -d "$resolved" ]; then
            echo "Workspace link $link points to missing target $target"
            exit 1
          fi
          echo "Materializing workspace package $link"
          rm "$link"
          cp -R "$resolved" "$link"
          ;;
      esac
    done < <(find node_modules -mindepth 1 -maxdepth 2 -type l -print0)

    # Copy outputs
    echo "Copying node_modules as $out"
    cp -r node_modules $out
    echo -n 'Disk usage: '
    du -sh node_modules/

    runHook postInstall
  '';
}
