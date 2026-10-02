# AUR package

`evelopment-games-designer-bin/` installs the prebuilt `.deb` from the GitHub release, so users get it with
`yay -S evelopment-games-designer-bin` without compiling anything.

## Publish (once)

1. Create an account on https://aur.archlinux.org and add your SSH public key under *My Account*.
2. Then:

```bash
git clone ssh://aur@aur.archlinux.org/evelopment-games-designer-bin.git aur-egd
cp packaging/aur/evelopment-games-designer-bin/{PKGBUILD,.SRCINFO} aur-egd/
cd aur-egd
git add PKGBUILD .SRCINFO
git commit -m "Initial release 0.2.0"
git push
```

## Update for a new release

1. In `PKGBUILD` set `pkgver` to the new version and `pkgrel=1`.
2. Run `updpkgsums` (from `pacman-contrib`) to refresh the checksums, then `makepkg -si` to test.
3. Run `makepkg --printsrcinfo > .SRCINFO`, commit both files here and in the AUR clone, and push.
