# Local setup after clone

`www/index.html` is the large Capacitor entry file. Restore it from the original `eesyload-driver.zip`, then sync.

```bash
cd eesyload-driver
git pull

# point this at the zip you already have on the Mac
unzip -o ~/Downloads/eesyload-driver.zip "www/index.html" -d .

# do NOT run cap add android — android/ already exists
npx cap sync android
npx cap open android
```

If the zip is not in Downloads:

```bash
mdfind -name eesyload-driver.zip
```
