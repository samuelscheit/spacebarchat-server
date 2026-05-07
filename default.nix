{ self, rVersion }:
{
  pkgs,
  lib,
  nodejs,
  ...
}:

let
  filteredSrc = lib.fileset.toSource {
    root = ./.;
    fileset = (
      lib.fileset.intersection ./. (
        lib.fileset.unions [
          ./src
          ./package.json
          ./tsconfig.json
          ./apps
          ./packages
          ./assets
          ./patches
          ./scripts
        ]
      )
    );
  };

  revsFile = pkgs.writeText "spacebar-server-rev.json" (
    builtins.toJSON {
      rev = self.sourceInfo.rev or self.sourceInfo.dirtyRev;
      shortRev = self.sourceInfo.shortRev or self.sourceInfo.dirtyShortRev;
      lastModified = self.sourceInfo.lastModified;
    }
  );

  srcHash = builtins.substring 11 32 (toString filteredSrc);
  unwrapped = pkgs.stdenv.mkDerivation {
    pname = "spacebar-server-ts-unwrapped";
    nodejs = pkgs.nodejs_24;
    version = "1.0.0-" + srcHash;

    meta = with lib; {
      description = "Spacebar server, a FOSS reimplementation of the Discord backend.";
      homepage = "https://github.com/spacebarchat/server";
      license = licenses.agpl3Plus;
      platforms = platforms.all;
      mainProgram = "start-bundle";
      maintainers = with maintainers; [ RorySys ];
    };

    src = filteredSrc;
    dontStrip = true;

    nativeBuildInputs = with pkgs; [
      nodejs
      (pkgs.python3.withPackages (ps: with ps; [ setuptools ]))
    ];

    configurePhase = ''
      cp -r --no-preserve=ownership,timestamps ${pkgs.callPackage ./node-modules.nix { }} node_modules
      chown $USER:$GROUP node_modules -R
      chmod +w node_modules -R
    '';

    buildPhase = ''
      npm run build:tsgo
    '';

    installPhase = ''
      runHook preInstall
      # set -x

      # remove packages not needed for production, or at least try to...
      npm prune --omit dev --no-save --offline

      # npm prune recreates workspace symlinks. The final package only installs
      # node_modules, so materialize workspace packages again before fixup checks
      # reject dangling links.
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

      rm -v dist/src.tsbuildinfo
      rm -rv scripts
      time ${./nix/trimNodeModules.sh}

      # Copy outputs
      echo "Installing package into $out"
      mkdir -p $out
      cp -r assets dist node_modules package.json $out/

      # set +x
      runHook postInstall
    '';

    passthru.tests = pkgs.testers.runNixOSTest (import ./nix/tests/test-bundle-starts.nix self);
  };
in
pkgs.stdenv.mkDerivation {
  pname = "spacebar-server-ts";
  nodejs = unwrapped.nodejs;
  version = "1.0.0-" + rVersion;
  meta = unwrapped.meta;

  nativeBuildInputs = with pkgs; [
    makeWrapper
  ];

  # this isnt a real builder, we dont need these at all
  dontUnpack = true;
  dontBuild = true;
  dontPatch = true;
  dontConfigure = true;
  dontStrip = true;
  dontFixup = true;

  installPhase = ''
    # Copy outputs
    echo "Installing package into $out"
    mkdir -p $out
    cp -r --no-preserve=ownership,timestamps ${unwrapped}/. $out/

    # add version info
    cp ${revsFile} $out/.rev

    # Create wrappers for start scripts
    echo "Creating wrappers for start scripts"
    for i in $out/dist/**/start.js
    do
      makeWrapper ${pkgs.nodejs_24}/bin/node $out/bin/start-`dirname ''${i#$out/dist/}` --prefix NODE_PATH : $out/node_modules --add-flags --enable-source-maps --add-flags $i
    done
    makeWrapper ${pkgs.nodejs_24}/bin/node $out/bin/apply-migrations --prefix NODE_PATH : $out/node_modules --add-flags --enable-source-maps --add-flags $out/dist/apply-migrations.js
  '';

  passthru.tests = pkgs.testers.runNixOSTest (import ./nix/tests/test-bundle-starts.nix self);
}
