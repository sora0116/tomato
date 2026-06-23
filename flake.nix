{
  description = "Pomodoro timer development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        lib = pkgs.lib;
        src = lib.fileset.toSource {
          root = ./.;
          fileset = lib.fileset.unions [
            ./index.html
            ./package.json
            ./package-lock.json
            ./README.md
            ./svelte.config.js
            ./tsconfig.json
            ./tsconfig.app.json
            ./tsconfig.node.json
            ./vite.config.ts
            ./vitest.config.ts
            ./public
            ./src
            ./src-tauri
          ];
        };
        runtimeLibs = with pkgs; [
          glib
          gtk3
          libayatana-appindicator
          librsvg
          libsoup_3
          openssl
          webkitgtk_4_1
          xdotool
        ];
        desktopItem = pkgs.makeDesktopItem {
          name = "pomodoro-timer";
          desktopName = "Pomodoro Timer";
          exec = "pomodoro-timer";
          icon = "pomodoro-timer";
          categories = [ "Utility" "Office" ];
          terminal = false;
        };
        pomodoroTimer = pkgs.rustPlatform.buildRustPackage rec {
          pname = "pomodoro-timer";
          version = "0.1.0";
          inherit src;

          cargoRoot = "src-tauri";
          cargoLock = {
            lockFile = ./src-tauri/Cargo.lock;
          };

          npmDeps = pkgs.importNpmLock {
            npmRoot = src;
          };

          nativeBuildInputs = [
            pkgs.cargo-tauri
            pkgs.nodejs
            pkgs.importNpmLock.npmConfigHook
            pkgs.pkg-config
            pkgs.makeWrapper
            pkgs.wrapGAppsHook4
            pkgs.copyDesktopItems
          ];

          buildInputs = runtimeLibs;
          desktopItems = [ desktopItem ];
          doCheck = false;

          npmRoot = ".";

          buildPhase = ''
            runHook preBuild
            export HOME="$TMPDIR"
            cargo tauri build --no-bundle
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            binary_path=""
            for candidate in \
              src-tauri/target/*/release/pomodoro-timer \
              src-tauri/target/release/pomodoro-timer
            do
              if [ -f "$candidate" ]; then
                binary_path="$candidate"
                break
              fi
            done

            if [ -z "$binary_path" ]; then
              echo "pomodoro-timer binary not found in target directories" >&2
              exit 1
            fi

            install -Dm755 "$binary_path" $out/bin/pomodoro-timer
            install -Dm644 src-tauri/icons/128x128.png \
              $out/share/icons/hicolor/128x128/apps/pomodoro-timer.png

            wrapProgram $out/bin/pomodoro-timer \
              --prefix LD_LIBRARY_PATH : ${lib.makeLibraryPath runtimeLibs}

            runHook postInstall
          '';
        };
      in
      {
        packages.default = pomodoroTimer;
        apps.default = flake-utils.lib.mkApp {
          drv = pomodoroTimer;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            cargo
            clippy
            nodejs
            pkg-config
            rustc
            rustfmt
            cargo-tauri
            typescript
            webkitgtk_4_1
            gtk3
            glib
            openssl
            libayatana-appindicator
            librsvg
            xdotool
          ];
        };
      }
    );
}
