let
  # Pin nixpkgs to nixos-24.11 branch
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/archive/refs/heads/nixos-24.11.tar.gz";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in
pkgs.mkShellNoCC {
  buildInputs = with pkgs; [
    nodejs_22
    python313
    python313Packages.flask
    python313Packages.pytest
    python311Packages.black
    gnumake
    git
    sqlite
    shfmt
    zip
  ];

  shellHook = ''
    echo "Plox development environment loaded (noCC)"
    echo "Node: $(node -v)"
    echo "Python: $(python --version)"
    echo "Build, format, and test tools are ready."
  '';
}
