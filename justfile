default:
  @just --list

deploy:
  just version
  ./deploy.sh

dev:
  deno task dev

start:
  deno task start

# generate version.txt
version:
  @echo "Updating version.txt with ChronVer"
  @deno eval "const now = new Date(); const version = \`\${now.getFullYear()}.\${String(now.getMonth() + 1).padStart(2, '0')}.\${String(now.getDate()).padStart(2, '0')}\`; await Deno.writeTextFile('version.txt', version);"
  @echo "Version updated: $(cat version.txt)"
